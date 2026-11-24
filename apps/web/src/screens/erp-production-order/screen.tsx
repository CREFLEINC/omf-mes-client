import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { PageNav } from '../../patterns/page-nav';
import { ERP_DATA_ORIENTATION_KEY } from '../erp-item/erp-data-parts';
import { ErpProductionOrderFilterBar } from './filter-bar';
import { ProgressHubChips } from './progress';
import {
  DEFAULT_FILTERS,
  LIST_PAGE_SIZE,
  LIST_PAGE_SIZES,
  type ListPageSize,
  readFilters,
  readPage,
  readSize,
  toListQuery,
  toSearchParams,
} from './filters';
import { ErpProductionOrderDetail, ErpProductionOrderListPane } from './list-pane';
import { useItemNames, useStatusLookup, useStorageLocationNames, useUomLookup } from './lookups';
import { useErpProductionOrderList } from './queries';
import type { ErpProductionOrder } from './types';

const t = messages.erpProductionOrder;
const EMPTY_ROWS: ErpProductionOrder[] = [];

/**
 * ERP W/O 조회(W-06-23 · 시스템 관리 > ERP 연동 현황·이력의 한 탭) — ERP 가 보낸 W/O 를
 * **받은 그대로 읽기만** 한다. 탭 줄은 셸이 그린다.
 *
 * 조회 조건 · 목록 | 상세 통일 배치(omf-all-around#358): 목록은 식별 열만, 고른 W/O 의 모든 칸은 오른쪽 상세에
 * 「이름 : 값」으로(같은 목록 응답만 쓴다). 조건·쪽은 전부 주소가 소유하고, 고른 줄은 화면만 기억한다.
 * **쓰기 조작도, 계획(전개·편성)으로 넘어가는 길도 없다** — 그 일은 MES 작업 화면(W-02-01)이 한다. 읽기 전용 안내
 * 문구는 두지 않는다(사용자 지시 2026-10-27).
 */
export const ErpProductionOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const size = readSize(searchParams);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const list = useErpProductionOrderList(toListQuery(filters, page, size));
  const status = useStatusLookup();
  const storageLocationOf = useStorageLocationNames();
  const uoms = useUomLookup();

  const rows = list.data?.items ?? EMPTY_ROWS;
  const itemNameOf = useItemNames(rows.map((row) => row.itemId));
  const meta = list.data?.page ?? { page, size: size ?? LIST_PAGE_SIZE, total: 0 };
  const isBeyondLast =
    meta.total > 0 && meta.page > Math.ceil(meta.total / (meta.size > 0 ? meta.size : 1));
  const selected = rows.find((row) => row.productionOrderId === selectedId) ?? null;
  const names = {
    itemNameOf,
    uomNameOf: uoms.nameOf,
    storageLocationOf,
    statusNameOf: status.nameOf,
  };

  return (
    <ListDetailWorkspace
      storageKey="omf-mes:erp-production-order"
      orientationKey={ERP_DATA_ORIENTATION_KEY}
      initialRatio={0.55}
      filter={{
        label: t.panes.filters,
        content: (
          <>
            {/* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다. */}
            {list.isError && (
              <AlertBanner variant="error" title={t.listLoadFailedTitle}>
                {t.loadFailedDescription}
              </AlertBanner>
            )}
            {/* 진행 「전체 · 미완료 · 완료」는 탭 줄 위 라벨(사용자 지시 2026-11-24). */}
            <ProgressHubChips
              value={filters.progress}
              onChange={(progress) =>
                setSearchParams(toSearchParams({ ...filters, progress }, 1, size))
              }
            />
            <ErpProductionOrderFilterBar
              appliedFilters={filters}
              statusOptions={status.options}
              onSearch={(next) => setSearchParams(toSearchParams(next, 1, size))}
              onReset={() => setSearchParams(toSearchParams(DEFAULT_FILTERS, 1, size))}
            />
          </>
        ),
      }}
      list={{
        label: t.panes.list,
        title: t.panes.list,
        count: list.data?.page.total,
        content: list.isError ? null : (
          <>
            <ErpProductionOrderListPane
              rows={rows}
              isLoading={list.isPending}
              isBeyondLast={isBeyondLast}
              selectedId={selectedId}
              onSelect={(row) => {
                setSelectedId(row.productionOrderId);
              }}
              {...names}
            />
            {!list.isPending && (
              <PageNav<ListPageSize>
                meta={meta}
                sizes={LIST_PAGE_SIZES}
                buttonSize="md"
                onChangePage={(nextPage) =>
                  setSearchParams(toSearchParams(filters, nextPage, size))
                }
                onChangeSize={(nextSize) => setSearchParams(toSearchParams(filters, 1, nextSize))}
              />
            )}
          </>
        ),
      }}
      detail={{
        label: t.panes.detail,
        content: <ErpProductionOrderDetail row={selected} {...names} />,
      }}
    />
  );
};
