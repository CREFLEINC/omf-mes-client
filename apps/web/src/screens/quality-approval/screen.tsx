import {
  AlertBanner,
  Breadcrumb,
  Button,
  Dialog,
  EmptyState,
  PageHeader,
  SkeletonText,
  useToast,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { TextArea } from '@omf-mes/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import {
  QUALITY_APPROVAL_STATUS_CODES,
  QUALITY_APPROVAL_TYPE_CODES,
  approvalScopeWarning,
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
import {
  qualityApprovalKeys,
  requestDetailPath,
  useApprovalRequestDetail,
  useApprovalRequests,
  useConcessionCandidates,
} from './queries';
import { RequestList } from './request-list';
import {
  toRequestDetailView,
  toRequestRow,
  type ApprovalRequest,
  type ApprovalRequestDetail,
} from './types';

const EMPTY_ITEMS: ApprovalRequest[] = [];
interface ApprovalVariables {
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
  const conditionCandidates = useConcessionCandidates(
    detail.data?.request.approvalRequestId ?? null,
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
  const [dialogDraft, setDialogDraft] = useState<ApprovalVariables | null>(null);
  const [writeTargetId, setWriteTargetId] = useState<number | null>(null);
  const sentIdRef = useRef<number | null>(null);
  const actionLockReasonId = useId();
  const hasSafeCondition =
    selectedId !== null &&
    conditionCandidates.data !== undefined &&
    !conditionCandidates.isError &&
    toConcessionCardinality(selectedId, conditionCandidates.data).kind === 'one';

  const approveWrite = useMasterWrite<ApprovalVariables, ApprovalRequestDetail>({
    request: (variables, headers) =>
      client.POST('/app/approval-requests/{approvalRequestId}:approve', {
        params: {
          path: { approvalRequestId: variables.approvalRequestId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: { comment: variables.comment },
      }),
    etagPath: selectedId === null ? null : requestDetailPath(selectedId),
    invalidateKeys: [qualityApprovalKeys.all],
    knownFields: ['comment'],
    keyLifetime: 'until-applied',
    onSuccess: (saved) => {
      const sentId = sentIdRef.current;
      if (sentId !== null) queryClient.setQueryData(qualityApprovalKeys.detail(sentId), saved);
      toast.show({ variant: 'success', description: t.approval.success });
      setDialogDraft(null);
      setComment('');
      setLocalCommentError(null);
    },
  });
  const isWriteResultCurrent = writeTargetId === selectedId;
  const hasUncertainOtherTarget = approveWrite.error?.kind === 'network' && !isWriteResultCurrent;
  const writeError = isWriteResultCurrent ? approveWrite.error : null;
  const serverCommentError = isWriteResultCurrent ? approveWrite.fieldErrors.comment : undefined;
  let actionLockReason: string | undefined;
  if (approveWrite.isSaving) actionLockReason = t.approval.savingReason;
  else if (hasUncertainOtherTarget) actionLockReason = t.approval.uncertainOtherTarget;
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
    if (selectedId === null) {
      return (
        <EmptyState
          size="sm"
          live={isDetailMissing}
          title={isDetailMissing ? t.detail.notFound : t.detail.select}
          description={isDetailMissing ? t.detail.notFoundDescription : undefined}
        />
      );
    }

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
              <Button variant="outlined" size="sm" onClick={() => void detail.refetch()}>
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
        <ConditionPane approvalRequestId={detail.data.request.approvalRequestId} />
      </>
    );
  };

  const progressSlot = (): ReactNode => {
    if (selectedId === null) return <EmptyState size="sm" title={t.detail.progressPending} />;

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

    const openApproveDialog = (): void => {
      const trimmed = comment.trim();
      if (trimmed === '') {
        setLocalCommentError(t.approval.commentRequired);
        return;
      }
      if (actionLockReason !== undefined) return;

      setLocalCommentError(null);
      setDialogDraft({ approvalRequestId: selectedId, comment: trimmed });
    };
    const reloadUnknownTarget = async (): Promise<void> => {
      await detail.refetch();
      if (queryClient.getQueryState(qualityApprovalKeys.detail(selectedId))?.status === 'success')
        approveWrite.reset();
    };
    return (
      <>
        <ProgressPane view={toApprovalProgressView(detail.data)} />
        <div role="group" aria-label={t.approval.title}>
          <SaveErrorBanner error={writeError} onReload={() => void detail.refetch()} />
          {writeError?.kind === 'network' && (
            <div className="form-actions">
              <p className="field-note">{t.approval.deliveryUnknown}</p>
              <Button variant="outlined" size="sm" onClick={() => void reloadUnknownTarget()}>
                {t.approval.reloadTarget}
              </Button>
            </div>
          )}
          <TextArea
            label={t.approval.commentLabel}
            value={comment}
            required
            fullWidth
            rows={4}
            disabled={actionLockReason !== undefined}
            aria-describedby={actionLockReason === undefined ? undefined : actionLockReasonId}
            error={localCommentError ?? serverCommentError}
            helperText={t.approval.commentHelp}
            onChange={(event) => {
              setComment(event.target.value);
              setLocalCommentError(null);
              approveWrite.clearFieldError('comment');
            }}
          />
          {actionLockReason !== undefined && (
            <p id={actionLockReasonId} className="field-note">
              {actionLockReason}
            </p>
          )}
          <div className="form-actions">
            <Button
              disabled={actionLockReason !== undefined}
              aria-describedby={actionLockReason === undefined ? undefined : actionLockReasonId}
              onClick={openApproveDialog}
            >
              {t.approval.approve}
            </Button>
          </div>
        </div>
      </>
    );
  };

  const confirmApprove = (): void => {
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

    sentIdRef.current = dialogDraft.approvalRequestId;
    setWriteTargetId(dialogDraft.approvalRequestId);
    approveWrite.write(dialogDraft);
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      <div className="three-pane">
        <section className="pane" aria-label={t.panes.list}>
          <FilterBar
            applied={filters}
            typeOptions={toCodeOptions(approvalTypeCodes)}
            statusOptions={toCodeOptions(statusCodes)}
            pendingOnly={pendingOnly}
            onApply={(next) => apply(next, pendingOnly)}
            onTogglePendingOnly={(next) => apply(filters, next)}
            onReset={() => apply(EMPTY_FILTERS, PENDING_ONLY_DEFAULT)}
          />
          {scopeWarning !== undefined && (
            <div className="banner-slot">
              <AlertBanner variant="info">{scopeWarning}</AlertBanner>
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
              setSearchParams((current) =>
                withSelectedRequest(current, selectedId === id ? null : id),
              );
            }}
            onChangePage={(nextPage) => apply(filters, pendingOnly, nextPage)}
          />
        </section>
        <section className="pane" aria-label={t.panes.detail}>
          {detailSlot()}
        </section>
        <section className="pane" aria-label={t.panes.progress}>
          {progressSlot()}
        </section>
      </div>
      {dialogDraft !== null && selectedId === dialogDraft.approvalRequestId && !detail.isError && (
        <Dialog
          open
          title={t.approval.dialogTitle}
          size="sm"
          closeOnBackdropClick={false}
          showCloseButton={false}
          onClose={() => {
            if (!approveWrite.isSaving) setDialogDraft(null);
          }}
          footer={
            <>
              <Button
                variant="outlined"
                disabled={approveWrite.isSaving}
                onClick={() => setDialogDraft(null)}
              >
                {messages.common.cancel}
              </Button>
              <Button
                loading={approveWrite.isSaving}
                disabled={approveWrite.isSaving}
                onClick={confirmApprove}
              >
                {t.approval.approve}
              </Button>
            </>
          }
        >
          <p>{`${t.fields.approvalRequestNo}: ${detail.data?.request.approvalRequestNo ?? ''}`}</p>
          <p>{`${t.fields.approvalTypeCode}: ${detail.data?.request.approvalTypeCode ?? ''}`}</p>
          <p>{`${t.fields.target}: ${
            detail.data === undefined ? '' : toRequestDetailView(detail.data.request).targetName
          }`}</p>
          <p className="field-label">{t.approval.commentHeading}</p>
          <p>{dialogDraft.comment}</p>
          <p>{t.approval.stateOnly}</p>
          <p>{t.approval.irreversible}</p>
        </Dialog>
      )}
    </>
  );
};
