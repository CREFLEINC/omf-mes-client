import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import {
  QUALITY_APPROVAL_STATUS_CODES,
  QUALITY_APPROVAL_TYPE_CODES,
  approvalScopeWarning,
  toCodeOptions,
} from './code-options';
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
import { useApprovalRequestDetail, useApprovalRequests } from './queries';
import { RequestList } from './request-list';
import { toRequestDetailView, toRequestRow, type ApprovalRequest } from './types';

const EMPTY_ITEMS: ApprovalRequest[] = [];

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
  const detailError = detail.isError ? toApiError(detail.error) : null;
  const isDetailNotFound = detailError?.kind === 'http' && detailError.status === 404;
  const listContextKey = withSelectedRequest(searchParams, null).toString();
  const [missingContextKey, setMissingContextKey] = useState<string | null>(null);
  const items = list.data?.items ?? EMPTY_ITEMS;
  const rows = useMemo(() => items.map(toRequestRow), [items]);
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

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
      <DetailPane view={toRequestDetailView(detail.data.request)} />
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

    return detail.data === undefined ? null : (
      <ProgressPane view={toApprovalProgressView(detail.data)} />
    );
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
    </>
  );
};
