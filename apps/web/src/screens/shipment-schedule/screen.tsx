import { Breadcrumb, PageHeader, type SortState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useCustomerOptions,
  useShipToPartnerOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { readPeriod, toPeriodQuery, validatePeriod, type PeriodInput } from './period';
import { useShipmentScheduleList } from './queries';
import { ShipmentFilterBar } from './shipment-filter-bar';
import { ShipmentTable } from './shipment-table';
import { nextSortKey, readSortKey, toSortQuery } from './sort';
import { PLACEHOLDER_SHIPMENT_STATUS_CODES, toStatusOptions } from './status-options';
import type { SelectOption, ShipmentRequestView } from './types';
import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  toFilterQuery,
  toSearchParams,
  type ShipmentFilters,
} from './filters';

const t = messages.shipmentSchedule;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: ShipmentRequestView[] = [];

const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.label,
  }));

/**
 * W-04-02 컨테이너 — **출하(도메인 04)의 첫 화면**이다.
 *
 * 조회 전용이라 편집 폼이 없고, 행 클릭으로 다른 화면(편성·출하 확정)으로 이동하는 액션도
 * 없다 — 그 화면들(`W-04-01`·`W-04-04`)이 이 저장소에 아직 없다(계획서 미결).
 *
 * 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
 *
 * | # | 조작 | `page` | 왜 |
 * | :-: | --- | --- | --- |
 * | 1 | 조건·기간·정렬 변경 · 초기화 | **첫 쪽으로** | 결과가 통째로 달라진다 |
 * | 2 | 쪽 이동 | 옮긴 쪽 | 다른 행이 온다 |
 *
 * 이 화면은 선택(행 고르기) 개념이 없어 W-01-09의 수명 표 3·4행이 성립하지 않는다.
 */
export const ShipmentScheduleScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const period = useMemo<PeriodInput>(() => readPeriod(searchParams), [searchParams]);
  const filters = useMemo<ShipmentFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const sortKey = readSortKey(searchParams.get('sort'));

  /*
   * **출하일 시작이 없으면 조회하지 않는다**(L-3 필수) — W-01-09와 반대다. `periodReason`이
   * `null`이 아니면 그 사유를 조건 줄이 이미 밝히므로 여기서 되풀이하지 않는다.
   */
  const periodReason = validatePeriod(period);
  const listQuery =
    periodReason === null
      ? {
          ...toPeriodQuery(period),
          ...toFilterQuery(filters),
          ...toSortQuery(sortKey),
          ...(page > 1 ? { page } : {}),
        }
      : null;

  const list = useShipmentScheduleList(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const customers = useCustomerOptions();
  const shipToPartners = useShipToPartnerOptions();

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   * **조건·정렬이 바뀌면 쪽을 첫 쪽으로 되돌린다** — 3쪽을 보다가 조건을 좁히거나 정렬을
   * 바꾸면 결과가 3쪽에 못 미쳐 사용자에게는 「아무것도 없다」로 보인다.
   */
  const applyQuery = (
    nextPeriod: PeriodInput,
    nextFilters: ShipmentFilters,
    nextSort: ReturnType<typeof readSortKey>,
    nextPage = 1,
  ): void => {
    setSearchParams(toSearchParams(nextPeriod, nextFilters, nextSort, nextPage));
  };

  const changeSort = (next: SortState | null): void => {
    applyQuery(period, filters, nextSortKey(sortKey, next));
  };

  const customerReference = toReference(
    customers,
    filters.customer === '' ? null : Number(filters.customer),
  );
  const shipToPartnerReference = toReference(
    shipToPartners,
    filters.shipToPartner === '' ? null : Number(filters.shipToPartner),
  );

  const retryReferences = (): void => {
    customers.refetch();
    shipToPartners.refetch();
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.list}>
        <ShipmentFilterBar
          appliedPeriod={period}
          appliedFilters={filters}
          customerOptions={toSelectOptions(customers)}
          shipToPartnerOptions={toSelectOptions(shipToPartners)}
          statusOptions={toStatusOptions(PLACEHOLDER_SHIPMENT_STATUS_CODES, rows, filters.status)}
          chipNames={{
            customer: describeReference(customerReference),
            shipToPartner: describeReference(shipToPartnerReference),
          }}
          customerNote={lookupNote(customers)}
          shipToPartnerNote={lookupNote(shipToPartners)}
          onSearch={(nextPeriod, nextFilters) => {
            applyQuery(nextPeriod, nextFilters, sortKey);
          }}
          onRemoveFilter={(key) => {
            applyQuery(period, { ...filters, [key]: '' }, sortKey);
          }}
          onReset={() => {
            applyQuery({ from: '', to: '' }, EMPTY_FILTERS, null);
          }}
        />

        {!list.isError && (
          <>
            <ShipmentTable
              rows={rows}
              isLoading={list.isPending && listQuery !== null}
              hasQuery={listQuery !== null}
              isBeyondLast={pageView.isBeyondLast}
              sortKey={sortKey}
              onSortChange={changeSort}
              customerLookup={customers}
              shipToPartnerLookup={shipToPartners}
              onFirstPage={() => {
                applyQuery(period, filters, sortKey);
              }}
              onRetryReferences={retryReferences}
            />
            {listQuery !== null && !list.isPending && (
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  applyQuery(period, filters, sortKey, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>
    </>
  );
};
