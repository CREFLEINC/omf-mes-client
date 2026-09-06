import { AlertBanner, Breadcrumb, Button, Chip, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import {
  adjustmentErrors,
  decisionLockReason,
  decisionWarnings,
  EMPTY_DECISION,
  toAcknowledgeBody,
  type DecisionDraft,
} from './decision';
import { useUomLookup } from './lookups';
import { useAcknowledgeMutation } from './mutations';
import { DecisionPane, DiffPane, NotificationList, WorkOrderPane } from './panes';
import { useAffectedWorkOrders, useChangeNotifications, useProductionOrderDetail } from './queries';

const t = messages.poChangeReview;

/**
 * W-02-06 P/O 변경 관리자 확인.
 *
 * ⚠ **변경은 이미 반영된 뒤에 화면에 온다**(§5-1) — P/O 는 ERP 수신본이라(R07) 화면이 열릴 때
 * 수량은 «이미» 바뀐 값이다. 그래서 「무엇이 바뀌었나」는 서버가 내리는 `lastChange` 로만 말한다
 * (`withLastChange=true`) — 2열 비교표가 그것을 그린다. 못 받으면 그 사실을 적고 간접 비교로
 * 채우지 않는다.
 *
 * ⭐ **반영은 W/O 조정을 함께 싣는다** — P/O 확인과 W/O 조정이 한 트랜잭션이다(B-8). 어느 W/O 를
 * 얼마나 줄일지는 서버가 나누지 않으므로 ③ 구획에서 사람이 적는다.
 *
 * ⭐ **이 화면이 ERP 배치와 부딪치는 첫 화면이다**(§5-3) — 판정하는 사이 ERP 가 같은 P/O 를 또
 * 바꿔 보내면 409 다. 그때 문구가 「남이 고쳤다」가 아니라 **「ERP 가 다시 변경했습니다」**여야
 * 한다.
 */
export const PoChangeReviewScreen = () => {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DecisionDraft>(EMPTY_DECISION);
  const [showError, setShowError] = useState(false);

  const list = useChangeNotifications();
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const uoms = useUomLookup();
  /* 잠금 토큰은 «그 P/O 의 상세»가 내린다 — 고르면 함께 부른다(B-1-1). */
  const detail = useProductionOrderDetail(selectedId);
  const workOrders = useAffectedWorkOrders(selectedId);

  const selected = rows.find((row) => row.productionOrderId === selectedId) ?? null;

  /* 고른 건이 목록에서 사라지면(다른 사람이 확인했거나 ERP 가 또 보냈다) 선택을 놓는다. */
  useEffect(() => {
    if (selectedId === null) return;
    if (!rows.some((row) => row.productionOrderId === selectedId)) setSelectedId(null);
  }, [rows, selectedId]);

  /* 대상이 바뀌면 판정을 물려주지 않는다 — 되돌릴 수 없는 판정이라 잘못 섞이면 안 된다. */
  useEffect(() => {
    setDraft(EMPTY_DECISION);
    setShowError(false);
  }, [selectedId]);

  const write = useAcknowledgeMutation({
    productionOrderId: selectedId,
    onSuccess: () => {
      setSelectedId(null);
      setDraft(EMPTY_DECISION);
      setShowError(false);
      toast.show({ variant: 'success', description: t.decision.submitted });
      void list.refetch();
    },
  });

  const affected = workOrders.data ?? [];
  const gate = { selected, draft, workOrders: affected, isSaving: write.isSaving };
  const lock = decisionLockReason(gate);
  const warnings = decisionWarnings(draft, affected, selected?.orderQty ?? null);
  const adjustmentErrorMap = adjustmentErrors(draft, affected);
  const unacknowledged = rows.filter((row) => row.acknowledgedAt === null).length;

  /*
   * ⚠ **충돌 문구를 갈아 끼운다**(§5-3 · §9-2). 부딪치는 상대가 사람이 아니라 ERP 배치라,
   * 공통 배너의 「남이 고쳤다」를 그대로 두면 사용자가 동료를 찾으러 간다.
   */
  const isConflict = write.error?.kind === 'conflict';

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={<Chip status="warning">{t.header.unacknowledged(unacknowledged)}</Chip>}
      />

      <div className="two-pane po-change-review-layout">
        <section className="pane po-change-review-pane" aria-label={t.panes.list}>
          <h2>{t.panes.list}</h2>
          <NotificationList
            rows={rows}
            selectedId={selectedId}
            isLoading={list.isPending}
            error={
              list.isError ? (
                <AlertBanner
                  variant="error"
                  action={
                    <Button variant="outlined" size="sm" onClick={() => void list.refetch()}>
                      {messages.common.retry}
                    </Button>
                  }
                >
                  {t.list.loadFailed}
                </AlertBanner>
              ) : null
            }
            onSelect={setSelectedId}
          />
        </section>

        <div className="pane-stack">
          <DiffPane selected={selected} uoms={uoms} />

          <WorkOrderPane
            rows={affected}
            isLoading={workOrders.isPending && selectedId !== null}
            isError={workOrders.isError}
            hasSelection={selectedId !== null}
            overProduced={warnings.overProduced}
            changedQty={selected?.orderQty ?? null}
            showAdjustments={draft.decision === 'APPLY'}
            adjustments={draft.adjustments}
            adjustmentErrors={adjustmentErrorMap}
            onChangeAdjustment={(workOrderId, value) =>
              setDraft((current) => ({
                ...current,
                adjustments: { ...current.adjustments, [String(workOrderId)]: value },
              }))
            }
          />

          <DecisionPane
            draft={draft}
            showError={showError}
            warnings={warnings}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          />

          <section className="pane po-change-review-pane" aria-label={t.decision.submit}>
            {isConflict ? (
              <div className="banner-slot">
                <AlertBanner
                  variant="error"
                  title={t.conflict.title}
                  action={
                    <Button
                      variant="outlined"
                      size="sm"
                      onClick={() => {
                        write.reset();
                        setSelectedId(null);
                        void list.refetch();
                      }}
                    >
                      {t.conflict.reload}
                    </Button>
                  }
                >
                  {t.conflict.description}
                </AlertBanner>
              </div>
            ) : (
              <SaveErrorBanner error={write.error} onReload={() => void list.refetch()} />
            )}

            {lock !== undefined && (
              <div className="banner-slot">
                <AlertBanner variant="info">{lock}</AlertBanner>
              </div>
            )}
            <div className="form-actions">
              <Button
                disabled={lock !== undefined || detail.isPending}
                onClick={() => {
                  setShowError(true);
                  const body = toAcknowledgeBody(gate);
                  /* 게이트가 열려 있어도 본문이 없으면 멈춘다 — 반쪽짜리 판정을 보내지 않는다. */
                  if (body === null) return;
                  write.write(body);
                }}
              >
                {t.decision.submit}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};
