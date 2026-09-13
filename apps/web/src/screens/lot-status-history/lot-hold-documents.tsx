import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { useLotActorOptions, useLotHolds } from './queries';
import type { LotHoldView } from './types';

const t = messages.lotStatusHistory;
const EMPTY = '—';

const formatDateTime = (value: string | null): string => {
  if (value === null) return EMPTY;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};

export const LotHoldDocuments = ({ lotId }: { lotId: number }) => {
  const [page, setPage] = useState(1);
  const holds = useLotHolds(lotId, page);
  const actors = useLotActorOptions(true);
  const actorName = (id: number | null): string => {
    if (id === null) return EMPTY;
    const actor = actors.data?.items.find((item) => item.appUserId === id);
    if (actor === undefined) return actors.isPending ? t.holdDocuments.actorPending : String(id);
    return actor.userName === '' ? actor.loginId : actor.userName;
  };
  const columns: Column<LotHoldView>[] = [
    {
      key: 'times',
      header: t.holdDocuments.columns.times,
      render: (row) => (
        <span className="field-cell">
          <span>{formatDateTime(row.heldAt)}</span>
          <span>{actorName(row.heldBy)}</span>
          {row.releasedAt !== null && <span>{formatDateTime(row.releasedAt)}</span>}
          {row.releasedAt !== null && <span>{actorName(row.releasedBy)}</span>}
        </span>
      ),
    },
    { key: 'reasonCode', header: t.holdDocuments.columns.reason },
    {
      key: 'holdStatusCode',
      header: t.holdDocuments.columns.holdStatus,
      render: (row) => (
        <Chip variant="status" size="sm">
          {row.holdStatusCode}
        </Chip>
      ),
    },
    {
      key: 'holdQty',
      header: t.holdDocuments.columns.holdQty,
      align: 'end',
      render: (row) => (row.holdQty === null ? t.holdDocuments.fullQty : String(row.holdQty)),
    },
    {
      key: 'releaseCondition',
      header: t.holdDocuments.columns.releaseCondition,
      render: (row) => row.releaseCondition ?? EMPTY,
    },
  ];
  const rows = [...(holds.data?.rows ?? [])];
  const meta = holds.data?.page;
  const serverPage = meta?.page;
  useEffect(() => {
    if (
      !holds.isPlaceholderData &&
      serverPage !== undefined &&
      serverPage >= 1 &&
      serverPage !== page
    ) {
      setPage(serverPage);
    }
  }, [holds.isPlaceholderData, page, serverPage]);
  const currentPage = meta !== undefined && meta.page > 0 ? meta.page : page;
  const pageSize = meta !== undefined && meta.size > 0 ? meta.size : 1;
  const totalPages = Math.max(1, Math.ceil((meta?.total ?? 0) / pageSize));
  const start = (currentPage - 1) * pageSize + 1;
  const range =
    meta === undefined
      ? ''
      : rows.length === 0
        ? t.range.total(String(meta.total))
        : t.range.span(String(start), String(start + rows.length - 1), String(meta.total));
  const actorsLimited =
    actors.isError ||
    (actors.data !== undefined && actors.data.page.total > actors.data.items.length);

  return (
    <section aria-labelledby="lot-hold-documents-title">
      <h3 id="lot-hold-documents-title">{t.holdDocuments.pane}</h3>
      <AlertBanner variant="info">{t.scopeNotice}</AlertBanner>
      {holds.isPending && (
        <div role="status" aria-label={t.holdDocuments.loading}>
          <SkeletonText lines={3} />
        </div>
      )}
      {holds.isError && (
        <AlertBanner
          variant="error"
          title={t.holdDocuments.failed}
          action={
            <Button
              variant="outlined"
              size="sm"
              aria-label={t.actions.retryLabel(t.holdDocuments.pane)}
              onClick={() => void holds.refetch()}
            >
              {t.actions.retry}
            </Button>
          }
        />
      )}
      {holds.data !== undefined && (
        <>
          {holds.isFetching && (
            <p className="field-note" role="status">
              {t.holdDocuments.refreshingText}
            </p>
          )}
          <div className="wide-table" aria-busy={holds.isFetching}>
            <Table
              density="compact"
              caption={t.holdDocuments.pane}
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.lotHoldId)}
              empty={<EmptyState size="sm" title={t.holdDocuments.empty} />}
            />
          </div>
          {meta !== undefined && (
            <nav className="form-actions" aria-label={t.holdDocuments.pagination}>
              <p className="field-note form-actions-secondary">{range}</p>
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                {t.actions.previousPage}
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                {t.actions.nextPage}
              </Button>
            </nav>
          )}
        </>
      )}
      {actorsLimited && <p className="field-note">{t.holdDocuments.actorsLimited}</p>}
    </section>
  );
};
