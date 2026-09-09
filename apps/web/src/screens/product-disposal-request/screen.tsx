import { AlertBanner, Breadcrumb, Button, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { useIssueReasonCodes, useIssueTypeCodes, useItemLookup, useUomLookup } from './lookups';
import { useDisposalRequestMutation } from './mutations';
import { resolvePlacements } from './placement';
import {
  useApprovalRoute,
  useDisposalPartners,
  useDisposalTargets,
  useLotPlacements,
} from './queries';
import {
  EMPTY_DRAFT,
  issueLockReason,
  requestLockReason,
  toApprovalRequestCreate,
  toGoodsIssueCreate,
  type DisposalDraft,
} from './request-draft';
import { IssuePane, RequestPane } from './request-pane';
import { TargetList } from './target-list';
import { quotedReason, totalQtyOf } from './types';

const t = messages.productDisposalRequest;

/**
 * W-04-10 제품 폐기 요청.
 *
 * ⭐ **`W-01-06`(자재 폐기 요청)의 대칭이고 골격을 그대로 쓴다** — 요청 → 승인 → 기타출고 3단과
 * 「승인 완료 후에만 출고」 잠금이 같다.
 *
 * ⭐ **「승인 요청」한 번이 호출 둘이다**(§5-7) — 전표를 만들고 그 위에 상신한다. 도착지 짝이
 * 앞 호출의 본문에 실리므로 자체 폐기·폐기 거래처가 «요청 작성» 구획에 선다(통지 `#675` §2).
 *
 * ⛔ **「기타출고 처리」를 승인 «상태»로 잠그지 않는다**(통지 `#674` · 설계서 §8-6) — 상태 값을
 * 판정할 수 없는 동안 앞질러 잠그면 승인이 끝났는데도 열리지 않는다. 버튼을 열고 서버의 400 을
 * 안내로 바꾼다(J-8).
 */
export const ProductDisposalRequestScreen = () => {
  const toast = useToast();
  const [selected, setSelected] = useState<number[]>([]);
  const [draft, setDraft] = useState<DisposalDraft>(EMPTY_DRAFT);
  const [showError, setShowError] = useState(false);
  const [isReasonTouched, setIsReasonTouched] = useState(false);

  const list = useDisposalTargets(1);
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const items = useItemLookup();
  const uoms = useUomLookup();
  const partners = useDisposalPartners();
  const issueTypes = useIssueTypeCodes();
  const issueReasons = useIssueReasonCodes();
  const route = useApprovalRoute();

  const targets = useMemo(
    () => rows.filter((row) => selected.includes(row.dispositionDecisionId)),
    [rows, selected],
  );

  /*
   * ⭐ **처분 사유를 요청 사유의 기본값으로 옮긴다**(§5-5). 사용자가 한 번이라도 손대면 그 뒤로는
   * 덮지 않는다 — 고쳐 쓴 문장을 선택 하나 바꿨다고 되돌리면 쓴 사람이 다시 쓴다.
   */
  useEffect(() => {
    if (isReasonTouched) return;
    setDraft((current) => ({ ...current, reason: quotedReason(targets) }));
  }, [targets, isReasonTouched]);

  /* 조회를 다시 하면 고른 건이 사라질 수 있다 — 남은 것만 들고 간다. */
  useEffect(() => {
    const present = new Set(rows.map((row) => row.dispositionDecisionId));
    setSelected((current) => current.filter((id) => present.has(id)));
  }, [rows]);

  /*
   * ⭐ **고른 것의 자리만 묻는다** — 목록 전체를 미리 부르면 고르지도 않은 LOT 의 재고를 쪽마다
   * 훑는다. 대상이 바뀌면 그때 묻는다.
   */
  const lotIds = useMemo(
    () => targets.map((target) => target.lotId).filter((id): id is number => id !== null),
    [targets],
  );
  const placementsByLot = useLotPlacements(lotIds);
  const placement = resolvePlacements(targets, (lotId) => placementsByLot[lotId]);

  const write = useDisposalRequestMutation({
    onSuccess: () => {
      setSelected([]);
      setDraft(EMPTY_DRAFT);
      setShowError(false);
      setIsReasonTouched(false);
      toast.show({ variant: 'success', description: t.request.submitted });
      void list.refetch();
    },
  });

  const gate = { targets, draft, route, isSaving: write.isSaving };
  const requestLock = requestLockReason(gate);
  /*
   * ⛔ **승인 상태를 «물어볼 수가» 없다** — `ApprovalRequest.statusCode` 가 계약에서 아직 열린
   * 문자열이다. 「승인 안 됨」이 아니라 **모르는 것**이라 그대로 적고, 그 모름으로 버튼을 잠그지
   * 않는다(통지 `#674`).
   */
  const issueLock = issueLockReason({ ...gate, approval: 'unknown' });
  /* 자리를 못 풀었으면 그 사유가 요청을 막는다 — 게이트보다 뒤에 두어 먼저 채울 것을 먼저 말한다. */
  const submitLock = requestLock ?? (placement.kind === 'blocked' ? placement.reason : undefined);

  const qtyText = totalQtyOf(targets) === null ? '—' : String(totalQtyOf(targets));

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      {/* ⛔ 승인·반려는 여기 없다 — 어디서 하는지를 머리에 적는다(J-10). */}
      <div className="banner-slot">
        <AlertBanner variant="info">{t.headerNotice}</AlertBanner>
      </div>

      <section className="pane" aria-label={t.panes.targets}>
        <h2>{t.panes.targets}</h2>
        <TargetList
          rows={rows}
          selected={selected}
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
                {t.targets.loadFailed}
              </AlertBanner>
            ) : null
          }
          items={items}
          uoms={uoms}
          onToggle={(id) =>
            setSelected((current) =>
              current.includes(id) ? current.filter((one) => one !== id) : [...current, id],
            )
          }
          onToggleAll={() =>
            setSelected((current) =>
              current.length > 0 ? [] : rows.map((row) => row.dispositionDecisionId),
            )
          }
        />
        <p className="field-note">{t.targets.selected(targets.length, qtyText)}</p>
      </section>

      <RequestPane
        draft={draft}
        showError={showError}
        route={route}
        qtyText={qtyText}
        onChange={(patch) => {
          if (patch.reason !== undefined) setIsReasonTouched(true);
          setDraft((current) => ({ ...current, ...patch }));
        }}
      />

      <section className="pane" aria-label={t.request.submit}>
        <SaveErrorBanner error={write.error} onReload={() => void list.refetch()} />
        {submitLock !== undefined && (
          <div className="banner-slot">
            <AlertBanner variant="info">{submitLock}</AlertBanner>
          </div>
        )}
        {/* A-11 — 올린 뒤 화면에서 철회할 길이 없다는 사실을 «올리기 전»에 적는다. */}
        <p className="field-note">{t.withdrawn.noWithdraw}</p>
        <div className="form-actions">
          <Button
            disabled={submitLock !== undefined}
            onClick={() => {
              setShowError(true);
              if (placement.kind !== 'resolved') return;

              /* ⭐ 시각을 «누르는 순간» 한 번 찍는다 — 본문 조립 자리에서 찍으면 렌더마다 달라진다. */
              const now = new Date();
              const issue = toGoodsIssueCreate({
                ...gate,
                approval: 'unknown',
                placement,
                now,
              });
              const approval = toApprovalRequestCreate(draft);

              /* 게이트가 열려 있어도 본문이 없으면 멈춘다 — 반쪽짜리 전표를 만들지 않는다. */
              if (issue === null || approval === null) return;
              write.write({ issue, approval });
            }}
          >
            {t.request.submit}
          </Button>
        </div>
      </section>

      <IssuePane
        draft={draft}
        partners={partners.data ?? []}
        isPartnersPending={partners.isPending}
        isPartnersError={partners.isError}
        issueTypes={issueTypes}
        issueReasons={issueReasons}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      />

      <section className="pane" aria-label={t.issue.submit}>
        {issueLock !== undefined && (
          <div className="banner-slot">
            <AlertBanner variant="info">{issueLock}</AlertBanner>
          </div>
        )}
        {/* A-11 — 출고 전표에 요청 번호를 담을 자리가 없어 비고로 잇는다. */}
        <p className="field-note">{t.withdrawn.requestRef}</p>
        <div className="form-actions">
          <Button disabled={issueLock !== undefined}>{t.issue.submit}</Button>
        </div>
      </section>
    </>
  );
};
