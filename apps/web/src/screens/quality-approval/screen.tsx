import { AlertBanner, Button, Chip, EmptyState, SkeletonText, useToast } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite } from '../../patterns/master';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { toApiError } from '../../patterns/request';
import { ApprovalActionPane } from './approval-action-pane';
import { ApproveDialog } from './approve-dialog';
import {
  QUALITY_APPROVAL_STATUS_CODES,
  QUALITY_APPROVAL_TYPE_CODES,
  approvalScopeWarning,
  statusBadgeOf,
  toCodeOptions,
} from './code-options';
import { ConditionPane } from './condition-pane';
import { toConcessionCardinality } from './conditions';
import { DetailPane } from './detail-pane';
import { FilterBar } from './filter-bar';
import {
  EMPTY_FILTERS,
  PENDING_ONLY_DEFAULT,
  readFilters,
  readPage,
  readPendingOnly,
  readSelectedRequestId,
  toAppliedSearchParams,
  toRequestListQuery,
  withSelectedRequest,
  type RequestFilters,
} from './filters';
import { toPageView } from './pagination';
import { ProgressPane } from './progress-pane';
import { toApprovalProgressView } from './progress';
import { RejectDialog } from './reject-dialog';
import {
  qualityApprovalKeys,
  requestDetailPath,
  useApprovalRequestDetail,
  useApprovalRequests,
  useConcessionCandidates,
} from './queries';
import { RequestList } from './request-list';
import {
  IQC_SKIP_APPROVAL_PATH,
  IQC_SKIP_TYPE_CODE,
  TypeTabs,
  toTypeTabOptions,
} from './type-tabs';
import {
  toRequestDetailView,
  toRequestRow,
  type ApprovalRequest,
  type ApprovalRequestDetail,
} from './types';

const EMPTY_ITEMS: ApprovalRequest[] = [];
type DecisionAction = 'approve' | 'reject';
interface DecisionVariables {
  action: DecisionAction;
  approvalRequestId: number;
  comment: string;
}

const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const description = error.errors.map((item) => item.message).join(' ');
      return description === '' ? messages.httpError.description : description;
    }
  }
};

/** OQC 생략 결재 유형 — 서버 선행 값(omf-all-around#119 · P-83). 생성 타입의 enum 에 아직 없다. */
const OQC_SKIP = 'OQC_SKIP';
export interface QualityApprovalScreenProps {
  approvalTypeCodes?: readonly string[];
  statusCodes?: readonly string[];
}

export const QualityApprovalScreen = ({
  approvalTypeCodes = QUALITY_APPROVAL_TYPE_CODES,
  statusCodes = QUALITY_APPROVAL_STATUS_CODES,
}: QualityApprovalScreenProps = {}) => {
  const t = messages.qualityApproval;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  /* 두 구획이 창 바닥에서 멈추고, 가운데 막대로 고른 폭은 다음에 들어와도 남는다(입하 예정 조회와 같다). */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:quality-approvals:split', 0.4);
  const { session } = useSession();
  /* 셸 탭 막대 대신 이 화면이 탭을 그리므로 권한 거르기도 여기서 한다(`inlineTabs`). */
  const canOpenIqcSkip = toWebAccess(session?.permissions).allows(IQC_SKIP_APPROVAL_PATH);
  const filters = useMemo(
    () => readFilters(searchParams, approvalTypeCodes, statusCodes),
    [approvalTypeCodes, searchParams, statusCodes],
  );
  const pendingOnly = readPendingOnly(searchParams);
  const page = readPage(searchParams);
  const selectedId = readSelectedRequestId(searchParams);
  const scopeWarning = approvalScopeWarning(approvalTypeCodes);
  const query = toRequestListQuery(filters, pendingOnly, page);
  const list = useApprovalRequests(query);
  const detail = useApprovalRequestDetail(selectedId);
  /* OQC 생략(#119)은 특채가 아니다 — 연결 조건(특채)을 묻지도, 요구하지도 않는다. */
  const isOqcSkip = String(detail.data?.request.approvalTypeCode) === OQC_SKIP;
  const conditionCandidates = useConcessionCandidates(
    isOqcSkip ? null : (detail.data?.request.approvalRequestId ?? null),
  );
  const detailError = detail.isError ? toApiError(detail.error) : null;
  const isDetailNotFound = detailError?.kind === 'http' && detailError.status === 404;
  const listContextKey = withSelectedRequest(searchParams, null).toString();
  const [missingContextKey, setMissingContextKey] = useState<string | null>(null);
  const items = list.data?.items ?? EMPTY_ITEMS;
  const rows = useMemo(() => items.map(toRequestRow), [items]);
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [localCommentError, setLocalCommentError] = useState<string | null>(null);
  const [dialogDraft, setDialogDraft] = useState<DecisionVariables | null>(null);
  const [writeTargetId, setWriteTargetId] = useState<number | null>(null);
  const sentDecisionRef = useRef<Pick<DecisionVariables, 'action' | 'approvalRequestId'> | null>(
    null,
  );
  const actionLockReasonId = useId();
  const hasSafeCondition =
    isOqcSkip ||
    (selectedId !== null &&
      conditionCandidates.data !== undefined &&
      !conditionCandidates.isError &&
      toConcessionCardinality(selectedId, conditionCandidates.data).kind === 'one');

  const decisionWrite = useMasterWrite<DecisionVariables, ApprovalRequestDetail>({
    request: (variables, headers) => {
      const params = {
        path: { approvalRequestId: variables.approvalRequestId },
        header: {
          'Idempotency-Key': headers['Idempotency-Key'],
          'If-Match': headers['If-Match'] ?? '',
        },
      };

      return variables.action === 'approve'
        ? client.POST('/app/approval-requests/{approvalRequestId}:approve', {
            params,
            body: { comment: variables.comment },
          })
        : client.POST('/app/approval-requests/{approvalRequestId}:reject', {
            params,
            body: { comment: variables.comment },
          });
    },
    etagPath: selectedId === null ? null : requestDetailPath(selectedId),
    invalidateKeys: [qualityApprovalKeys.all],
    knownFields: ['comment'],
    keyLifetime: 'until-applied',
    onSuccess: (saved) => {
      const sent = sentDecisionRef.current;
      if (sent !== null)
        queryClient.setQueryData(qualityApprovalKeys.detail(sent.approvalRequestId), saved);
      toast.show({
        variant: 'success',
        description: sent?.action === 'reject' ? t.approval.rejectSuccess : t.approval.success,
      });
      setDialogDraft(null);
      setComment('');
      setLocalCommentError(null);
    },
  });
  const isWriteResultCurrent = writeTargetId === selectedId;
  const hasUncertainWrite = decisionWrite.error?.kind === 'network';
  const writeError = isWriteResultCurrent ? decisionWrite.error : null;
  const serverCommentError = isWriteResultCurrent ? decisionWrite.fieldErrors.comment : undefined;
  let actionLockReason: string | undefined;
  if (decisionWrite.isSaving) actionLockReason = t.approval.savingReason;
  else if (hasUncertainWrite) actionLockReason = t.approval.uncertainOtherTarget;
  else if (detail.data?.request.isMyTurn === false) actionLockReason = t.approval.notMyTurnReason;
  else if (!hasSafeCondition) actionLockReason = t.approval.conditionRequired;

  useEffect(() => {
    setComment('');
    setLocalCommentError(null);
    setDialogDraft(null);
  }, [selectedId]);

  useEffect(() => {
    if (writeError !== null || serverCommentError !== undefined) setDialogDraft(null);
  }, [serverCommentError, writeError]);

  useEffect(() => {
    if (!isDetailNotFound) return;

    setMissingContextKey(listContextKey);
    setSearchParams((current) => withSelectedRequest(current, null), { replace: true });
  }, [isDetailNotFound, listContextKey, setSearchParams]);

  const isDetailMissing = selectedId === null && missingContextKey === listContextKey;

  const apply = (nextFilters: RequestFilters, nextPendingOnly: boolean, nextPage = 1): void => {
    setSearchParams((current) =>
      toAppliedSearchParams(current, nextFilters, nextPendingOnly, nextPage),
    );
  };
  const reloadDetail = async (resolveUnknown = false): Promise<void> => {
    const reloadTargetId = selectedId;
    await detail.refetch();
    if (
      resolveUnknown &&
      reloadTargetId !== null &&
      reloadTargetId === writeTargetId &&
      queryClient.getQueryState(qualityApprovalKeys.detail(reloadTargetId))?.status === 'success'
    )
      decisionWrite.reset();
  };

  let error = null;
  if (list.isError) {
    const apiError = toApiError(list.error);
    const forbidden = apiError.kind === 'http' && apiError.status === 403;
    const description = describeLoadError(apiError);

    error = (
      <div className="banner-slot">
        <AlertBanner
          variant="error"
          title={forbidden ? messages.httpError.title : messages.httpError.loadTitle}
          action={
            forbidden ? undefined : (
              <Button variant="outlined" size="sm" onClick={() => void list.refetch()}>
                {messages.common.retry}
              </Button>
            )
          }
        >
          {description}
        </AlertBanner>
      </div>
    );
  }

  const detailSlot = (): ReactNode => {
    if (detail.isPending) {
      return (
        <div role="status" aria-label={t.detail.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    if (detailError !== null) {
      if (isDetailNotFound) {
        return (
          <EmptyState
            size="sm"
            live
            title={t.detail.notFound}
            description={t.detail.notFoundDescription}
          />
        );
      }

      const forbidden = detailError.kind === 'http' && detailError.status === 403;
      return (
        <AlertBanner
          variant="error"
          title={forbidden ? messages.httpError.title : messages.httpError.loadTitle}
          action={
            forbidden ? undefined : (
              <Button
                variant="outlined"
                size="sm"
                onClick={() => void reloadDetail(hasUncertainWrite)}
              >
                {messages.common.retry}
              </Button>
            )
          }
        >
          {describeLoadError(detailError)}
        </AlertBanner>
      );
    }

    return detail.data === undefined ? null : (
      <>
        <DetailPane view={toRequestDetailView(detail.data.request)} />
        {/* OQC 생략(#119)은 연결 조건이 없다 — 승인 뒤 실행할 화면을 알린다(공유계약 J-8). */}
        {isOqcSkip ? (
          <AlertBanner variant="info" title={t.detail.oqcSkipNote}>
            <Link to="/shipment/oqc-inspection">{t.detail.openOqcInspection}</Link>
          </AlertBanner>
        ) : (
          <ConditionPane approvalRequestId={detail.data.request.approvalRequestId} />
        )}
      </>
    );
  };

  const progressSlot = (): ReactNode => {
    if (selectedId === null) return null;

    if (detail.isPending) {
      return (
        <div role="status" aria-label={t.progress.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    if (detailError !== null) {
      return <EmptyState size="sm" title={t.progress.unavailable} />;
    }

    if (detail.data === undefined) return null;

    return <ProgressPane view={toApprovalProgressView(detail.data)} />;
  };

  /* 승인 처리 — 결재 진행과 갈라 요청 상세 옆 칸에 선다(#144). 상세가 서야 선다. */
  const actionSlot = (): ReactNode => {
    if (selectedId === null || detail.isPending || detailError !== null) return null;
    if (detail.data === undefined) return null;

    const openDecisionDialog = (action: DecisionAction): void => {
      const trimmed = comment.trim();
      if (trimmed === '') {
        setLocalCommentError(
          action === 'reject' ? t.approval.rejectCommentRequired : t.approval.commentRequired,
        );
        return;
      }
      if (actionLockReason !== undefined) return;

      setLocalCommentError(null);
      setDialogDraft({ action, approvalRequestId: selectedId, comment: trimmed });
    };
    return (
      <>
        <ApprovalActionPane
          comment={comment}
          commentError={localCommentError ?? serverCommentError}
          lockReason={actionLockReason}
          lockReasonId={actionLockReasonId}
          writeError={writeError}
          onApprove={() => openDecisionDialog('approve')}
          onCommentChange={(value) => {
            setComment(value);
            setLocalCommentError(null);
            decisionWrite.clearFieldError('comment');
          }}
          onReject={() => openDecisionDialog('reject')}
          onReload={() => void reloadDetail()}
          onReloadUnknown={() => void reloadDetail(true)}
        />
      </>
    );
  };

  const confirmDecision = (): void => {
    if (
      dialogDraft === null ||
      selectedId !== dialogDraft.approvalRequestId ||
      detail.data === undefined ||
      detail.isError ||
      actionLockReason !== undefined
    ) {
      setDialogDraft(null);
      return;
    }

    sentDecisionRef.current = dialogDraft;
    setWriteTargetId(dialogDraft.approvalRequestId);
    decisionWrite.write(dialogDraft);
  };

  return (
    <>
      {/*
       * 입하 예정 조회와 같은 짜임(#186) — 제목·경로 없이 유형 탭이 맨 위, 조회 조건은 따로 한 구획,
       * 그 아래 왼쪽 목록 | 오른쪽 상세가 나란히 서고 가운데 막대로 폭을 나눈다(창이 좁으면 위아래로 쌓인다).
       * 유형 탭을 누르면 고른 요청을 비우고(`apply`) 그 유형의 목록을 연다.
       */}
      <TypeTabs
        options={toTypeTabOptions(approvalTypeCodes, canOpenIqcSkip)}
        value={filters.approvalTypeCode}
        onChange={(code) => {
          /* 「IQC (수입검사) 생략」 탭은 긴급 IQC 생략 한도승인 화면이다 — 그 화면으로 옮긴다. */
          if (code === IQC_SKIP_TYPE_CODE) void navigate(IQC_SKIP_APPROVAL_PATH);
          else apply({ ...filters, approvalTypeCode: code }, pendingOnly);
        }}
      />
      <section ref={aboveRef} className="pane po-board-filter" aria-label={t.panes.filter}>
        <FilterBar
          applied={filters}
          statusOptions={toCodeOptions(statusCodes)}
          pendingOnly={pendingOnly}
          onApply={(next) => apply(next, pendingOnly)}
          onTogglePendingOnly={(next) => apply(filters, next)}
          onReset={() => apply(EMPTY_FILTERS, PENDING_ONLY_DEFAULT)}
        />
      </section>
      <div ref={splitRef} className="po-board-split" style={split.style}>
        <section
          className="pane po-board-pane po-board-scroll quality-approval-pane quality-approval-list-pane"
          aria-label={t.panes.list}
        >
          {scopeWarning !== undefined && (
            <div className="banner-slot">
              <AlertBanner variant="info">{scopeWarning}</AlertBanner>
            </div>
          )}
          {/* 열려던 요청이 없어 선택이 풀렸다 — 왜 풀렸는지 목록 위에서 알린다. */}
          {isDetailMissing && (
            <div className="banner-slot">
              <AlertBanner variant="info" title={t.detail.notFound}>
                {t.detail.notFoundDescription}
              </AlertBanner>
            </div>
          )}
          <RequestList
            rows={rows}
            isLoading={list.isPending}
            error={error}
            page={pageView}
            selectedId={selectedId}
            onSelect={(id) => {
              setMissingContextKey(null);
              setSearchParams((current) => withSelectedRequest(current, id));
            }}
            onChangePage={(nextPage) => apply(filters, pendingOnly, nextPage)}
          />
        </section>

        <PaneSplitter label={t.splitter} ratio={split.ratio} onChange={split.commit} />

        {/*
         * 오른쪽 — 위에서 아래로 읽는다: 결재 진행(가로 단계) → 요청 상세 | 승인 처리.
         * 무엇을 결재하는지 보고 바로 옆에서 결재한다. 고르기 전에는 고르라는 안내만 선다.
         */}
        <div className="pane po-board-pane po-board-scroll quality-approval-side">
          {selectedId === null ? (
            <EmptyState
              size="sm"
              title={t.detail.noSelectionTitle}
              description={t.detail.noSelectionDescription}
            />
          ) : (
            <>
              <section
                className="quality-approval-block quality-approval-progress-pane"
                aria-label={t.panes.progress}
              >
                {progressSlot()}
              </section>
              <div className="quality-approval-workspace">
                <section className="quality-approval-block" aria-label={t.panes.detail}>
                  <div className="pane-heading-row quality-approval-detail-heading">
                    <h2 className="pane-title">{t.panes.detail}</h2>
                    {/* 상태는 제목 줄 오른쪽 배지로(#144) — 대기 주황 · 승인 초록 · 반려 빨강. */}
                    {detail.data !== undefined && !detail.isError && (
                      <Chip size="sm" status={statusBadgeOf(detail.data.request.statusCode).tone}>
                        {statusBadgeOf(detail.data.request.statusCode).label}
                      </Chip>
                    )}
                  </div>
                  {detailSlot()}
                </section>
                {actionSlot() !== null && (
                  <section className="quality-approval-block" aria-label={t.approval.title}>
                    {actionSlot()}
                  </section>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {dialogDraft !== null &&
        selectedId === dialogDraft.approvalRequestId &&
        !detail.isError &&
        (dialogDraft.action === 'approve' ? (
          <ApproveDialog
            approvalTypeCode={detail.data?.request.approvalTypeCode ?? ''}
            comment={dialogDraft.comment}
            isSaving={decisionWrite.isSaving}
            requestNo={detail.data?.request.approvalRequestNo ?? ''}
            targetName={
              detail.data === undefined ? '' : toRequestDetailView(detail.data.request).targetName
            }
            onCancel={() => {
              if (!decisionWrite.isSaving) setDialogDraft(null);
            }}
            onConfirm={confirmDecision}
          />
        ) : (
          <RejectDialog
            approvalTypeCode={detail.data?.request.approvalTypeCode ?? ''}
            comment={dialogDraft.comment}
            isSaving={decisionWrite.isSaving}
            requestNo={detail.data?.request.approvalRequestNo ?? ''}
            targetName={
              detail.data === undefined ? '' : toRequestDetailView(detail.data.request).targetName
            }
            onCancel={() => {
              if (!decisionWrite.isSaving) setDialogDraft(null);
            }}
            onConfirm={confirmDecision}
          />
        ))}
    </>
  );
};
