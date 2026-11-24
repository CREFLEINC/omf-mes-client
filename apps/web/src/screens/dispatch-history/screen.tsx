import {
  AlertBanner,
  Button,
  DatePicker,
  EmptyState,
  Icon,
  Skeleton,
  type SelectItems,
} from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';
import { handoverTypeName, useHandoverAlertTypes } from '../../patterns/handover-alert-types';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { PageNav } from '../../patterns/page-nav';
import { formatPlantDateTime } from '../../patterns/plant-time';

import { Select } from '../../patterns/select';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { DeliveryTable, toDeliveryView } from './delivery-table';
import { DispatchTable } from './dispatch-table';
import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  readPeriod,
  readSelected,
  toFilterQuery,
  toSearchParams,
  type DispatchFilters,
} from './filters';
import { defaultPeriod, toPeriodQuery, validatePeriod, type PeriodInput } from './period';
import { PAGE_SIZE, useDeliveries, useDepartments, useDispatches, useEvents } from './queries';

const t = messages.dispatchHistory;
const w = t.workspace;

/**
 * W-CO-13 알림 발송 이력 — 이벤트 처리 결과(알림/건너뜀과 사유)와 수신자별 Zalo 결과.
 * 조건은 주소가 든다. 행을 고르면 그 건의 Zalo 발송 상세가 오른쪽 상세 상자에 선다
 * (조회 조건 · 목록 · 상세 통일 배치 · omf-all-around#358 — 종전 드로어 #183 자리).
 *
 * **보이는 조건은 셋이다**(C-6) — 기간 · 이벤트 · 결과. 부서는 「조건 더보기」에 접고, 걸려 있으면
 * 칩으로 알린다. [초기화]는 처음 연 때처럼 기본 7일 · 조건 없음으로 되돌려 다시 조회한다(#358).
 */
export const DispatchHistoryScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldId = useId();
  const more = useFilterMore();
  /* 기간 오류 문구. [조회]를 잠그는 사유이기도 해서 단추가 이 문구를 가리킨다(C-4). */
  const periodReasonId = `${fieldId}-period-reason`;
  const applied = readPeriod(searchParams);
  const appliedFilters = readFilters(searchParams);
  const page = readPage(searchParams);
  const selected = readSelected(searchParams);
  const hasPeriod = searchParams.has('from') || searchParams.has('to');

  const [period, setPeriod] = useState<PeriodInput>(applied);
  const [filters, setFilters] = useState<DispatchFilters>(appliedFilters);
  const [deliveryStatus, setDeliveryStatus] = useState('');

  /* 주소에 기간이 없을 때만 기본 7일을 채운다. replace 로 두어 뒤로가기가 빈 주소로 가지 않는다. */
  useEffect(() => {
    if (hasPeriod) return;
    const seeded = defaultPeriod(new Date());
    setPeriod(seeded);
    setSearchParams((prev) => toSearchParams(seeded, readFilters(prev)), { replace: true });
  }, [hasPeriod, setSearchParams]);

  const periodReason = validatePeriod(applied);
  const periodQuery =
    periodReason === null && hasPeriod
      ? toPeriodQuery(applied, -new Date().getTimezoneOffset())
      : null;
  const query =
    periodQuery !== null
      ? {
          ...periodQuery,
          ...toFilterQuery(appliedFilters),
          page,
          size: PAGE_SIZE,
        }
      : null;

  const dispatches = useDispatches(query);
  const deliveries = useDeliveries(selected, periodQuery);
  const events = useEvents();
  /* 인계 작업 10종(피처 002) — 이름 풀이와 이벤트 거르기에 기존 6종 뒤로 더한다. 못 받으면 코드 그대로. */
  const handoverTypes = useHandoverAlertTypes();
  const departments = useDepartments();

  const eventName = (code: string): string => {
    const handover = handoverTypes.data?.find((type) => type.alertTypeCode === code);
    if (handover !== undefined) return handoverTypeName(handover, code);
    const name = events.data?.find((event) => event.eventCode === code)?.eventName ?? '';
    return name.trim() === '' ? code : name;
  };

  const eventOptions = (events.data ?? []).map((event) => ({
    value: event.eventCode,
    label: eventName(event.eventCode),
  }));
  const handoverOptions = (handoverTypes.data ?? []).map((type) => ({
    value: type.alertTypeCode,
    label: eventName(type.alertTypeCode),
  }));

  const draftReason = validatePeriod(period);
  const search = (): void => {
    if (draftReason !== null) return;
    setSearchParams(toSearchParams(period, filters));
  };

  /* 처음 연 때와 같은 조건 — 기본 7일 · 조건 없음(#358). */
  const reset = (): void => {
    const seeded = defaultPeriod(new Date());
    setPeriod(seeded);
    setFilters(EMPTY_FILTERS);
    setSearchParams(toSearchParams(seeded, EMPTY_FILTERS));
  };

  /* 초기화는 처음 값(기본 7일 · 조건 없음)과 달라진 것이 있을 때만 보인다 — 편집 중 값이나 조회에 쓰인 값. */
  const isChanged = hasChangedFilters(
    { ...defaultPeriod(new Date()), ...EMPTY_FILTERS },
    { ...period, ...filters },
    { ...applied, ...appliedFilters },
  );

  const go = (nextPage: number, nextSelected: number | null): void => {
    setSearchParams(toSearchParams(applied, appliedFilters, nextPage, nextSelected));
  };

  const departmentOptions = (departments.data ?? []).map((item) => ({
    value: String(item.departmentId),
    label: named(item.departmentName, item.departmentCode),
  }));

  /* 접힌 칸(부서)에 걸린 조건만 칩으로 — 이름을 못 풀면 번호라도 보인다. */
  const hiddenChips =
    appliedFilters.department === ''
      ? []
      : [
          {
            key: 'department' as const,
            label: t.filters.chipDepartment(
              departmentOptions.find((option) => option.value === appliedFilters.department)
                ?.label ?? appliedFilters.department,
            ),
            removeLabel: messages.common.filterMore.remove(t.filters.department),
          },
        ];

  /* × 는 부서만 풀어 곧바로 다시 조회한다. 편집 중인 칸도 함께 비워야 다음 [조회]가 되살리지 않는다. */
  const removeDepartment = (): void => {
    setFilters((prev) => ({ ...prev, department: '' }));
    setSearchParams(toSearchParams(applied, { ...appliedFilters, department: '' }));
  };

  const selectField = (
    key: string,
    label: string,
    value: string,
    options: SelectItems,
    onChange: (value: string) => void,
  ): ReactNode => (
    <div className="field-cell wide-select">
      <label className="field-label" htmlFor={`${fieldId}-${key}`}>
        {label}
      </label>
      <Select
        id={`${fieldId}-${key}`}
        value={value}
        placeholder={t.filters.all}
        options={[{ value: '', label: t.filters.all }, ...options]}
        onChange={onChange}
      />
    </div>
  );

  const loadError = (error: unknown, onRetry: () => void): ReactNode => (
    <LoadErrorAlert error={error} onRetry={onRetry} />
  );

  const dispatchSlot = (): ReactNode => {
    if (periodReason !== null) return <AlertBanner variant="warning">{periodReason}</AlertBanner>;
    if (dispatches.isError) return loadError(dispatches.error, () => void dispatches.refetch());
    if (dispatches.data === undefined) return <Skeleton variant="rect" height="12rem" />;

    const { items, page: meta } = dispatches.data;
    return (
      <>
        <DispatchTable
          rows={items}
          selectedId={selected}
          eventName={eventName}
          onSelect={(id) => go(page, id)}
        />
        {/* 공용 쪽 넘김(#358). 쪽 크기는 서버 요청 그대로(50건 고정)라 크기 고르기는 두지 않는다. */}
        <PageNav meta={meta} buttonSize="md" onChangePage={(next) => go(next, null)} />
      </>
    );
  };

  const deliverySlot = (): ReactNode => {
    if (deliveries.isError) return loadError(deliveries.error, () => void deliveries.refetch());
    if (deliveries.data === undefined) return <Skeleton variant="rect" height="8rem" />;

    /* 상태 필터는 화면에서 거른다 — 「대기」가 PENDING·SENDING 둘을 함께 뜻하기 때문이다. */
    const rows = deliveries.data.items.filter(
      (row) => deliveryStatus === '' || toDeliveryView(row.status) === deliveryStatus,
    );
    return (
      <>
        {selectField(
          'deliveryStatus',
          t.filters.deliveryStatus,
          deliveryStatus,
          Object.entries(t.deliveryStatus).map(([value, label]) => ({ value, label })),
          setDeliveryStatus,
        )}
        <DeliveryTable rows={rows} />
      </>
    );
  };

  /*
   * ⭐ **상세 머리에 대상을 둔다.** 어느 건의 상세인지 머리가 말해야 한다(종전 드로어 머리 그대로).
   * 목록의 행이 정본이고, 주소로 바로 열어 그 쪽에 행이 없으면 발송 건이 든 같은 값을 쓴다.
   */
  const selectedHead = (): { target: string; summary: string } | null => {
    const row =
      dispatches.data?.items.find((item) => item.notificationEventId === selected) ??
      deliveries.data?.items[0];
    if (row === undefined) return null;
    const at = formatPlantDateTime(row.occurredAt) ?? row.occurredAt;
    return { target: row.targetLabel ?? '—', summary: `${eventName(row.eventCode)}, ${at}` };
  };

  const deliveryDetail = (): ReactNode => {
    if (selected === null) {
      return (
        <EmptyState
          size="sm"
          className="users-roles-pick-empty"
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="send" size={20} />
            </span>
          }
          title={w.selectTitle}
          description={w.select}
        />
      );
    }
    const head = selectedHead();
    return (
      <div className="dispatch-detail">
        <div className="dispatch-detail-head">
          <h2 className="pane-title">{head?.target ?? t.panes.deliveries}</h2>
          {head !== null && <span className="dispatch-detail-summary">{head.summary}</span>}
        </div>
        {/* 이름은 구획에 싣고 보이는 제목은 표 caption 하나로 둔다 — 같은 글이 두 번 서지 않게. */}
        {/* 머리를 아직 못 풀면 바깥 상자 이름이 「Zalo 발송 상세」라 안쪽 구획 이름을 겹쳐 달지 않는다. */}
        {head === null ? (
          <div>{deliverySlot()}</div>
        ) : (
          <section aria-label={t.panes.deliveries}>{deliverySlot()}</section>
        )}
      </div>
    );
  };

  const filter = (
    <>
      <div className="filter-bar notify-filter-row">
        <div className="field-cell">
          <label className="field-label" htmlFor={`${fieldId}-period`}>
            {t.filters.period}
          </label>
          <DatePicker
            id={`${fieldId}-period`}
            mode="range"
            clearable
            placeholder={messages.common.selectDate}
            invalid={draftReason !== null}
            aria-describedby={draftReason === null ? undefined : periodReasonId}
            value={[period.from === '' ? null : period.from, period.to === '' ? null : period.to]}
            onChange={(value) => setPeriod({ from: value?.[0] ?? '', to: value?.[1] ?? '' })}
          />
          {draftReason !== null && (
            <span id={periodReasonId} className="field-error">
              {draftReason}
            </span>
          )}
        </div>
        {selectField(
          'event',
          t.filters.event,
          filters.event,
          handoverOptions.length === 0
            ? eventOptions
            : [
                ...(eventOptions.length === 0
                  ? []
                  : [{ label: t.filters.eventGroup, options: eventOptions }]),
                { label: t.filters.handoverGroup, options: handoverOptions },
              ],
          (value) => setFilters((prev) => ({ ...prev, event: value })),
        )}
        {selectField(
          'result',
          t.filters.result,
          filters.result,
          [
            { value: 'NOTIFIED', label: t.results.NOTIFIED },
            { value: 'SKIPPED', label: t.results.SKIPPED },
          ],
          (value) => setFilters((prev) => ({ ...prev, result: value })),
        )}
        {/* [조회][초기화][조건 더보기] 순으로 오른쪽 끝에 함께 선다(#358). */}
        <div className="filter-actions field-cell-unlabeled">
          <Button
            disabled={draftReason !== null}
            aria-describedby={draftReason === null ? undefined : periodReasonId}
            onClick={search}
          >
            {t.filters.search}
          </Button>
          {isChanged && (
            <Button variant="outlined" onClick={reset}>
              {w.clear}
            </Button>
          )}
          <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
        </div>
      </div>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} hidden={!more.isOpen} className="dispatch-filter-more">
        <div className="filter-bar">
          {selectField(
            'department',
            t.filters.department,
            filters.department,
            departmentOptions,
            (value) => setFilters((prev) => ({ ...prev, department: value })),
          )}
        </div>
      </div>

      <HiddenFilterChips open={more.isOpen} chips={hiddenChips} onRemove={removeDepartment} />
    </>
  );

  const head = selected === null ? null : selectedHead();

  return (
    /* 머리글(경로 · 화면 이름)은 두지 않는다 — 사이드바가 위치를 말한다(단말 관리와 같은 틀 · #358). */
    <ListDetailWorkspace
      storageKey="omf-mes:dispatch-history"
      initialRatio={0.55}
      filter={{ label: w.filter, content: filter }}
      list={{
        label: w.list,
        title: w.list,
        count: periodReason === null ? dispatches.data?.page.total : undefined,
        content: dispatchSlot(),
      }}
      detail={{
        label: selected === null ? w.selectTitle : (head?.target ?? t.panes.deliveries),
        content: deliveryDetail(),
      }}
    />
  );
};
