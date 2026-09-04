import { AlertBanner, Breadcrumb, Button, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

import { BasisBar } from './basis-bar';
import { DetailDialog } from './detail-dialog';
import { ProgressFilterBar } from './filter-bar';
import {
  PAGE_SIZE,
  type ProgressFilters,
  readFilters,
  readPage,
  readSelectedWorkOrderId,
  readSort,
  toAppliedSearchParams,
  toProgressListQuery,
  withPage,
  withPeriod,
  withSelectedWorkOrder,
  withSort,
} from './filters';
import { useItemLookup, useProductionLineLookup, useProductionOrderLookup } from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { defaultPeriod } from './period';
import { useWorkOrderDetail, useWorkOrderProgressList, workOrderProgressKeys } from './queries';
import { toWorkOrderRow } from './row-view';
import { type SortKey, type SortState } from './sort';
import { useWorkOrderStatusOptions } from './status-options';
import { SummaryPane } from './summary-pane';
import { WorkOrderTable } from './work-order-table';

const t = messages.workOrderProgress;

export interface WorkOrderProgressScreenProps {
  /** 「지금」. 감지기가 실행하는 날에 따라 결과가 달라지지 않게 밖에서 받는다. */
  now?: Date;
}

const EMPTY_CONDITIONS = {
  productionLineId: '',
  statusCode: '',
  productionOrderId: '',
  keyword: '',
};

const nextSort = (current: SortState, key: SortKey): SortState =>
  current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { key, direction: 'asc' };

/**
 * W-02-08 W/O 진행현황 조회.
 *
 * **주소가 화면의 상태다.** 조건·정렬·쪽·고른 W/O 를 전부 주소에 둔다 — 그래야 새로고침과
 * 공유가 같은 화면으로 되돌아온다.
 *
 * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
 *
 * | # | 조작 | 조건 | `sort` | `page` | `workOrderId` |
 * | :-: | --- | :-: | :-: | :-: | :-: |
 * | 1 | 조회·초기화 | 바뀐다 | **유지** | **첫 쪽** | **비운다** |
 * | 2 | 정렬 바꾸기 | 유지 | 바뀐다 | **첫 쪽** | 유지 |
 * | 3 | 쪽 이동 | 유지 | 유지 | 옮긴 쪽 | 유지 |
 * | 4 | 고르기·닫기 | 유지 | 유지 | 유지 | 넣고 뺀다 |
 * | 5 | 새로고침 | 유지 | 유지 | 유지 | 유지 |
 *
 * - **1행** 조건이 바뀌면 그 W/O 는 결과에 없을 수 있다 — 남겨 두면 목록에 없는 건의 상세가
 *   열린 채로 뜬다. 정렬은 「무엇을 보나」가 아니라 「어떻게 늘어놓나」라 빼앗지 않는다.
 * - **2행** 순서가 바뀌면 2쪽의 내용이 통째로 달라진다.
 * - **3·4행** 상세를 여는 것은 보이는 줄을 바꾸지 않고, 쪽을 옮기는 것은 무엇을 골랐는지를
 *   바꾸지 않는다 — 서로를 건드리지 않는다.
 * - **5행** 새로고침은 **같은 조회를 다시 하는 것**이다. 무언가를 비우면 조건 변경으로 둔갑한다.
 *
 * ⛔ **자동 갱신이 없어**(L-6) 기준 시각이 값의 일부다(L-5). 그 기준은 **받아 낸 시각**이지
 * 「지금」이 아니다 — 실패해도 앞서 받은 것이 보이므로 낡은 수에 새 시각이 붙는다.
 */
export const WorkOrderProgressScreen = ({ now }: WorkOrderProgressScreenProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const today = now ?? new Date();
  /* 시간대를 한 번만 읽어 넘긴다 — 변환 함수 안에서 읽으면 감지기가 환경을 검사하게 된다. */
  const offsetMinutes = -today.getTimezoneOffset();

  const filters = readFilters(searchParams, today);
  const { from: periodFrom, to: periodTo } = filters;
  const sort = readSort(searchParams, filters);
  const page = readPage(searchParams);
  const selectedWorkOrderId = readSelectedWorkOrderId(searchParams);

  /*
   * 화면이 실제로 거는 기간을 주소에 적는다 — 그래야 지금 화면을 그대로 공유할 수 있다.
   *
   * ⛔ 「주소에 값이 있는가」로 묻지 않는다. `?from=` 처럼 **비었거나 달력에 없는 값**이 들어
   * 있으면 화면은 기본 기간으로 되돌리는데(L-3), 주소는 그 사실을 모른 채 남는다 — 그 링크를
   * 받은 사람은 **주소와 다른 화면**을 보게 된다. 그래서 「적힌 값이 거는 값과 같은가」로 묻는다.
   */
  const isPeriodInAddress =
    searchParams.get('from') === filters.from && searchParams.get('to') === filters.to;
  useEffect(() => {
    if (isPeriodInAddress) return;

    setSearchParams((current) => withPeriod(current, { from: periodFrom, to: periodTo }), {
      replace: true,
    });
  }, [isPeriodInAddress, periodFrom, periodTo, setSearchParams]);

  const list = useWorkOrderProgressList(toProgressListQuery(filters, sort, page, offsetMinutes));
  const detail = useWorkOrderDetail(selectedWorkOrderId);
  const items = useItemLookup();
  const lines = useProductionLineLookup();
  const orders = useProductionOrderLookup();
  const statuses = useWorkOrderStatusOptions();

  /* ⛔ 「지금」이 아니라 **받아 낸 시각**이다 — 실패해도 낡은 수에 새 시각이 붙지 않는다. */
  const basisAt = list.dataUpdatedAt > 0 ? new Date(list.dataUpdatedAt) : today;
  const workOrders = list.data?.items ?? [];
  const rows = workOrders.map((workOrder) => toWorkOrderRow(workOrder, basisAt));
  const pageView = toPageView(list.data?.page ?? { page, size: PAGE_SIZE, total: 0 }, rows.length);

  const apply = (next: ProgressFilters): void => {
    setSearchParams(toAppliedSearchParams(searchParams, next, 1));
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <div className="work-order-progress-workspace">
        <section className="pane work-order-progress-pane" aria-label={t.filters.legend}>
          <h2 className="pane-title">{t.filters.legend}</h2>

          {/* ⛔ 결과가 없어도 조건 줄을 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
          <ProgressFilterBar
            appliedFilters={filters}
            lineLookup={lines}
            productionOrderLookup={orders}
            statusOptions={statuses}
            onReset={() => {
              apply({ ...defaultPeriod(today), ...EMPTY_CONDITIONS });
            }}
            onSearch={apply}
          />
        </section>

        {/* L-5·L-6 — 언제 것인지와, 스스로 새로워지지 않는다는 사실을 함께 둔다. */}
        <BasisBar
          basisAt={basisAt}
          onRefresh={() => {
            void queryClient.invalidateQueries({ queryKey: workOrderProgressKeys.all });
          }}
        />

        <SummaryPane total={list.data?.page.total ?? null} />

        {/* ⛔ 「결과가 없습니다」로만 두면 조건이 잘못된 줄 알고 조건을 더 만지게 된다. */}
        {pageView.isBeyondLast && (
          <div className="banner-slot">
            <AlertBanner variant="info">
              <p>{t.page.beyondLast}</p>
              <Button
                size="sm"
                variant="text"
                onClick={() => {
                  setSearchParams(withPage(searchParams, 1));
                }}
              >
                {t.page.toFirst}
              </Button>
            </AlertBanner>
          </div>
        )}

        <div className="work-order-progress-list-group">
          <WorkOrderTable
            isError={list.isError}
            isLoading={list.isPending && list.fetchStatus !== 'idle'}
            itemLabel={(itemIdText) => items.labelOf(itemIdText)}
            period={filters}
            rows={rows}
            sort={sort}
            statusLabel={(statusCode) => statuses.labelOf(statusCode)}
            onSelect={(workOrderId) => {
              setSearchParams(withSelectedWorkOrder(searchParams, workOrderId));
            }}
            onSort={(key) => {
              setSearchParams(withSort(searchParams, nextSort(sort, key)));
            }}
          />

          {/*
           * ⛔ 받지 못했으면 쪽 이동을 세우지 않는다. 세우면 「0건」이라고 **단언하게 되는데**,
           * 실제로는 몇 건인지 모른다 — 실패를 「결과 없음」으로 바꿔 읽게 만든다.
           */}
          {list.data === undefined ? null : (
            <PageNav
              view={pageView}
              onChange={(next) => {
                setSearchParams(withPage(searchParams, next));
              }}
            />
          )}
        </div>
      </div>

      <DetailDialog
        isError={detail.isError}
        isLoading={selectedWorkOrderId !== null && detail.isPending}
        isOpen={selectedWorkOrderId !== null}
        itemLabel={(itemIdText) => items.labelOf(itemIdText)}
        workOrder={detail.data ?? null}
        onClose={() => {
          setSearchParams(withSelectedWorkOrder(searchParams, null));
        }}
      />
    </>
  );
};
