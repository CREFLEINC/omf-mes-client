import { AlertBanner, Breadcrumb, Button, Chip, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import {
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
 * 수량은 «이미» 바뀐 값이다. 그래서 「무엇이 바뀌었나」는 서버가 내리는 `lastChange` 로만 말할
 * 수 있고, 그 계약이 생성물에 아직 안 들어와 **그 구획은 비운 채 사유를 적는다.**
 *
 * ⛔ **간접 비교로 채우지 않는다** — W/O 수량으로 견주면 수량만 되고 납기·중단을 말하지 못해
 * 세 행 중 둘이 빈다. 「계약이 늦으면 비워 두는 편이 낫다」가 설계의 지시다.
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

  const gate = { selected, draft, isSaving: write.isSaving };
  const lock = decisionLockReason(gate);
  const affected = workOrders.data ?? [];
  const warnings = decisionWarnings(draft, affected, selected?.orderQty ?? null);
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

      <div className="two-pane">
        <section className="pane" aria-label={t.panes.list}>
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
          />

          <DecisionPane
            draft={draft}
            showError={showError}
            warnings={warnings}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          />

          <section className="pane" aria-label={t.decision.submit}>
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
