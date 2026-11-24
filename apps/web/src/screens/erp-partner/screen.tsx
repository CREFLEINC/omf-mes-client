import { Button, Checkbox, type Column, EmptyState, SkeletonText, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { hasChangedFilters } from '../../patterns/filter-more';
import {
  FIT_PLACEHOLDER_CLASS,
  useFitPlaceholderWidth,
} from '../../patterns/fit-placeholder-width';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { OneLine } from '../../patterns/po-board';
import { PAGE_SIZES, PageNav, type PageSize } from '../../patterns/page-nav';
import { Select } from '../../patterns/select';
import { LoadErrorBanner } from '../../patterns/load-error-banner';
import {
  ERP_DATA_ORIENTATION_KEY,
  ErpDetailFields,
  ErpFilterActions,
  ErpListTable,
  ErpPickEmpty,
} from '../erp-item/erp-data-parts';
import {
  type Partner,
  type PartnerListQuery,
  type PartnerRoleCode,
  type RolesState,
  usePartnerList,
  usePartnerRoles,
} from './queries';
import { formatRoles, isRoleCode, ROLE_CODES, roleLabel } from './roles';

const t = messages.erpPartner;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmpty = (value: string | number | null | undefined): ReactNode =>
  value === null || value === undefined || value === '' ? t.values.empty : String(value);

const activeLabel = (isActive: boolean): string => (isActive ? t.values.active : t.values.inactive);

/** 역할 칸. 불러오는 중·실패·없음을 서로 다른 문구로 낸다 — 실패를 「역할 없음」으로 보이면 안 된다. */
const rolesText = (state: RolesState | undefined): string => {
  if (state === undefined || state.kind === 'loading') return t.values.rolesLoading;
  if (state.kind === 'failed') return t.values.rolesFailed;
  const text = formatRoles(state.roles);
  return text === '' ? t.values.empty : text;
};

/** 주소의 조건. 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다. */
interface Filters {
  q: string;
  /** 비어 있으면 역할로 거르지 않는다. */
  role: PartnerRoleCode | '';
  includeInactive: boolean;
}

const EMPTY_FILTERS: Filters = { q: '', role: '', includeInactive: false };

const readFilters = (params: URLSearchParams): Filters => {
  const role = params.get('role') ?? '';
  return {
    q: params.get('q') ?? '',
    // 손으로 고친 주소의 모르는 역할은 버린다 — 그대로 실으면 서버가 400 으로 거절한다.
    role: isRoleCode(role) ? role : '',
    includeInactive: params.get('inactive') === '1',
  };
};

const readPage = (params: URLSearchParams): number => {
  const page = Number(params.get('page') ?? '');
  return Number.isInteger(page) && page > 1 ? page : 1;
};

/** 쪽 크기 — 고른 적이 없으면 `null`(서버 기본값). */
const readSize = (params: URLSearchParams): PageSize | null => {
  const size = Number(params.get('size') ?? '');
  return PAGE_SIZES.find((option) => option === size) ?? null;
};

const toSearchParams = (filters: Filters, page = 1, size: PageSize | null = null) => {
  const next = new URLSearchParams();
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.role !== '') next.set('role', filters.role);
  if (filters.includeInactive) next.set('inactive', '1');
  if (page > 1) next.set('page', String(page));
  if (size !== null) next.set('size', String(size));
  return next;
};

const toListQuery = (filters: Filters, page: number, size: PageSize | null): PartnerListQuery => ({
  ...(filters.q !== '' ? { q: filters.q } : {}),
  ...(filters.role !== '' ? { roleTypeCode: filters.role } : {}),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
  ...(size !== null ? { size } : {}),
});

const ROLE_OPTIONS = [
  { value: '', label: t.values.all },
  ...ROLE_CODES.map((code) => ({ value: code, label: roleLabel(code) })),
];

interface FilterBarProps {
  applied: Filters;
  onSearch: (filters: Filters) => void;
  onReset: () => void;
}

/** 입력 중인 값은 이 줄이 갖고, 「조회」를 눌러야 주소로 옮긴다 — 글자마다 요청이 나가지 않게 한다. */
const FilterBar = ({ applied, onSearch, onReset }: FilterBarProps) => {
  const [draft, setDraft] = useState<Filters>(applied);
  const searchRef = useFitPlaceholderWidth(t.fields.qPlaceholder);
  const roleId = useId();
  const { q, role, includeInactive } = applied;

  // 뒤로가기 등으로 주소가 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setDraft({ q, role, includeInactive });
  }, [q, role, includeInactive]);

  /*
   * 초기화는 초안도 함께 비운다 — 주소가 이미 처음 값이면 주소가 바뀌지 않아 따라가는 effect 가
   * 깨어나지 않고, 치던 값이 그대로 남는다. 「초기화」는 바뀐 것이 있을 때만 보인다(C-6).
   */
  const reset = (): void => {
    setDraft(EMPTY_FILTERS);
    onReset();
  };

  const isChanged = hasChangedFilters(EMPTY_FILTERS, draft, applied);

  return (
    <form
      className="filter-bar erp-data-filter-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch({ ...draft, q: draft.q.trim() });
      }}
    >
      {/* 역할 선택 · 거래처 검색 · 미사용 포함 순서(사용자 지시 2026-11-24). */}
      <div className="field-cell">
        <label className="field-label" htmlFor={roleId}>
          {t.fields.role}
        </label>
        <Select
          id={roleId}
          options={ROLE_OPTIONS}
          value={draft.role}
          onChange={(value) => {
            setDraft((prev) => ({ ...prev, role: isRoleCode(value) ? value : '' }));
          }}
        />
      </div>
      <TextField
        containerClassName={FIT_PLACEHOLDER_CLASS}
        label={t.fields.q}
        placeholder={t.fields.qPlaceholder}
        ref={searchRef}
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

const EMPTY_ROWS: Partner[] = [];

/**
 * 거래처 조회 (ERP). ERP 가 보낸 거래처와 역할(공급사·고객사…)을 읽기만 한다 — 쓰기 조작이 없다.
 *
 * 조회 조건 · 목록 | 상세 통일 배치(omf-all-around#358): 목록은 식별 칸만, 고른 거래처의 모든 칸은 오른쪽 상세에
 * 「이름 : 값」으로 보인다(같은 응답만 쓴다 — 상세 요청을 따로 보내지 않는다). 조건·쪽을 전부 주소에 둔다. 역할은 목록
 * 응답에 없어 보이는 행마다 따로 조회한다(`usePartnerRoles` · 종전 그대로).
 */
export const ErpPartnerScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = readFilters(searchParams);
  const page = readPage(searchParams);
  const size = readSize(searchParams);

  const list = usePartnerList(toListQuery(filters, page, size));
  const rows = list.data?.items ?? EMPTY_ROWS;
  const roles = usePartnerRoles(rows.map((row) => row.partnerId));
  const meta = list.data?.page ?? { page, size: size ?? 0, total: 0 };
  const selected = rows.find((row) => String(row.partnerId) === selectedId) ?? null;

  // 서버가 준 쪽을 정본으로 쓴다. size가 0이면 나눗셈이 무한대가 되므로 하한을 둔다.
  const shownPage = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / (meta.size > 0 ? meta.size : 1));
  const isBeyondLast = meta.total > 0 && shownPage > totalPages;

  /** 조건·쪽을 주소로 옮긴다 — 주소가 바뀌면 목록을 다시 조회한다. */
  const applyQuery = (nextFilters: Filters, nextPage = 1, nextSize = size) => {
    setSearchParams(toSearchParams(nextFilters, nextPage, nextSize));
  };

  const columns: Column<Partner>[] = [
    { key: 'partnerCode', header: t.table.partnerCode, width: '120px' },
    {
      key: 'partnerName',
      header: t.table.partnerName,
      width: '180px',
      render: (row) => <OneLine text={row.partnerName} />,
    },
    {
      key: 'roles',
      header: t.table.roles,
      width: '160px',
      render: (row) => <OneLine text={rolesText(roles.get(row.partnerId))} />,
    },
    {
      key: 'isActive',
      header: t.table.isActive,
      width: '72px',
      render: (row) => activeLabel(row.isActive),
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
            applyQuery(filters);
          }}
        >
          {t.actions.goFirstPage}
        </Button>
      }
    />
  ) : (
    <EmptyState size="sm" live title={t.empty.noResultTitle} />
  );

  return (
    <ListDetailWorkspace
      storageKey="omf-mes:erp-partner"
      orientationKey={ERP_DATA_ORIENTATION_KEY}
      filter={{
        label: t.panes.filter,
        content: (
          <>
            {list.isError && (
              <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
            )}
            {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
            <FilterBar
              applied={filters}
              onSearch={(next) => {
                applyQuery(next);
              }}
              onReset={() => {
                applyQuery(EMPTY_FILTERS);
              }}
            />
          </>
        ),
      }}
      list={{
        label: t.panes.list,
        title: t.panes.list,
        count: list.data?.page.total,
        /* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다. */
        content: list.isError ? null : list.isPending ? (
          <div role="status" aria-label={t.loading.list}>
            <SkeletonText lines={3} />
          </div>
        ) : (
          <>
            <ErpListTable
              label={t.panes.list}
              storageKey="omf-mes:erp-partner:columns:partners"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.partnerId)}
              pick={{
                currentId: selectedId,
                onPick: (row) => {
                  setSelectedId(String(row.partnerId));
                },
                onUnpick: () => {
                  setSelectedId(null);
                },
              }}
              empty={emptySlot}
            />
            <PageNav
              meta={meta}
              buttonSize="md"
              onChangePage={(nextPage) => {
                applyQuery(filters, nextPage);
              }}
              onChangeSize={(nextSize) => {
                applyQuery(filters, 1, nextSize);
              }}
            />
          </>
        ),
      }}
      detail={{
        label: t.panes.detail,
        content:
          selected === null ? (
            <ErpPickEmpty
              icon="handshake"
              title={t.empty.pickTitle}
              description={t.empty.pickDescription}
            />
          ) : (
            <ErpDetailFields
              title={t.panes.detail}
              fields={[
                { key: 'partnerCode', label: t.table.partnerCode, value: selected.partnerCode },
                { key: 'partnerName', label: t.table.partnerName, value: selected.partnerName },
                {
                  key: 'erpPartnerCode',
                  label: t.table.erpPartnerCode,
                  value: orEmpty(selected.erpPartnerCode),
                },
                {
                  key: 'countryCode',
                  label: t.table.countryCode,
                  value: orEmpty(selected.countryCode),
                },
                {
                  key: 'roles',
                  label: t.table.roles,
                  value: rolesText(roles.get(selected.partnerId)),
                },
                { key: 'isActive', label: t.table.isActive, value: activeLabel(selected.isActive) },
              ]}
            />
          ),
      }}
    />
  );
};
