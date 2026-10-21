import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

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
 * 조건은 주소가 든다. 행을 고르면 그 건의 Zalo 발송 상세가 아래에 열린다.
 */
export const DispatchHistoryScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldId = useId();
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
  const query =
    periodReason === null
      ? {
          ...toPeriodQuery(applied, -new Date().getTimezoneOffset()),
          ...toFilterQuery(appliedFilters),
          page,
          size: PAGE_SIZE,
        }
      : null;

  const dispatches = useDispatches(hasPeriod ? query : null);
  const deliveries = useDeliveries(selected);
  const events = useEvents();
  const departments = useDepartments();

  const eventName = (code: string): string => {
    const name = events.data?.find((event) => event.eventCode === code)?.eventName ?? '';
    return name.trim() === '' ? code : name;
  };

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
    options: { value: string; label: string }[],
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

  const loadError = (onRetry: () => void): ReactNode => (
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {messages.httpError.description}
    </AlertBanner>
  );

  const dispatchSlot = (): ReactNode => {
    if (periodReason !== null) return <AlertBanner variant="warning">{periodReason}</AlertBanner>;
    if (dispatches.isError) return loadError(() => void dispatches.refetch());
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
    if (selected === null) return <EmptyState size="sm" title={t.state.selectHint} />;
    if (deliveries.isError) return loadError(() => void deliveries.refetch());
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
        <TextField
          type="date"
          label={t.filters.from}
          value={period.from}
          onChange={(event) => setPeriod((prev) => ({ ...prev, from: event.target.value }))}
        />
        <TextField
          type="date"
          label={t.filters.to}
          value={period.to}
          onChange={(event) => setPeriod((prev) => ({ ...prev, to: event.target.value }))}
          error={draftReason ?? undefined}
        />
        {selectField(
          'event',
          t.filters.event,
          filters.event,
          (events.data ?? []).map((event) => ({
            value: event.eventCode,
            label: eventName(event.eventCode),
          })),
          (value) => setFilters((prev) => ({ ...prev, event: value })),
        )}
        {selectField(
          'department',
          t.filters.department,
          filters.department,
          (departments.data ?? []).map((item) => ({
            value: String(item.departmentId),
            label: `${item.departmentCode} · ${item.departmentName}`,
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
          <Button disabled={draftReason !== null} onClick={search}>
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

      <section className="pane dispatch-pane" aria-labelledby="delivery-title">
        <h2 id="delivery-title" className="pane-title">
          {t.panes.deliveries}
        </h2>
        {deliverySlot()}
      </section>
    </>
  );
};
