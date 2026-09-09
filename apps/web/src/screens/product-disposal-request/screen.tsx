import {
  AlertBanner,
  Breadcrumb,
  Button,
  PageHeader,
  type TabItem,
  Tabs,
  useToast,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { progressSummary, toProgressSteps } from './approval-progress';
import { HistoryPane, type ApprovalView } from './history-pane';
import { useIssueReasonCodes, useIssueTypeCodes, useItemLookup, useUomLookup } from './lookups';
import { useDisposalPostMutation, useDisposalRequestMutation } from './mutations';
import { resolvePlacements } from './placement';
import {
  useApprovalDetail,
  useApprovalRoute,
  useIssueDetail,
  useDisposalPartners,
  useDisposalTargets,
  useIssueHistory,
  useLotPlacements,
} from './queries';
import {
  EMPTY_DRAFT,
  requestLockReason,
  confirmSummary,
  toApprovalRequestCreate,
  toBusinessDate,
  toGoodsIssueCreate,
  type DisposalDraft,
} from './request-draft';
import { IssuePane } from './issue-pane';
import { RequestPane } from './request-pane';
import { SubmitConfirmDialog } from './submit-confirm-dialog';
import { TargetList } from './target-list';
import { DISPOSAL_REQUEST_TABS, readTab, tabLabel, TAB_KEY, toTabParam } from './tabs';
import { quotedReason } from './types';

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
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReasonTouched, setIsReasonTouched] = useState(false);

  const [params, setParams] = useSearchParams();
  const tab = readTab(params);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);

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
  const placements = useLotPlacements(lotIds);
  const placement = resolvePlacements(targets, placements.entriesOf);

  const history = useIssueHistory(1);
  const historyRows = useMemo(() => history.data?.items ?? [], [history.data]);
  const selectedIssue = historyRows.find((row) => row.goodsIssueId === selectedIssueId) ?? null;
  const approvalDetail = useApprovalDetail(selectedIssue?.approvalRequestId ?? null);
  /* 잠금 토큰을 전표 상세 경로에 앉히는 자리다 — 전기가 그 토큰을 쓴다. */
  const issueDetail = useIssueDetail(selectedIssue?.goodsIssueId ?? null);

  const post = useDisposalPostMutation({
    goodsIssueId: selectedIssue?.goodsIssueId ?? null,
    onSuccess: () => {
      toast.show({ variant: 'success', description: t.issue.posted });
      void history.refetch();
    },
  });

  /* 이력을 다시 읽으면 고른 전표가 사라질 수 있다 — 남아 있지 않으면 고름을 푼다. */
  useEffect(() => {
    const present = new Set(historyRows.map((row) => row.goodsIssueId));
    setSelectedIssueId((current) => (current !== null && present.has(current) ? current : null));
  }, [historyRows]);

  /**
   * 결재 진행의 네 갈래.
   *
   * ⛔ **「고르지 않았다」·「상신 안 했다」·「못 물었다」를 각각 다르게 말한다** — 뭉치면
   * 사용자가 결재함에 가서 없는 요청을 찾는다.
   */
  const approvalView: ApprovalView =
    selectedIssue === null
      ? { kind: 'idle' }
      : selectedIssue.approvalRequestId === null
        ? { kind: 'none' }
        : approvalDetail.isPending
          ? { kind: 'pending' }
          : approvalDetail.isError || approvalDetail.data === undefined
            ? { kind: 'failed' }
            : {
                kind: 'loaded',
                summary: progressSummary(approvalDetail.data.request),
                steps: toProgressSteps(approvalDetail.data),
              };

  const changeTab = (next: string): void => {
    /*
     * ⛔ **탭 목록을 손으로 한 번 더 적지 않는다** — 정본은 `DISPOSAL_REQUEST_TABS` 하나다.
     * 여기 목록을 따로 두면 셋째 탭이 생길 때 그 버튼이 말없이 아무 일도 하지 않는다.
     */
    const target = DISPOSAL_REQUEST_TABS.find((value) => value === next);
    if (target === undefined || target === tab) return;

    const param = toTabParam(target);
    const nextParams = new URLSearchParams(params);
    if (param === null) nextParams.delete(TAB_KEY);
    else nextParams.set(TAB_KEY, param);
    setParams(nextParams);
  };

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
  /*
   * ⛔ **본문이 못 만들어지는 사유를 «전부» 여기서 낸다.** 하나라도 빠지면 버튼이 열린 채
   * 눌러도 아무 일이 없다 — 사용자는 화면이 고장 났다고 읽는다.
   *
   * 자리 판정을 뒤에 두는 이유는 «먼저 채울 것»을 먼저 말하기 위해서다. 대상을 고르기 전에
   * 「재고 위치를 확인하는 중」이라고 하면 무엇을 해야 할지 알 수 없다.
   */
  const submitLock =
    requestLockReason(gate) ?? (placement.kind === 'blocked' ? placement.reason : undefined);

  /* ⭐ 「셀 수 없으면 수를 적지 않는다」 규칙이 한 곳에 있다 — 두 벌이면 화면과 창이 갈린다. */
  const qtyText = confirmSummary(targets);

  const submitRequest = (): void => {
    if (placement.kind !== 'resolved') return;

    /*
     * ⛔ **여기서 시각을 찍지 않는다.** 찍어 넘기면 그 값이 멱등 지문에 실려 누를 때마다
     * 지문이 달라지고, 재시도가 «새 폐기 전표»가 된다. 시각은 보내는 자리가 얹는다.
     */
    const issue = toGoodsIssueCreate({ ...gate, placement });
    const approval = toApprovalRequestCreate(draft);

    /* 게이트가 열려 있어도 본문이 없으면 멈춘다 — 반쪽짜리 전표를 만들지 않는다. */
    if (issue === null || approval === null) return;

    write.write({ issue, approval });
  };

  /*
   * ⭐ **활성 탭의 내용만 담는다.** DS `Tabs` 는 패널을 전부 렌더하고 비활성만 감춘다 —
   * 두 패널에 내용을 두면 숨은 탭의 표가 접근성 트리에 남고, 이름으로 집는 조작과 시험이
   * 숨은 글자를 잡는다.
   */
  const requestTab = (
    <>
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
        partners={partners.data ?? []}
        isPartnersPending={partners.isPending}
        isPartnersError={partners.isError}
        issueTypes={issueTypes}
        issueReasons={issueReasons}
        onChange={(patch) => {
          if (patch.reason !== undefined) setIsReasonTouched(true);
          setDraft((current) => ({ ...current, ...patch }));
        }}
      />

      <section className="pane" aria-label={t.request.submit}>
        <SaveErrorBanner error={write.error} onReload={() => void list.refetch()} />
        {submitLock !== undefined && (
          <div className="banner-slot">
            {/* ⭐ 다시 부를 수 있는 막힘이면 «그 길»을 낸다 — 없으면 영원히 막힌다. */}
            <AlertBanner
              variant={
                placement.kind === 'blocked' && placement.isRetryable === true ? 'error' : 'info'
              }
              action={
                placement.kind === 'blocked' && placement.isRetryable === true ? (
                  <Button variant="outlined" size="sm" onClick={placements.refetch}>
                    {messages.common.retry}
                  </Button>
                ) : undefined
              }
            >
              {submitLock}
            </AlertBanner>
          </div>
        )}
        {/* A-11 — 올린 뒤 화면에서 철회할 길이 없다는 사실을 «올리기 전»에 적는다. */}
        <p className="field-note">{t.withdrawn.noWithdraw}</p>
        <div className="form-actions">
          <Button
            disabled={submitLock !== undefined}
            /* ⭐ 되돌릴 수 없는 쓰기라 «누르기 전»에 한 겹을 둔다 — 창이 무엇이 나가는지 보인다. */
            onClick={() => {
              setShowError(true);
              setIsConfirming(true);
            }}
          >
            {t.request.submit}
          </Button>
        </div>
        {isConfirming && (
          <SubmitConfirmDialog
            count={targets.length}
            qtyText={qtyText}
            onClose={() => setIsConfirming(false)}
            onConfirm={() => {
              setIsConfirming(false);
              submitRequest();
            }}
          />
        )}
      </section>

      {/*
       * ③ — **읽기 전용 표시만 둔다.** 「기타출고 처리」 버튼은 여기 없다.
       *
       * ⛔ **전기는 «고른 전표»에 거는 조작이다.** 요청을 올리면 초안이 비므로 이 탭에는
       * 걸 대상이 남지 않는다. 사용자는 승인이 끝난 뒤 «다시 와서»(§5-4) 「처리 이력」에서
       * 그 전표를 골라 전기한다 — 버튼을 그쪽에 둔다.
       */}
      <IssuePane draft={draft} partners={partners.data ?? []} />
    </>
  );

  const historyTab = (
    <HistoryPane
      rows={historyRows}
      selectedId={selectedIssueId}
      isLoading={history.isPending}
      error={
        history.isError ? (
          <AlertBanner
            variant="error"
            action={
              <Button variant="outlined" size="sm" onClick={() => void history.refetch()}>
                {messages.common.retry}
              </Button>
            }
          >
            {t.history.loadFailed}
          </AlertBanner>
        ) : null
      }
      reasons={issueReasons}
      onSelect={setSelectedIssueId}
      approval={approvalView}
      post={{
        error: post.error,
        isSaving: post.isSaving,
        /*
         * ⛔ **승인 «상태»로 잠그지 않는다**(통지 #674 · §8-6) — 앞질러 막으면 승인이
         * 끝났는데도 열리지 않는다. 고르지 않았거나 토큰을 못 받았을 때만 막고, 승인 전
         * 여부는 서버의 400 이 말한다(J-8).
         */
        lock:
          selectedIssue === null
            ? t.issue.pickRow
            : issueDetail.isPending
              ? t.issue.tokenLoading
              : issueDetail.isError
                ? t.issue.tokenFailed
                : post.isSaving
                  ? messages.productDisposalRequest.lock.saving
                  : undefined,
        onPost: () => {
          /* ⭐ 시각을 «누르는 순간» 찍는다 — 전기 본문은 두 칸뿐이다. */
          const now = new Date();
          post.write({ businessDate: toBusinessDate(now), occurredAt: now.toISOString() });
        },
      }}
    />
  );

  const tabItems: TabItem[] = [
    {
      value: 'request',
      label: tabLabel('request'),
      content: tab === 'request' ? requestTab : null,
      /*
       * ⛔ **보내는 중에는 다른 탭으로 건너가지 못한다** — 탭이 바뀌면 보내는 자리가 화면에서
       * 사라져 도착한 되먹임이 설 곳을 잃는다. 보고 있는 탭은 잠그지 않는다.
       */
      disabled: write.isSaving && tab !== 'request',
    },
    {
      value: 'history',
      label: tabLabel('history'),
      content: tab === 'history' ? historyTab : null,
      disabled: write.isSaving && tab !== 'history',
    },
  ];

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

      <Tabs aria-label={t.title} items={tabItems} value={tab} onChange={changeTab} />
    </>
  );
};
