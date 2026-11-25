import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PageNav } from '../../patterns/page-nav';
import { useFitToViewport } from '../../patterns/po-board';
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
import { ErpProductionOrderListPane } from './list-pane';
import { useItemNames, useStatusLookup, useStorageLocationNames, useUomLookup } from './lookups';
import { useErpProductionOrderList } from './queries';
import type { ErpProductionOrder } from './types';

const t = messages.erpProductionOrder;
const EMPTY_ROWS: ErpProductionOrder[] = [];

/**
 * ERP W/O 조회(W-06-23 · 시스템 관리 > ERP 연동 현황·이력의 한 탭) — ERP 가 보낸 W/O 를
 * **받은 그대로 읽기만** 한다. 탭 줄은 셸이 그린다.
 *
 * 조회 조건 · 목록 한 상자(omf-all-around#358): W/O 의 모든 칸이 목록 열로 보인다 — 상세 칸 · 줄 고르기는 없다
 * (사용자 지시 2026-11-25 · ERP 사원 · 품목 · 거래처 탭과 같다). 조건·쪽은 전부 주소가 소유한다.
 * **쓰기 조작도, 계획(전개·편성)으로 넘어가는 길도 없다** — 그 일은 MES 작업 화면(W-02-01)이 한다. 읽기 전용 안내
 * 문구는 두지 않는다(사용자 지시 2026-10-27).
 */
export const ErpProductionOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const size = readSize(searchParams);
  /* 목록이 창 바닥에서 멈추게 윗변을 잰다(ERP 사원 · 품목 · 거래처 탭과 같은 아래 여백). */
  const { splitRef, aboveRef } = useFitToViewport();

  const list = useErpProductionOrderList(toListQuery(filters, page, size));
  /* 진행 라벨의 건수 — 같은 조건에 진행만 바꿔 총 건수만 읽는다(한 줄만 받는다 · 사용자 지시 2026-11-24). */
  const openCount = useErpProductionOrderList({
    ...toListQuery({ ...filters, progress: 'open' }, 1),
    size: 1,
  });
  const doneCount = useErpProductionOrderList({
    ...toListQuery({ ...filters, progress: 'done' }, 1),
    size: 1,
  });
  const status = useStatusLookup();
  const storageLocationOf = useStorageLocationNames();
  const uoms = useUomLookup();

  const rows = list.data?.items ?? EMPTY_ROWS;
  const itemNameOf = useItemNames(rows.map((row) => row.itemId));
  const meta = list.data?.page ?? { page, size: size ?? LIST_PAGE_SIZE, total: 0 };
  const isBeyondLast =
    meta.total > 0 && meta.page > Math.ceil(meta.total / (meta.size > 0 ? meta.size : 1));
  const names = {
    itemNameOf,
    uomNameOf: uoms.nameOf,
    storageLocationOf,
    statusNameOf: status.nameOf,
  };

  /*
   * 조회 상자 + 목록 한 상자 — 상세 칸은 두지 않는다(목록에 같은 값이 모두 열로 있다). ERP 사원 · 품목 · 거래처 탭과
   * 같은 짜임이다(사용자 지시 2026-11-25). 줄 고르기도 없다 — 고를 상세가 없다.
   */
  return (
    <div className="list-detail-workspace">
      <section
        ref={aboveRef}
        className="pane po-board-filter list-detail-filter"
        aria-label={t.panes.filters}
      >
        {/* 진행 「미완료 N · 완료 N」은 탭 줄 위 라벨(사용자 지시 2026-11-24). */}
        <ProgressHubChips
          value={filters.progress}
          counts={{ open: openCount.data?.page.total, done: doneCount.data?.page.total }}
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
      </section>
      <div ref={splitRef} className="po-board-split list-detail-split erp-data-list-only-split">
        <section className="pane list-detail-list" aria-label={t.panes.list}>
          <div className="po-board-list-head">
            <h2 className="pane-title">{t.panes.list}</h2>
            {list.data !== undefined && (
              <span className="po-board-list-count">
                {messages.common.paneList.count(list.data.page.total)}
              </span>
            )}
          </div>
          {/* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다. 배너는 목록 상자 안. */}
          {list.isError ? (
            <AlertBanner variant="error" title={t.listLoadFailedTitle}>
              {t.loadFailedDescription}
            </AlertBanner>
          ) : (
            <>
              <ErpProductionOrderListPane
                rows={rows}
                isLoading={list.isPending}
                isBeyondLast={isBeyondLast}
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
          )}
        </section>
      </div>
    </div>
  );
};
