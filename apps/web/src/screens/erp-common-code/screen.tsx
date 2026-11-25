import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useClientPage } from '../../patterns/client-page';
import { hasChangedFilters } from '../../patterns/filter-more';
import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import {
  FIT_PLACEHOLDER_CLASS,
  useFitPlaceholderWidth,
} from '../../patterns/fit-placeholder-width';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { OneLine } from '../../patterns/po-board';
import { PAGE_SIZES, PageNav, type PageSize } from '../../patterns/page-nav';
import { LoadErrorBanner } from '../../patterns/load-error-banner';
import {
  ERP_DATA_ORIENTATION_KEY,
  ErpDetailFields,
  ErpFilterActions,
  ErpListTable,
  ErpPickEmpty,
} from '../erp-item/erp-data-parts';
import { isErpCodeGroup } from './erp-groups';
import {
  type CodeGroup,
  type CodeValue,
  type CodeValueListQuery,
  useCodeValues,
  useErpCodeGroups,
} from './queries';

const t = messages.erpCommonCode;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmpty = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? t.display.empty : String(value);

const activeLabel = (isActive: boolean): string =>
  isActive ? t.display.active : t.display.inactive;

/** 사용 여부 — 라벨 모양(사용자 지시 2026-11-24). 사용은 초록, 미사용은 회색(사원 탭의 재직 라벨과 같다). */
const ActiveChip = ({ isActive }: { isActive: boolean }) => (
  <Chip variant="status" size="sm" status={isActive ? 'success' : 'idle'}>
    {activeLabel(isActive)}
  </Chip>
);

/** 코드그룹 목록의 사용 여부 거르기 — 받은 그룹 안에서 화면이 거른다(서버 조회는 그대로). */
type ActiveFilter = 'all' | 'active' | 'inactive';

/* 「전체」 라벨은 두지 않는다 — 고른 라벨을 다시 누르면 전체로 돌아간다(사용자 지시 2026-11-24). */
const ACTIVE_FILTERS: readonly Exclude<ActiveFilter, 'all'>[] = ['active', 'inactive'];

/**
 * 사용 여부 라벨 「사용 N건 · 미사용 N건」을 탭 줄 위 오른쪽에 낸다(사용자 지시 2026-11-24) — 누르는 즉시 건다.
 * 건수는 지금 그룹 검색어에 맞는 받은 그룹에서 센다. 0건 라벨은 감추고(고른 라벨은 남긴다), 받기 전에는 이름만 낸다.
 */
const ActiveFilterChips = ({
  value,
  counts,
  onChange,
}: {
  value: ActiveFilter;
  counts: Record<Exclude<ActiveFilter, 'all'>, number> | null;
  onChange: (next: ActiveFilter) => void;
}) => {
  const target = useHubActionsTarget();
  const group = (
    <div className="inspection-hub-counts" role="group" aria-label={t.groups.isActive}>
      {ACTIVE_FILTERS.filter(
        (option) => value === option || counts === null || counts[option] !== 0,
      ).map((option) => {
        const label = option === 'active' ? t.display.active : t.display.inactive;
        return (
          <Chip
            key={option}
            variant="filter"
            size="sm"
            selected={value === option}
            aria-pressed={value === option}
            onSelectedChange={() => {
              onChange(value === option ? 'all' : option);
            }}
          >
            {counts === null ? label : t.display.withCount(label, counts[option])}
          </Chip>
        );
      })}
    </div>
  );

  return target === null ? group : <HubActions target={target}>{group}</HubActions>;
};

/** 코드값 조건. 그룹·조건·쪽은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다. */
interface ValueFilters {
  q: string;
  includeInactive: boolean;
}

const EMPTY_FILTERS: ValueFilters = { q: '', includeInactive: false };

const readPage = (params: URLSearchParams): number => {
  const page = Number(params.get('page') ?? '');
  return Number.isInteger(page) && page > 1 ? page : 1;
};

/** 코드값 쪽 크기 — 고른 적이 없으면 `null`(서버 기본값). */
const readSize = (params: URLSearchParams): PageSize | null => {
  const size = Number(params.get('size') ?? '');
  return PAGE_SIZES.find((option) => option === size) ?? null;
};

/**
 * 주소의 그룹. ERP 여덟 밖의 그룹은 버린다 — 손으로 고친 주소로 MES 자체 그룹을 이 화면에서
 * 보게 되면 「ERP 에서 받은 것」이라는 화면의 약속이 깨진다.
 */
const readGroup = (params: URLSearchParams): string | null => {
  const group = params.get('group') ?? '';
  return isErpCodeGroup(group) ? group : null;
};

const toSearchParams = (
  group: string | null,
  filters: ValueFilters,
  page = 1,
  size: PageSize | null = null,
) => {
  const next = new URLSearchParams();
  if (group !== null) next.set('group', group);
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.includeInactive) next.set('inactive', '1');
  if (page > 1) next.set('page', String(page));
  if (size !== null) next.set('size', String(size));
  return next;
};

const toValueQuery = (
  group: string | null,
  filters: ValueFilters,
  page: number,
  size: PageSize | null,
): CodeValueListQuery | null =>
  group === null
    ? null
    : {
        codeGroupCode: group,
        ...(filters.q !== '' ? { q: filters.q } : {}),
        ...(filters.includeInactive ? { includeInactive: true } : {}),
        ...(page > 1 ? { page } : {}),
        ...(size !== null ? { size } : {}),
      };

interface FilterBarProps {
  applied: ValueFilters;
  onSearch: (filters: ValueFilters) => void;
  onReset: () => void;
}

/** 입력 중인 값은 이 줄이 갖고, 「조회」를 눌러야 주소로 옮긴다 — 글자마다 요청이 나가지 않게 한다. */
const FilterBar = ({ applied, onSearch, onReset }: FilterBarProps) => {
  const [draft, setDraft] = useState<ValueFilters>(applied);
  const { q, includeInactive } = applied;

  // 뒤로가기 등으로 주소가 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setDraft({ q, includeInactive });
  }, [q, includeInactive]);

  /*
   * 초기화는 초안도 함께 비운다 — 주소가 이미 처음 값이면 주소가 바뀌지 않아 따라가는 effect 가
   * 깨어나지 않고, 치던 값이 그대로 남는다. 「초기화」는 바뀐 것이 있을 때만 보인다(C-6).
   */
  const reset = (): void => {
    setDraft(EMPTY_FILTERS);
    onReset();
  };

  const isChanged = hasChangedFilters(EMPTY_FILTERS, draft, applied);
  const qRef = useFitPlaceholderWidth(t.fields.qPlaceholder);

  return (
    <form
      className="filter-bar erp-data-filter-row"
      aria-label={t.values.filterLabel}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch({ ...draft, q: draft.q.trim() });
      }}
    >
      <TextField
        containerClassName={FIT_PLACEHOLDER_CLASS}
        label={t.fields.q}
        placeholder={t.fields.qPlaceholder}
        ref={qRef}
        value={draft.q}
        onChange={(event) => {
          setDraft((prev) => ({ ...prev, q: event.target.value }));
        }}
      />
      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          checked={draft.includeInactive}
          onChange={(event) => {
            const { checked } = event.target;
            setDraft((prev) => ({ ...prev, includeInactive: checked }));
          }}
        >
          {t.fields.includeInactive}
        </Checkbox>
      </div>
      <ErpFilterActions onReset={reset} showReset={isChanged} />
    </form>
  );
};

interface ValuesSectionProps {
  group: string;
  /** 제목에 쓰는 그룹명 — 없으면 그룹코드. */
  groupName: string;
  filters: ValueFilters;
  page: number;
  size: PageSize | null;
  onApply: (filters: ValueFilters, page?: number, size?: PageSize | null) => void;
}

/**
 * 고른 그룹의 코드값 — 상세 상자 아래 칸. 조건 줄·쪽 이동을 함께 갖는다(조건이 그룹 목록이 아니라 이 표를 거르므로
 * 위 조회 상자가 아니라 이 칸에 둔다). 코드값 조회는 종전 그대로(그룹 코드 · 검색어 · 미사용 포함 · 쪽).
 */
const ValuesSection = ({ group, groupName, filters, page, size, onApply }: ValuesSectionProps) => {
  const values = useCodeValues(toValueQuery(group, filters, page, size));
  const rows = values.data?.items ?? [];
  const meta = values.data?.page ?? { page, size: size ?? 0, total: 0 };

  // 서버가 준 쪽을 정본으로 쓴다. size가 0이면 나눗셈이 무한대가 되므로 하한을 둔다.
  const shownPage = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / (meta.size > 0 ? meta.size : 1));
  const isBeyondLast = meta.total > 0 && shownPage > totalPages;

  const columns: Column<CodeValue>[] = [
    { key: 'code', header: t.values.code, width: '112px' },
    {
      key: 'codeName',
      header: t.values.codeName,
      width: '180px',
      render: (row) => <OneLine text={row.codeName} />,
    },
    { key: 'displayOrder', header: t.values.displayOrder, width: '80px', align: 'end' },
    /* 유효기간 한 칸 — 공통코드 화면과 같은 「시작 ~ 종료」(사용자 지시 2026-11-24 · 용어 정정). */
    {
      key: 'effectivePeriod',
      header: t.values.effectivePeriod,
      width: '200px',
      render: (row) =>
        row.effectiveFrom == null && row.effectiveTo == null
          ? t.display.empty
          : t.values.period(orEmpty(row.effectiveFrom), orEmpty(row.effectiveTo)),
    },
    {
      key: 'isActive',
      header: t.values.isActive,
      width: '88px',
      align: 'center',
      render: (row) => <ActiveChip isActive={row.isActive} />,
    },
  ];

  const emptySlot = isBeyondLast ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.beyondLastTitle}
      action={
        <Button
          variant="outlined"
          onClick={() => {
            onApply(filters);
          }}
        >
          {t.actions.goFirstPage}
        </Button>
      }
    />
  ) : (
    <EmptyState size="sm" live title={t.empty.noValuesTitle} />
  );

  return (
    <section className="erp-data-sub" aria-label={t.values.label}>
      <div className="erp-data-sub-head">
        <h2 className="pane-title">{t.values.labelOf(groupName)}</h2>
      </div>

      {/*
       * 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. 다른 화면의 조회 조건처럼 상자로
       * 감싼다(사용자 지시 2026-11-24).
       */}
      <div className="pane po-board-filter erp-code-value-filter">
        <FilterBar
          applied={filters}
          onSearch={(next) => {
            onApply(next);
          }}
          onReset={() => {
            onApply(EMPTY_FILTERS);
          }}
        />
      </div>

      {values.isError ? (
        <LoadErrorBanner error={values.error} onRetry={() => void values.refetch()} />
      ) : values.isPending ? (
        <div role="status" aria-label={t.loading.values}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <>
          <ErpListTable
            label={t.values.labelOf(groupName)}
            storageKey="omf-mes:erp-common-code:columns:values"
            /* 줄을 눌러 하는 일이 없다 — 눌리는 것처럼 보이지 않게(사용자 지시 2026-11-25). */
            className="erp-data-list-static"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.codeValueId)}
            empty={emptySlot}
          />
          <PageNav
            meta={meta}
            buttonSize="md"
            onChangePage={(nextPage) => {
              onApply(filters, nextPage);
            }}
            onChangeSize={(nextSize) => {
              onApply(filters, 1, nextSize);
            }}
          />
        </>
      )}
    </section>
  );
};

const NO_GROUPS: CodeGroup[] = [];

const matchesGroup = (row: CodeGroup, q: string): boolean => {
  const needle = q.trim().toLowerCase();
  return (
    needle === '' ||
    row.groupCode.toLowerCase().includes(needle) ||
    row.groupName.toLowerCase().includes(needle)
  );
};

/**
 * 공통코드 조회 (ERP). ERP 가 보낸 코드 그룹과 코드값을 읽기만 한다 — 쓰기 조작이 없다.
 *
 * 조회 조건 · 목록 | 상세 통일 배치(omf-all-around#358): 위 그룹 검색(화면 안에서만 거른다 — 그룹은 이미 다 받는다),
 * 왼쪽 ERP 그룹 목록, 오른쪽 고른 그룹의 모든 칸 + 그 그룹의 코드값(조건 줄 · 표 · 쪽 이동). 어떤 그룹이 ERP 것인지는
 * `erp-groups.ts`가 정한다(API 가 출처를 내리지 않는다). 그룹·코드값 조건·쪽은 전부 주소에 둔다.
 */
export const ErpCommonCodeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [groupSearch, setGroupSearch] = useState('');
  const searchRef = useFitPlaceholderWidth(t.fields.groupSearchPlaceholder);
  const [appliedGroupSearch, setAppliedGroupSearch] = useState('');

  const group = readGroup(searchParams);
  const filters: ValueFilters = {
    q: searchParams.get('q') ?? '',
    includeInactive: searchParams.get('inactive') === '1',
  };
  const page = readPage(searchParams);
  const size = readSize(searchParams);

  const groups = useErpCodeGroups();
  const allGroups = groups.data ?? NO_GROUPS;
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const searchedGroups = allGroups.filter((row) => matchesGroup(row, appliedGroupSearch));
  const shownGroups = searchedGroups.filter(
    (row) => activeFilter === 'all' || row.isActive === (activeFilter === 'active'),
  );
  const activeCounts =
    groups.data === undefined
      ? null
      : {
          active: searchedGroups.filter((row) => row.isActive).length,
          inactive: searchedGroups.filter((row) => !row.isActive).length,
        };
  const groupPage = useClientPage(shownGroups);
  const selected = allGroups.find((row) => row.groupCode === group) ?? null;

  const groupColumns: Column<CodeGroup>[] = [
    { key: 'groupCode', header: t.groups.groupCode, width: '128px' },
    {
      key: 'groupName',
      header: t.groups.groupName,
      width: '160px',
      render: (row) => <OneLine text={row.groupName} />,
    },
    {
      key: 'isActive',
      header: t.groups.isActive,
      width: '88px',
      align: 'center',
      render: (row) => <ActiveChip isActive={row.isActive} />,
    },
  ];

  return (
    <ListDetailWorkspace
      storageKey="omf-mes:erp-common-code"
      orientationKey={ERP_DATA_ORIENTATION_KEY}
      filter={{
        label: t.panes.filter,
        content: (
          <form
            className="filter-bar erp-data-filter-row"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedGroupSearch(groupSearch.trim());
            }}
          >
            <TextField
              containerClassName={FIT_PLACEHOLDER_CLASS}
              label={t.fields.groupSearch}
              placeholder={t.fields.groupSearchPlaceholder}
              ref={searchRef}
              value={groupSearch}
              onChange={(event) => {
                setGroupSearch(event.target.value);
              }}
            />
            <ErpFilterActions
              showReset={hasChangedFilters(
                { q: '' },
                { q: groupSearch },
                { q: appliedGroupSearch },
              )}
              onReset={() => {
                setGroupSearch('');
                setAppliedGroupSearch('');
              }}
            />
          </form>
        ),
      }}
      list={{
        label: t.groups.label,
        title: t.groups.label,
        count: groups.data === undefined ? undefined : shownGroups.length,
        /* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다. */
        content: (
          <>
            {/* 탭 줄 위 「⋯」 왼쪽으로 옮겨진다 — 목록을 불러오기 전에 세워 사원 탭과 같은 순서가 되게 한다. */}
            <ActiveFilterChips
              value={activeFilter}
              counts={activeCounts}
              onChange={setActiveFilter}
            />
            {groups.isError ? (
              <LoadErrorBanner error={groups.error} onRetry={() => void groups.refetch()} />
            ) : groups.isPending ? (
              <div role="status" aria-label={t.loading.groups}>
                <SkeletonText lines={3} />
              </div>
            ) : (
              <>
                <ErpListTable
                  label={t.groups.label}
                  storageKey="omf-mes:erp-common-code:columns:groups"
                  columns={groupColumns}
                  rows={groupPage.rows}
                  /* 그룹 코드가 주소의 값이자 줄의 열쇠다 — 고른 줄을 주소로 바로 맞춘다. */
                  getRowId={(row) => row.groupCode}
                  pick={{
                    currentId: group,
                    onPick: (row) => {
                      // 그룹을 바꾸면 코드값 조건을 비운다 — 앞 그룹의 검색어가 새 그룹을 빈 결과로 만든다.
                      setSearchParams(toSearchParams(row.groupCode, EMPTY_FILTERS, 1, size));
                    },
                    onUnpick: () => {
                      setSearchParams(toSearchParams(null, EMPTY_FILTERS, 1, size));
                    },
                  }}
                  empty={
                    <EmptyState
                      size="sm"
                      live
                      title={allGroups.length === 0 ? t.empty.noGroupsTitle : t.empty.noMatchTitle}
                    />
                  }
                />
                <PageNav {...groupPage.nav} buttonSize="md" />
              </>
            )}
          </>
        ),
      }}
      detail={{
        label: t.panes.detail,
        content:
          group === null ? (
            <ErpPickEmpty
              icon="list_alt"
              title={t.empty.pickTitle}
              description={t.empty.pickDescription}
            />
          ) : (
            <div className="erp-data-detail erp-data-detail-fill">
              <ErpDetailFields
                title={t.panes.detail}
                /* 그룹명 · 그룹코드 · 설명 · 사용 여부 순(사용자 지시 2026-11-24). */
                fields={[
                  {
                    key: 'groupName',
                    label: t.groups.groupName,
                    value: orEmpty(selected?.groupName),
                  },
                  { key: 'groupCode', label: t.groups.groupCode, value: group },
                  {
                    key: 'description',
                    label: t.groups.description,
                    value: orEmpty(selected?.description),
                  },
                  {
                    key: 'isActive',
                    label: t.groups.isActive,
                    value:
                      selected === null ? (
                        t.display.empty
                      ) : (
                        <ActiveChip isActive={selected.isActive} />
                      ),
                  },
                ]}
              />
              <ValuesSection
                group={group}
                groupName={selected?.groupName ?? group}
                filters={filters}
                page={page}
                size={size}
                onApply={(next, nextPage = 1, nextSize = size) => {
                  setSearchParams(toSearchParams(group, next, nextPage, nextSize));
                }}
              />
            </div>
          ),
      }}
    />
  );
};
