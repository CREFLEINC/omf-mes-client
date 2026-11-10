import {
  AlertBanner,
  Breadcrumb,
  Button,
  DatePicker,
  EmptyState,
  PageHeader,
  Skeleton,
  type SelectItems,
} from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { DetailDrawer } from '../../patterns/detail-drawer';
import { handoverTypeName, useHandoverAlertTypes } from '../../patterns/handover-alert-types';
import { formatPlantDateTime } from '../../patterns/plant-time';

import { Select } from '../../patterns/select';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { DeliveryTable, toDeliveryView } from './delivery-table';
import { DispatchTable } from './dispatch-table';
import {
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

/**
 * W-CO-13 알림 발송 이력 — 이벤트 처리 결과(알림/건너뜀과 사유)와 수신자별 Zalo 결과.
 * 조건은 주소가 든다. 행을 고르면 그 건의 Zalo 발송 상세가 오른쪽 드로어로 열린다
 * (T-W-A·C-2, omf-all-around#183). 목록 아래에 붙이면 50행 아래로 밀려 누른 자리에서 보이지 않는다.
 */
export const DispatchHistoryScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldId = useId();
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

  const go = (nextPage: number, nextSelected: number | null): void => {
    setSearchParams(toSearchParams(applied, appliedFilters, nextPage, nextSelected));
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
    const totalPages = Math.max(1, Math.ceil(meta.total / meta.size));
    return (
      <>
        <DispatchTable
          rows={items}
          selectedId={selected}
          eventName={eventName}
          onSelect={(id) => go(page, id)}
        />
        {totalPages > 1 && (
          <div className="dispatch-pages">
            <Button
              variant="text"
              size="sm"
              disabled={page <= 1}
              onClick={() => go(page - 1, null)}
            >
              {t.actions.prevPage}
            </Button>
            <span>{t.state.pageOf(page, totalPages)}</span>
            <Button
              variant="text"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => go(page + 1, null)}
            >
              {t.actions.nextPage}
            </Button>
          </div>
        )}
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
   * ⭐ **드로어 머리에 대상을 둔다.** 드로어가 목록을 덮으므로 어느 건의 상세인지 머리가 말해야 한다.
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

  const deliveryDrawer = (): ReactNode => {
    if (selected === null) return null;
    const head = selectedHead();
    return (
      <DetailDrawer
        title={head?.target ?? t.panes.deliveries}
        summary={head?.summary}
        onClose={() => go(page, null)}
        className="dispatch-detail-drawer"
      >
        {/* 이름은 구획에 싣고 보이는 제목은 표 caption 하나로 둔다 — 같은 글이 두 번 서지 않게. */}
        <section aria-label={t.panes.deliveries}>{deliverySlot()}</section>
      </DetailDrawer>
    );
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

      <div className="filter-bar">
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
          'department',
          t.filters.department,
          filters.department,
          (departments.data ?? []).map((item) => ({
            value: String(item.departmentId),
            label: named(item.departmentName, item.departmentCode),
          })),
          (value) => setFilters((prev) => ({ ...prev, department: value })),
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
        <div className="filter-actions">
          <Button
            disabled={draftReason !== null}
            aria-describedby={draftReason === null ? undefined : periodReasonId}
            onClick={search}
          >
            {t.filters.search}
          </Button>
        </div>
      </div>

      <section className="pane dispatch-pane" aria-labelledby="dispatch-title">
        <h2 id="dispatch-title" className="pane-title">
          {t.panes.dispatches}
        </h2>
        {dispatchSlot()}
      </section>

      {deliveryDrawer()}
    </>
  );
};
