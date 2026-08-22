import { AlertBanner, Breadcrumb, Button, PageHeader } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import {
  QUALITY_APPROVAL_STATUS_CODES,
  QUALITY_APPROVAL_TYPE_CODES,
  approvalScopeWarning,
  toCodeOptions,
} from './code-options';
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
import { useApprovalRequests } from './queries';
import { RequestList } from './request-list';
import { toRequestRow, type ApprovalRequest } from './types';

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
  const items = list.data?.items ?? EMPTY_ITEMS;
  const rows = useMemo(() => items.map(toRequestRow), [items]);
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

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

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
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
            setSearchParams((current) =>
              withSelectedRequest(current, selectedId === id ? null : id),
            );
          }}
          onChangePage={(nextPage) => apply(filters, pendingOnly, nextPage)}
        />
      </section>
    </>
  );
};
