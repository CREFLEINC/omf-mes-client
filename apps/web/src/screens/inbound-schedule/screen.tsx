import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { plantToday } from '../../patterns/plant-time';
import { ScheduleFilterBar } from './filter-bar';
import {
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  toFilterQuery,
  toSearchParams,
  type ScheduleFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemNames,
  usePlantOptions,
  useStorageLocationNames,
  useSupplierOptions,
  useUomOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { readPeriod, toPeriodQuery, validatePeriod, type PeriodInput } from './period';
import { useInboundSchedule } from './queries';
import { ScheduleTable } from './schedule-table';
import type { InboundScheduleLine, InboundScheduleQuery, SelectOption } from './types';

const t = messages.inboundSchedule;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: InboundScheduleLine[] = [];

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 발주의 이름을 풀기 위해서인데, 그 발주들을 **조건으로 찾으려면**
 * 선택지에도 있어야 한다. 표식은 저장소 관례를 따른다(W-CO-02의 「(미사용)」).
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-09 컨테이너 — 「입고 관리」 허브의 첫 탭이다.
 *
 * **입하 예정 = 아직 다 들어오지 않은 P/O 라인이다**(omf-mes-server#741 · #749). 고객사가 ASN 을
 * 쓰지 않아 ASN 경로가 늘 비어 있었다 — 그래서 발주 라인을 납기 순으로 한 표에 낸다.
 * 라인마다 헤더 칸이 함께 와 「건을 골라 라인을 본다」는 2단 배치가 필요 없다.
 *
 * 조회 전용이라 편집 폼이 없다. 조회 조건과 쪽은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가
 * 같은 결과를 낸다. 조건이 바뀌면 쪽은 첫 쪽으로 돌아간다(`applyQuery`).
 */
export const InboundScheduleScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   */
  const period = useMemo<PeriodInput>(() => readPeriod(searchParams), [searchParams]);
  const filters = useMemo<ScheduleFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  /*
   * 공장 달력의 「오늘」을 한 번만 읽어 넘긴다 — 지연은 서버와 같이 공장 현지 날짜로 판정한다.
   * 판정 함수 안에서 읽으면 그 함수가 환경에 따라 다른 값을 내어 테스트가 환경을 검사하게 된다.
   */
  const today = plantToday();

  /*
   * **조건이 하나도 없어도 조회한다.** 조회를 멈추는 것은 보내면 반드시 400 `INVALID`가 되는
   * 기간뿐이다(없는 날짜·뒤집힌 기간) — 그런 값은 서버로 보내지 않는다.
   */
  const periodReason = validatePeriod(period);
  const listQuery: InboundScheduleQuery | null =
    periodReason === null
      ? { ...toPeriodQuery(period), ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) }
      : null;

  const list = useInboundSchedule(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const suppliers = useSupplierOptions();
  const plants = usePlantOptions();
  const uoms = useUomOptions();
  const storageLocationNameOf = useStorageLocationNames();

  /*
   * 품목 이름은 **이 쪽에 뜬 품목과 걸린 품목 조건만** 번호로 묻는다(`lookups.ts`의 ⛔ 둘).
   * 같은 품목이면 요청도 하나다.
   */
  const appliedItemId = filters.item === '' ? null : Number(filters.item);
  const itemIds = useMemo(
    () => [...rows.map((row) => row.itemId), ...(appliedItemId === null ? [] : [appliedItemId])],
    [rows, appliedItemId],
  );
  const itemNames = useItemNames(itemIds);

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 는다.
   * **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다** — 3쪽을 보다가 조건을 좁히면 결과가 3쪽에 못 미쳐
   * 「조건을 좁혔더니 아무것도 없다」로 보인다.
   */
  const applyQuery = (
    nextPeriod: PeriodInput,
    nextFilters: ScheduleFilters,
    nextPage = 1,
  ): void => {
    setSearchParams(toSearchParams(nextPeriod, nextFilters, nextPage));
  };

  /**
   * 참조 실패의 복구 경로. 표의 이름 칸(공급사·품목·단위)이 실패로 보이는 자리라 표 아래에 하나 둔다.
   * 공장은 조건 줄에만 보여 그 칸의 안내(`lookupNote`)가 맡는다.
   */
  const retryReferences = (): void => {
    suppliers.refetch();
    uoms.refetch();
    itemNames.refetch();
  };

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />

      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 자료가 없는 줄 안다. */}
      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.list}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <ScheduleFilterBar
          appliedPeriod={period}
          appliedFilters={filters}
          supplierOptions={toSelectOptions(suppliers)}
          plantOptions={toSelectOptions(plants)}
          chipNames={{
            supplier: describeReference(
              toReference(suppliers, filters.supplier === '' ? null : Number(filters.supplier)),
            ),
            plant: describeReference(
              toReference(plants, filters.plant === '' ? null : Number(filters.plant)),
            ),
            item: appliedItemId === null ? '' : describeReference(itemNames.of(appliedItemId)),
          }}
          supplierNote={lookupNote(suppliers)}
          plantNote={lookupNote(plants)}
          onSearch={(nextPeriod, nextFilters) => {
            applyQuery(nextPeriod, nextFilters);
          }}
          onRemoveFilter={(key) => {
            applyQuery(period, { ...filters, [key]: '' });
          }}
          onReset={() => {
            applyQuery({ from: '', to: '' }, DEFAULT_FILTERS);
          }}
        />

        {!list.isError && (
          <>
            <ScheduleTable
              rows={rows}
              isLoading={list.isPending && listQuery !== null}
              hasQuery={listQuery !== null}
              isBeyondLast={pageView.isBeyondLast}
              today={today}
              supplierLookup={suppliers}
              uomLookup={uoms}
              itemNames={itemNames}
              storageLocationNameOf={storageLocationNameOf}
              onFirstPage={() => {
                applyQuery(period, filters);
              }}
              onRetryReferences={retryReferences}
            />
            {listQuery !== null && !list.isPending && (
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  applyQuery(period, filters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>
    </>
  );
};
