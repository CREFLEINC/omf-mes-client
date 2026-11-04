import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  Chip,
  DatePicker,
  EmptyState,
  PageHeader,
  Skeleton,
  Switch,
  TextField,
} from '@crefle/web-ui';
import type { MaterialIssueRequestForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { plantToday } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { DetailPanel } from './detail-panel';
import {
  EMPTY_FILTERS,
  readFilters,
  readSelectedId,
  readView,
  toSearchParams,
  type StatusFilters,
  type StatusView,
} from './filters';
import {
  PAGE_SIZE,
  usePlannedShortage,
  usePlants,
  useRequestList,
  useWarehouseOptions,
} from './queries';
import { ShortageView } from './shortage-view';
import {
  DISPLAY_STATUSES,
  formatDay,
  formatQty,
  isReleaseFailed,
  STATUS_TONE,
  statusLabel,
} from './status';

const t = messages.materialIssueStatus;

const readPage = (params: URLSearchParams): number => {
  const page = Number(params.get('page'));
  return Number.isInteger(page) && page > 1 ? page : 1;
};

interface PlanGroup {
  key: string;
  title: string;
  rows: MaterialIssueRequestForward[];
}

/** 계획별 묶음 — 생산계획이 없는 요청(수동 · 지금 방식)은 맨 끝 묶음. */
const groupByPlan = (rows: readonly MaterialIssueRequestForward[]): PlanGroup[] => {
  const groups = new Map<string, PlanGroup>();
  for (const row of rows) {
    const key =
      row.productionPlanId === null || row.productionPlanId === undefined
        ? ''
        : String(row.productionPlanId);
    const title =
      key === ''
        ? t.planGroup.none
        : t.planGroup.title(row.productionPlanNo ?? String(row.productionPlanId));
    const group = groups.get(key) ?? { key, title, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) =>
    left.key === '' ? 1 : right.key === '' ? -1 : left.title.localeCompare(right.title),
  );
};

/**
 * W-02-11 출고 요청 현황(003 계획 기반 출고 요청 · US5 · US6). 「구매 / 자재 관리 › 출고 관리」의 탭.
 * 보기(`view`) · 조건 · 쪽 · 고른 요청(`id`)은 주소가 갖는다(screens/W-02-11.md 「진입」).
 */
export const MaterialIssueStatusScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = readView(searchParams);
  const applied = readFilters(searchParams);
  const page = readPage(searchParams);
  const selectedId = readSelectedId(searchParams);

  const plants = usePlants();
  const plantId =
    plants.data?.find((plant) => String(plant.plantId) === applied.plant)?.plantId ??
    plants.data?.[0]?.plantId ??
    null;
  const filters: StatusFilters = {
    ...applied,
    plant: plantId === null ? '' : String(plantId),
  };

  const [draft, setDraft] = useState<StatusFilters>(filters);
  const [draftSource, setDraftSource] = useState(searchParams.toString());
  /* 주소가 바뀌면(뒤로가기 · 초기화) 조건 줄을 주소 값으로 다시 세운다 — 렌더 중 갱신. */
  if (draftSource !== searchParams.toString()) {
    setDraftSource(searchParams.toString());
    setDraft(filters);
  }

  const list = useRequestList(filters, page, view === 'list' && plantId !== null);
  const shortage = usePlannedShortage(plantId);
  const warehouses = useWarehouseOptions(plantId);

  const shortageCount =
    (shortage.data?.items.filter((row) => row.shortageQty > 0).length ?? 0) +
    (shortage.data?.unsourced?.length ?? 0);

  const go = (nextView: StatusView, next: StatusFilters, nextPage = 1, id?: number): void => {
    const params = toSearchParams(nextView, next, nextPage);
    if (id !== undefined) params.set('id', String(id));
    setSearchParams(params);
  };

  const select = (id: number | null): void => {
    const params = new URLSearchParams(searchParams);
    if (id === null) params.delete('id');
    else params.set('id', String(id));
    setSearchParams(params);
  };

  const toggleStatus = (status: (typeof DISPLAY_STATUSES)[number]): void => {
    const statuses = draft.statuses.includes(status)
      ? draft.statuses.filter((value) => value !== status)
      : [...draft.statuses, status];
    go(view, { ...filters, statuses });
  };

  const filterBar = (
    <section className="material-issue-status-filters" aria-label={t.filters.label}>
      <div className="material-issue-status-filter-row">
        <Select
          aria-label={t.filters.plant}
          value={draft.plant}
          options={(plants.data ?? []).map((plant) => ({
            value: String(plant.plantId),
            label: plant.plantName,
          }))}
          onChange={(value) => setDraft({ ...draft, plant: value, warehouse: '' })}
        />
        <DatePicker
          mode="range"
          clearable
          aria-label={t.filters.issueWorkDate}
          placeholder={t.filters.issueWorkDate}
          value={draft.workFrom === '' ? null : [draft.workFrom, draft.workTo]}
          onChange={(value) =>
            setDraft({ ...draft, workFrom: value?.[0] ?? '', workTo: value?.[1] ?? '' })
          }
        />
        <DatePicker
          mode="range"
          clearable
          aria-label={t.filters.productionDate}
          placeholder={t.filters.productionDate}
          value={draft.prodFrom === '' ? null : [draft.prodFrom, draft.prodTo]}
          onChange={(value) =>
            setDraft({ ...draft, prodFrom: value?.[0] ?? '', prodTo: value?.[1] ?? '' })
          }
        />
        <TextField
          aria-label={t.filters.workOrder}
          placeholder={t.filters.workOrderPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') go(view, draft);
          }}
        />
        <Select
          aria-label={t.filters.sourceWarehouse}
          value={draft.warehouse}
          options={[{ value: '', label: t.filters.all }, ...(warehouses.data ?? [])]}
          onChange={(value) => setDraft({ ...draft, warehouse: value })}
        />
        <Button onClick={() => go(view, draft)}>{t.filters.search}</Button>
        <Button
          variant="outlined"
          onClick={() => go(view, { ...EMPTY_FILTERS, plant: filters.plant })}
        >
          {t.filters.reset}
        </Button>
      </div>
      <div className="material-issue-status-filter-row" role="group" aria-label={t.filters.status}>
        <span className="field-note">{t.filters.status}</span>
        {DISPLAY_STATUSES.map((status) => (
          <Button
            key={status}
            variant={filters.statuses.includes(status) ? 'tonal' : 'outlined'}
            size="sm"
            aria-pressed={filters.statuses.includes(status)}
            onClick={() => toggleStatus(status)}
          >
            {t.status[status]}
          </Button>
        ))}
        <Checkbox
          checked={filters.shortageOnly}
          onChange={(event) => go(view, { ...filters, shortageOnly: event.target.checked })}
        >
          {t.filters.hasShortage}
        </Checkbox>
        <Checkbox
          checked={filters.failedOnly}
          onChange={(event) => go(view, { ...filters, failedOnly: event.target.checked })}
        >
          {t.filters.releaseFailed}
        </Checkbox>
        <Switch
          label={t.filters.groupByPlan}
          checked={filters.groupByPlan}
          onChange={(event) => go(view, { ...filters, groupByPlan: event.target.checked }, page)}
        />
      </div>
    </section>
  );

  const row = (request: MaterialIssueRequestForward): ReactNode => (
    <tr
      key={request.materialIssueRequestId}
      aria-selected={request.materialIssueRequestId === selectedId}
    >
      <td>
        <button
          type="button"
          className="link-cell"
          aria-current={request.materialIssueRequestId === selectedId ? 'true' : undefined}
          onClick={() => select(request.materialIssueRequestId)}
        >
          {request.issueRequestNo}
        </button>
      </td>
      <td>{request.workOrderNo ?? String(request.workOrderId)}</td>
      <td>{formatDay(request.productionDate)}</td>
      <td>{formatDay(request.issueWorkDate)}</td>
      <td>{request.sourceWarehouseName ?? '—'}</td>
      <td>{request.destinationLocationName ?? String(request.destinationLocationId)}</td>
      <td>{request.lineCount === undefined ? '—' : String(request.lineCount)}</td>
      <td>
        <span className="material-issue-status-chips">
          <Chip size="sm" status={STATUS_TONE[request.displayStatus]}>
            {statusLabel(request)}
          </Chip>
          {isReleaseFailed(request) && (
            <Chip size="sm" status="error">
              {t.releaseFailed}
            </Chip>
          )}
        </span>
      </td>
      <td>
        {(request.shortageQty ?? 0) > 0 && (
          <Chip size="sm" status="warning">
            {t.shortageChip(formatQty(request.shortageQty ?? 0))}
          </Chip>
        )}
      </td>
    </tr>
  );

  const listBody = (): ReactNode => {
    if (list.isError) {
      return (
        <AlertBanner
          variant="error"
          title={messages.httpError.loadTitle}
          action={
            <Button variant="outlined" size="sm" onClick={() => void list.refetch()}>
              {messages.common.retry}
            </Button>
          }
        >
          {messages.httpError.description}
        </AlertBanner>
      );
    }
    if (list.data === undefined) return <Skeleton variant="rect" height="16rem" />;
    if (list.data.items.length === 0) {
      return <EmptyState size="sm" title={t.empty.title} description={t.empty.description} />;
    }

    const items = list.data.items;
    const groups: PlanGroup[] = filters.groupByPlan
      ? groupByPlan(items)
      : [{ key: 'all', title: '', rows: items }];
    const total = list.data.page.total;
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <>
        <table className="material-issue-status-table" aria-label={t.views.list}>
          <thead>
            <tr>
              <th scope="col">{t.columns.requestNo}</th>
              <th scope="col">{t.columns.workOrder}</th>
              <th scope="col">{t.columns.productionDate}</th>
              <th scope="col">{t.columns.issueWorkDate}</th>
              <th scope="col">{t.columns.sourceWarehouse}</th>
              <th scope="col">{t.columns.destination}</th>
              <th scope="col">{t.columns.lineCount}</th>
              <th scope="col">{t.columns.status}</th>
              <th scope="col">{t.columns.shortage}</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.key}>
              {filters.groupByPlan && (
                <tr className="material-issue-status-group">
                  <th scope="rowgroup" colSpan={9}>
                    <strong>{group.title}</strong>{' '}
                    <span className="field-note">
                      {t.planGroup.meta(
                        group.rows.length,
                        group.rows.filter((request) => (request.shortageQty ?? 0) > 0).length,
                      )}
                    </span>
                  </th>
                </tr>
              )}
              {group.rows.map(row)}
            </tbody>
          ))}
        </table>
        <div className="material-issue-status-pager">
          <span className="field-note">{t.pager.total(total)}</span>
          <Button
            variant="outlined"
            size="sm"
            disabled={page <= 1}
            onClick={() => go('list', filters, page - 1)}
          >
            {t.pager.previous}
          </Button>
          <Button
            variant="outlined"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => go('list', filters, page + 1)}
          >
            {t.pager.next}
          </Button>
        </div>
      </>
    );
  };

  const body = (): ReactNode => {
    if (plants.isError) {
      return (
        <AlertBanner
          variant="error"
          title={messages.httpError.loadTitle}
          action={
            <Button variant="outlined" size="sm" onClick={() => void plants.refetch()}>
              {messages.common.retry}
            </Button>
          }
        >
          {messages.httpError.description}
        </AlertBanner>
      );
    }
    if (plants.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (plantId === null) return <EmptyState size="sm" title={t.empty.noPlant} />;

    if (view === 'shortage') {
      return (
        <ShortageView
          data={shortage.data}
          isPending={shortage.isPending}
          isError={shortage.isError}
          onRetry={() => void shortage.refetch()}
        />
      );
    }
    return (
      <>
        {filterBar}
        {listBody()}
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: t.breadcrumb.root },
              { label: t.breadcrumb.parent },
              { label: t.title },
            ]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <div className="material-issue-status-views">
        <div role="group" aria-label={t.views.label}>
          <Button
            variant={view === 'list' ? 'filled' : 'outlined'}
            size="sm"
            aria-pressed={view === 'list'}
            onClick={() => go('list', filters)}
          >
            {t.views.list}
          </Button>
          <Button
            variant={view === 'shortage' ? 'filled' : 'outlined'}
            size="sm"
            aria-pressed={view === 'shortage'}
            onClick={() => go('shortage', filters)}
          >
            {shortageCount > 0 ? t.views.shortageCount(shortageCount) : t.views.shortage}
          </Button>
        </div>
        <span className="field-note">{t.today(formatDay(plantToday()))}</span>
      </div>
      {body()}
      {view === 'list' && selectedId !== null && (
        <DetailPanel requestId={selectedId} plantId={plantId} onClose={() => select(null)} />
      )}
    </>
  );
};
