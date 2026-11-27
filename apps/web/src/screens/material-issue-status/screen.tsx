import {
  Breadcrumb,
  Button,
  Checkbox,
  Chip,
  EmptyState,
  PageHeader,
  Skeleton,
  Switch,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';
import { DateRangeFields } from '../../patterns/date-range-fields';
import { plantToday } from '../../patterns/plant-time';
import { InfoTip } from '../../patterns/info-tip';
import { ListEmptyRow } from '../../patterns/list-empty';
import { PageNav } from '../../patterns/page-nav';
import { ROW_PICK_CLASS, rowPickHandlers } from '../../patterns/row-pick';
import { ScreenHeader } from '../../patterns/screen-header';
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
  requestShortage,
  STATUS_TONE,
  statusLabel,
} from './status';
import type { MaterialIssueRequestView } from './api-types';
import { LoadErrorAlert } from '../../patterns/load-error-banner';

const t = messages.materialIssueStatus;

const readPage = (params: URLSearchParams): number => {
  const page = Number(params.get('page'));
  return Number.isInteger(page) && page > 1 ? page : 1;
};

interface PlanGroup {
  key: string;
  title: string;
  rows: MaterialIssueRequestView[];
}

/** 계획별 묶음 — 생산계획이 없는 요청(수동 · 지금 방식)은 맨 끝 묶음. */
const groupByPlan = (rows: readonly MaterialIssueRequestView[]): PlanGroup[] => {
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

/** 「조건 더보기」에 접힌 칸 — 칩의 키. */
type HiddenFilterKey = 'plant' | 'warehouse' | 'shortageOnly' | 'failedOnly' | 'groupByPlan';

/**
 * W-02-11 출고 요청 현황(003 계획 기반 출고 요청 · US5 · US6). 「구매 / 자재 관리 › 출고 관리」의 탭.
 * 보기(`view`) · 조건 · 쪽 · 고른 요청(`id`)은 주소가 갖는다(screens/W-02-11.md 「진입」).
 *
 * **조회 조건 줄에 보이는 칸은 셋이다**(C-6) — 출고 작업일 · 생산일 · W/O. 공장 · 출발 생산 창고와 세 확인칸은
 * 「조건 더보기」에 접고, 처음 값과 다른 것만 칩으로 알린다(공장은 첫 공장이 처음 값이다). 상태 줄은 그대로 둔다.
 * 「초기화」는 처음 값(공장은 지금 공장)과 다를 때만 보인다.
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

  const more = useFilterMore();

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

  /*
   * 조회 — 조건 줄의 공장이 비어 있으면(공장 목록을 받기 전에 조건 줄을 세웠다) 지금 조회 중인 공장을 싣는다.
   * 빼고 보내면 주소에서 공장이 빠져 첫 공장으로 넘어갔다(omf-all-around#232 1).
   */
  const search = (): void => {
    go(view, { ...draft, plant: draft.plant === '' ? filters.plant : draft.plant });
  };

  const select = (id: number | null): void => {
    const params = new URLSearchParams(searchParams);
    if (id === null) params.delete('id');
    else params.set('id', String(id));
    setSearchParams(params);
  };

  /* 초기화는 공장을 남긴다. 주소가 그대로여도(이미 처음 값) 조건 줄의 고친 값은 되돌린다. */
  const resetFilters: StatusFilters = { ...EMPTY_FILTERS, plant: filters.plant };
  const reset = (): void => {
    setDraft(resetFilters);
    go(view, resetFilters);
  };
  const isChanged = hasChangedFilters(
    resetFilters,
    { ...draft, plant: draft.plant === '' ? filters.plant : draft.plant },
    filters,
  );

  /* 접힌 칸의 조건만 칩으로 — 보이는 칸(출고 작업일 · 생산일 · W/O)은 칩으로 겹쳐 적지 않는다. */
  const firstPlant = plants.data?.[0];
  const plantName = plants.data?.find((plant) => plant.plantId === plantId)?.plantName;
  const warehouseName =
    warehouses.data?.find((option) => option.value === filters.warehouse)?.label ??
    filters.warehouse;
  const hiddenChips = [
    ...(firstPlant !== undefined && plantId !== firstPlant.plantId
      ? [{ key: 'plant' as const, label: t.filters.chipPlant(plantName ?? filters.plant) }]
      : []),
    ...(filters.warehouse === ''
      ? []
      : [{ key: 'warehouse' as const, label: t.filters.chipSourceWarehouse(warehouseName) }]),
    ...(filters.shortageOnly
      ? [{ key: 'shortageOnly' as const, label: t.filters.hasShortage }]
      : []),
    ...(filters.failedOnly ? [{ key: 'failedOnly' as const, label: t.filters.releaseFailed }] : []),
    ...(filters.groupByPlan ? [{ key: 'groupByPlan' as const, label: t.filters.groupByPlan }] : []),
  ];
  const removeHidden = (key: HiddenFilterKey): void => {
    switch (key) {
      /* 공장을 풀면 첫 공장으로 돌아간다. 출발 생산 창고는 공장에 딸려 함께 비운다. */
      case 'plant':
        go(view, { ...filters, plant: '', warehouse: '' });
        return;
      case 'warehouse':
        go(view, { ...filters, warehouse: '' });
        return;
      case 'groupByPlan':
        go(view, { ...filters, groupByPlan: false }, page);
        return;
      default:
        go(view, { ...filters, [key]: false });
    }
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
        <DateRangeFields
          hideLabels
          clearable
          startLabel={t.filters.issueWorkDateFrom}
          endLabel={t.filters.issueWorkDateTo}
          from={draft.workFrom}
          to={draft.workTo}
          onChange={(workFrom, workTo) => setDraft({ ...draft, workFrom, workTo })}
        />
        <DateRangeFields
          hideLabels
          clearable
          startLabel={t.filters.productionDateFrom}
          endLabel={t.filters.productionDateTo}
          from={draft.prodFrom}
          to={draft.prodTo}
          onChange={(prodFrom, prodTo) => setDraft({ ...draft, prodFrom, prodTo })}
        />
        <TextField
          aria-label={t.filters.workOrder}
          placeholder={t.filters.workOrderPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') search();
          }}
        />
        <Button onClick={search}>{t.filters.search}</Button>
        {isChanged && (
          <Button variant="outlined" onClick={reset}>
            {t.filters.reset}
          </Button>
        )}
        <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
      </div>
      {/* `hidden` 은 감싸는 상자에 둔다 — 줄의 display 가 속성을 덮는다. */}
      <div id={more.id} hidden={!more.isOpen}>
        <div className="material-issue-status-filter-row">
          <Select
            aria-label={t.filters.plant}
            /* 처음 열 때(주소에 공장이 없거나 목록을 받기 전)도 실제 조회 중인 공장을 보인다(G2 2). */
            value={draft.plant === '' ? filters.plant : draft.plant}
            options={(plants.data ?? []).map((plant) => ({
              value: String(plant.plantId),
              label: plant.plantName,
            }))}
            onChange={(value) => setDraft({ ...draft, plant: value, warehouse: '' })}
          />
          <Select
            aria-label={t.filters.sourceWarehouse}
            value={draft.warehouse}
            options={[{ value: '', label: t.filters.all }, ...(warehouses.data ?? [])]}
            onChange={(value) => setDraft({ ...draft, warehouse: value })}
          />
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
      </div>
      <HiddenFilterChips open={more.isOpen} chips={hiddenChips} onRemove={removeHidden} />
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
      </div>
    </section>
  );

  const row = (request: MaterialIssueRequestView): ReactNode => (
    <tr
      key={request.materialIssueRequestId}
      aria-selected={request.materialIssueRequestId === selectedId}
    >
      <td>
        <button
          type="button"
          className={`link-cell ${ROW_PICK_CLASS}`}
          aria-current={request.materialIssueRequestId === selectedId ? 'true' : undefined}
          onClick={() => select(request.materialIssueRequestId)}
        >
          {request.issueRequestNo}
        </button>
      </td>
      <td>{request.workOrderNo}</td>
      <td>{formatDay(request.productionDate)}</td>
      <td>{formatDay(request.issueWorkDate)}</td>
      <td>{request.sourceWarehouseName ?? '—'}</td>
      <td>{request.destinationLabel}</td>
      <td>{String(request.lineCount)}</td>
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
        {requestShortage(request) > 0 && (
          <Chip size="sm" status="warning">
            {t.shortageChip(formatQty(requestShortage(request)))}
          </Chip>
        )}
      </td>
    </tr>
  );

  const listBody = (): ReactNode => {
    if (list.isError) {
      return <LoadErrorAlert error={list.error} onRetry={() => void list.refetch()} />;
    }
    if (list.data === undefined) return <Skeleton variant="rect" height="16rem" />;
    const items = list.data.items;
    const groups: PlanGroup[] = filters.groupByPlan
      ? groupByPlan(items)
      : [{ key: 'all', title: '', rows: items }];
    const total = list.data.page.total;

    return (
      <>
        <table
          className="material-issue-status-table"
          aria-label={t.views.list}
          {...rowPickHandlers}
        >
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
          {items.length === 0 ? (
            <tbody>
              <ListEmptyRow colSpan={9} title={t.empty.title} description={t.empty.description} />
            </tbody>
          ) : null}
          {groups.map((group) => (
            <tbody key={group.key}>
              {filters.groupByPlan && (
                <tr className="material-issue-status-group">
                  <th scope="rowgroup" colSpan={9}>
                    <strong>{group.title}</strong>{' '}
                    <span className="field-note">
                      {t.planGroup.meta(
                        group.rows.length,
                        group.rows.filter((request) => requestShortage(request) > 0).length,
                      )}
                    </span>
                  </th>
                </tr>
              )}
              {group.rows.map(row)}
            </tbody>
          ))}
        </table>
        {/* 공용 쪽 이동 줄 — 1쪽 · 0건이어도 늘 보인다(#360). 쪽 크기는 정해진 값(PAGE_SIZE)이라 고르는 칸이 없다. */}
        <PageNav
          meta={{ page, size: PAGE_SIZE, total }}
          onChangePage={(nextPage) => go('list', filters, nextPage)}
        />
      </>
    );
  };

  const body = (): ReactNode => {
    if (plants.isError) {
      return <LoadErrorAlert error={plants.error} onRetry={() => void plants.refetch()} />;
    }
    if (plants.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (plantId === null) return <EmptyState size="sm" title={t.empty.noPlant} />;

    if (view === 'shortage') {
      return (
        <ShortageView
          data={shortage.data}
          isPending={shortage.isPending}
          isError={shortage.isError}
          error={shortage.error}
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
      <ScreenHeader
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
          {/* 「부족」 보기의 두 묶음과 보충 방법은 보기 단추 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */}
          {view === 'shortage' && <InfoTip text={t.shortage.intro} />}
        </div>
        <span className="field-note">{t.today(formatDay(plantToday()))}</span>
      </div>
      {body()}
      {view === 'list' && selectedId !== null && (
        <DetailPanel requestId={selectedId} onClose={() => select(null)} />
      )}
    </>
  );
};
