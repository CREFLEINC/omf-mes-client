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

import { codeName, useLotHoldReasonOptions } from './options';
import { useUomCodeOf, withUom } from './uoms';
import { useLotActorOptions, useLotHolds } from './queries';
import type { LotHoldView } from './types';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav } from '../../patterns/page-nav';
import { LOT_PAGE_SIZES, type LotPageSize } from './filters';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.lotStatusHistory;
const EMPTY = '—';

const formatDateTime = (value: string | null): string => {
  if (value === null) return EMPTY;
  return formatPlantDateTime(value) ?? value;
};

export const LotHoldDocuments = ({
  lotId,
  focusedHoldId = null,
}: {
  lotId: number;
  /** 변경 이력의 보류 줄에서 넘어온 보류 건 — 그 줄을 파란 바탕으로 강조한다(사용자 2026-11-02). */
  focusedHoldId?: number | null;
}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<LotPageSize>(20);
  const holds = useLotHolds(lotId, page, pageSize);
  const actors = useLotActorOptions(true);
  const reasons = useLotHoldReasonOptions();
  const uomCodeOf = useUomCodeOf();
  const actorName = (id: number | null): string => {
    if (id === null) return EMPTY;
    const actor = actors.data?.items.find((item) => item.appUserId === id);
    if (actor === undefined) return actors.isPending ? t.holdDocuments.actorPending : String(id);
    return actor.userName === '' ? actor.loginId : actor.userName;
  };
  // ⭐ 표 머리와 모든 열 가운데 정렬(사용자 지시 2026-09-19).
  const withActor = (at: string, actorId: number | null): string =>
    actorId === null ? at : `${at} · ${actorName(actorId)}`;
  const columns: Column<LotHoldView>[] = [
    {
      key: 'times',
      header: t.holdDocuments.columns.times,
      align: 'center',
      /*
       * 등록과 해제를 줄마다 이름을 붙여 가른다 — 예전에는 네 값을 이름 없이 쌓아 어느 것이 해제인지
       * 읽히지 않았다(사용자 지시 2026-09-19). 처리한 사람은 등록자·해제자가 따로 있어 각 줄에 붙인다.
       */
      render: (row) => (
        <dl
          className="lot-hold-times"
          aria-current={row.lotHoldId === focusedHoldId ? 'true' : undefined}
        >
          <div>
            <dt>{t.holdDocuments.times.held}</dt>
            <dd>{withActor(formatDateTime(row.heldAt), row.heldBy)}</dd>
          </div>
          <div>
            <dt>{t.holdDocuments.times.released}</dt>
            <dd>
              {row.releasedAt === null
                ? EMPTY
                : withActor(formatDateTime(row.releasedAt), row.releasedBy)}
            </dd>
          </div>
        </dl>
      ),
    },
    {
      key: 'reasonCode',
      header: t.holdDocuments.columns.reason,
      align: 'center',
      render: (row) => codeName(reasons.data?.items, row.reasonCode),
    },
    {
      key: 'holdStatusCode',
      header: t.holdDocuments.columns.holdStatus,
      align: 'center',
      /*
       * 보류 건 상태는 해제 칸으로 가른다 — 계약이 정한 정본이다(LotHold.statusCode 설명 ·
       * 사용자 결정 2026-09-02). 내부 코드(HELD 등)를 그대로 보이지 않는다(사용자 지시 2026-09-19).
       */
      render: (row) => (
        <Chip variant="status" size="sm">
          {row.releasedAt === null
            ? t.holdDocuments.holdStates.open
            : t.holdDocuments.holdStates.released}
        </Chip>
      ),
    },
    {
      key: 'holdQty',
      header: t.holdDocuments.columns.holdQty,
      align: 'center',
      render: (row) =>
        row.holdQty === null
          ? t.holdDocuments.fullQty
          : withUom(String(row.holdQty), uomCodeOf(row.uomId)),
    },
    {
      key: 'releaseCondition',
      header: t.holdDocuments.columns.releaseCondition,
      align: 'center',
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
  /* 열 너비 끌기 · 열 순서 바꾸기 — LOT 목록 표와 같다(사용자 2026-10-30). */
  const ordered = useColumnOrder('omf-mes:lot-status:columns:holds:order', columns);
  const resizable = useColumnWidths('omf-mes:lot-status:columns:holds', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });
  const actorsLimited =
    actors.isError ||
    (actors.data !== undefined && actors.data.page.total > actors.data.items.length);

  /* LOT 상세의 탭 하나 — 제목은 탭이 단다(사용자 2026-10-30). */
  return (
    <section aria-label={t.holdDocuments.pane}>
      {holds.isPending && (
        <div role="status" aria-label={t.holdDocuments.loading}>
          <SkeletonText lines={3} />
        </div>
      )}
      {holds.isError && (
        <AlertBanner
          className="lot-detail-failure-banner"
          variant="error"
          title={t.holdDocuments.failed}
          action={
            <Button
              variant="outlined"
              size="sm"
              aria-label={t.detail.retryLabel(t.holdDocuments.pane)}
              onClick={() => void holds.refetch()}
            >
              {t.detail.retry}
            </Button>
          }
        />
      )}
      {holds.data !== undefined && meta !== undefined && (
        <>
          {holds.isFetching && (
            <p className="field-note" role="status">
              {t.holdDocuments.refreshingText}
            </p>
          )}
          <div
            ref={fit.ref}
            className="wide-table lot-status-table lot-detail-table"
            style={resizable.style}
            aria-busy={holds.isFetching}
          >
            <Table
              density="comfortable"
              caption={t.holdDocuments.pane}
              columns={fit.columns}
              rows={rows}
              getRowId={(row) => String(row.lotHoldId)}
              empty={<EmptyState size="sm" title={t.holdDocuments.empty} />}
            />
          </div>
          <PageNav
            sizes={LOT_PAGE_SIZES}
            controlSize="sm"
            buttonSize="md"
            meta={{
              page: currentPage,
              size: meta.size > 0 ? meta.size : pageSize,
              total: meta.total,
            }}
            onChangePage={setPage}
            onChangeSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      )}
      {actorsLimited && <p className="field-note">{t.holdDocuments.actorsLimited}</p>}
    </section>
  );
};
