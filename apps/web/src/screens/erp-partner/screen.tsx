import {
  AlertBanner,
  Button,
  Checkbox,
  type Column,
  EmptyState,
  SkeletonText,
  TextField,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { BoardFrame } from '../../patterns/board-frame';
import { BoardTable } from '../../patterns/board-table';
import { OneLine } from '../../patterns/po-board';
import { toApiError } from '../../patterns/request';
import { Select } from '../../patterns/select';
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

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다. 조치가 재시도뿐이라 액션도 하나다.
 * 다른 화면 슬라이스의 같은 함수를 가져다 쓰지 않는다 — 슬라이스끼리 참조하면 한쪽 사정이 번진다.
 */
const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      // 서버가 빈 message를 주는 일이 있다. ??는 빈 문자열을 통과시켜 본문을 지운다.
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

const LoadErrorBanner = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <div className="banner-slot">
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {describeLoadError(toApiError(error))}
    </AlertBanner>
  </div>
);

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

const toSearchParams = (filters: Filters, page = 1) => {
  const next = new URLSearchParams();
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.role !== '') next.set('role', filters.role);
  if (filters.includeInactive) next.set('inactive', '1');
  if (page > 1) next.set('page', String(page));
  return next;
};

const toListQuery = (filters: Filters, page: number): PartnerListQuery => ({
  ...(filters.q !== '' ? { q: filters.q } : {}),
  ...(filters.role !== '' ? { roleTypeCode: filters.role } : {}),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
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
  const roleId = useId();
  const { q, role, includeInactive } = applied;

  // 뒤로가기 등으로 주소가 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setDraft({ q, role, includeInactive });
  }, [q, role, includeInactive]);

  return (
    <form
      className="filter-bar"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch({ ...draft, q: draft.q.trim() });
      }}
    >
      <TextField
        label={t.fields.q}
        value={draft.q}
        onChange={(event) => {
          setDraft((prev) => ({ ...prev, q: event.target.value }));
        }}
      />
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
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button type="submit">{messages.common.search}</Button>
          <Button variant="outlined" onClick={onReset}>
            {messages.common.reset}
          </Button>
        </div>
      </div>
    </form>
  );
};

/**
 * 거래처 조회 (ERP). ERP 가 보낸 거래처와 역할(공급사·고객사…)을 읽기만 한다 — 쓰기 조작이 없다.
 *
 * 입고 관리 짜임이다(사용자 지시 2026-10-27): 위에 조회 조건, 아래에 거래처 목록 한 구획. 상세는 두지 않는다 — 상세가
 * 목록 줄과 같은 내용이라(사용자 지시 2026-10-27) 줄을 고르는 일도 없다. 조건·쪽을 전부 주소에 둔다. 역할은 목록
 * 응답에 없어 보이는 행마다 따로 조회한다(`usePartnerRoles`).
 */
export const ErpPartnerScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = readFilters(searchParams);
  const page = readPage(searchParams);

  const list = usePartnerList(toListQuery(filters, page));
  const rows = list.data?.items ?? [];
  const roles = usePartnerRoles(rows.map((row) => row.partnerId));
  const meta = list.data?.page ?? { page, size: 0, total: 0 };

  // 서버가 준 쪽을 정본으로 쓴다. size가 0이면 나눗셈이 무한대가 되므로 하한을 둔다.
  const size = meta.size > 0 ? meta.size : 1;
  const shownPage = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);
  const start = (shownPage - 1) * size + 1;
  const isBeyondLast = meta.total > 0 && shownPage > totalPages;

  /** 조건·쪽을 주소로 옮긴다 — 주소가 바뀌면 목록을 다시 조회한다. */
  const applyQuery = (nextFilters: Filters, nextPage = 1) => {
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  const columns: Column<Partner>[] = [
    { key: 'partnerCode', header: t.table.partnerCode, width: '120px' },
    /* 남는 폭을 이 열이 다 받는다 — 폭을 주지 않는 열은 이것 하나다. */
    {
      key: 'partnerName',
      header: t.table.partnerName,
      render: (row) => <OneLine text={row.partnerName} />,
    },
    {
      key: 'erpPartnerCode',
      header: t.table.erpPartnerCode,
      width: '140px',
      render: (row) => orEmpty(row.erpPartnerCode),
    },
    {
      key: 'countryCode',
      header: t.table.countryCode,
      width: '72px',
      render: (row) => orEmpty(row.countryCode),
    },
    {
      key: 'roles',
      header: t.table.roles,
      width: '180px',
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
    <BoardFrame
      above={{
        label: t.panes.filter,
        content: (
          <>
            {list.isError && (
              <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
            )}
            {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
            <div className="pane po-board-filter">
              <FilterBar
                applied={filters}
                onSearch={(next) => {
                  applyQuery(next);
                }}
                onReset={() => {
                  applyQuery(EMPTY_FILTERS);
                }}
              />
            </div>
          </>
        ),
      }}
      list={{
        label: t.panes.list,
        /* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다. */
        content: list.isError ? null : list.isPending ? (
          <div role="status" aria-label={t.loading.list}>
            <SkeletonText lines={3} />
          </div>
        ) : (
          <>
            <BoardTable
              label={t.panes.list}
              widthKey="omf-mes:erp-partner:columns:partners"
              minWidth="47rem"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.partnerId)}
              empty={emptySlot}
            />
            <nav className="form-actions" aria-label={t.pageNav.label}>
              <p className="field-note form-actions-secondary">
                {rows.length > 0
                  ? t.pageNav.range(start, start + rows.length - 1, meta.total)
                  : t.pageNav.totalOnly(meta.total)}
              </p>
              <Button
                variant="outlined"
                size="sm"
                disabled={shownPage <= 1}
                onClick={() => {
                  applyQuery(filters, shownPage - 1);
                }}
              >
                {t.actions.prevPage}
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={shownPage >= totalPages}
                onClick={() => {
                  applyQuery(filters, shownPage + 1);
                }}
              >
                {t.actions.nextPage}
              </Button>
            </nav>
          </>
        ),
      }}
    />
  );
};
