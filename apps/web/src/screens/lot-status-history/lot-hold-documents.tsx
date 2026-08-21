import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { useEffect, useState } from 'react';

import { useLotActorOptions, useLotHolds } from './queries';
import type { LotHoldView } from './types';

const EMPTY = '—';
const HISTORY_NOTICE = '보류 등록·해제 이력만 표시하며 전체 상태 전이는 기록되지 않습니다.';

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
    if (actor === undefined) return actors.isPending ? '확인 중…' : String(id);
    return actor.userName === '' ? actor.loginId : actor.userName;
  };
  const columns: Column<LotHoldView>[] = [
    {
      key: 'times',
      header: '등록·해제',
      render: (row) => (
        <span className="field-cell">
          <span>{formatDateTime(row.heldAt)}</span>
          <span>{actorName(row.heldBy)}</span>
          {row.releasedAt !== null && <span>{formatDateTime(row.releasedAt)}</span>}
          {row.releasedAt !== null && <span>{actorName(row.releasedBy)}</span>}
        </span>
      ),
    },
    { key: 'reasonCode', header: '사유' },
    {
      key: 'holdStatusCode',
      header: '보류 건 상태',
      render: (row) => (
        <Chip variant="status" size="sm">
          {row.holdStatusCode}
        </Chip>
      ),
    },
    {
      key: 'holdQty',
      header: '보류 수량',
      align: 'end',
      render: (row) => (row.holdQty === null ? '전량' : String(row.holdQty)),
    },
    {
      key: 'releaseCondition',
      header: '해제 조건',
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
        ? `전체 ${meta.total}건`
        : `${start}–${start + rows.length - 1} / 전체 ${meta.total}건`;
  const actorsLimited =
    actors.isError ||
    (actors.data !== undefined && actors.data.page.total > actors.data.items.length);

  return (
    <section aria-labelledby="lot-hold-documents-title">
      <h3 id="lot-hold-documents-title">보류 문서</h3>
      <AlertBanner variant="info">{HISTORY_NOTICE}</AlertBanner>
      {holds.isPending && (
        <div role="status" aria-label="보류 문서를 불러오는 중">
          <SkeletonText lines={3} />
        </div>
      )}
      {holds.isError && (
        <AlertBanner
          variant="error"
          title="보류 문서를 불러오지 못했습니다."
          action={
            <Button
              variant="outlined"
              size="sm"
              aria-label="보류 문서 다시 시도"
              onClick={() => void holds.refetch()}
            >
              다시 시도
            </Button>
          }
        />
      )}
      {holds.data !== undefined && (
        <>
          {holds.isFetching && (
            <p className="field-note" role="status">
              보류 문서를 갱신하는 중입니다.
            </p>
          )}
          <div className="wide-table" aria-busy={holds.isFetching}>
            <Table
              density="compact"
              caption="보류 문서"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.lotHoldId)}
              empty={<EmptyState size="sm" title="보류 문서가 없습니다" />}
            />
          </div>
          {meta !== undefined && (
            <nav className="form-actions" aria-label="보류 문서 쪽 이동">
              <p className="field-note form-actions-secondary">{range}</p>
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                이전 쪽
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                다음 쪽
              </Button>
            </nav>
          )}
        </>
      )}
      {actorsLimited && (
        <p className="field-note">일부 행위자 이름을 확인하지 못해 사용자 번호를 표시합니다.</p>
      )}
    </section>
  );
};
