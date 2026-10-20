import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  type Column,
  EmptyState,
  PageHeader,
  SkeletonText,
  Table,
  TextField,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import { isErpCodeGroup } from './erp-groups';
import {
  type CodeGroup,
  type CodeValue,
  type CodeValueListQuery,
  useCodeValues,
  useErpCodeGroups,
} from './queries';

const t = messages.erpCommonCode;

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
  value === null || value === undefined || value === '' ? t.display.empty : String(value);

const activeLabel = (isActive: boolean): string =>
  isActive ? t.display.active : t.display.inactive;

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

/**
 * 주소의 그룹. ERP 여덟 밖의 그룹은 버린다 — 손으로 고친 주소로 MES 자체 그룹을 이 화면에서
 * 보게 되면 「ERP 에서 받은 것」이라는 화면의 약속이 깨진다.
 */
const readGroup = (params: URLSearchParams): string | null => {
  const group = params.get('group') ?? '';
  return isErpCodeGroup(group) ? group : null;
};

const toSearchParams = (group: string | null, filters: ValueFilters, page = 1) => {
  const next = new URLSearchParams();
  if (group !== null) next.set('group', group);
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.includeInactive) next.set('inactive', '1');
  if (page > 1) next.set('page', String(page));
  return next;
};

const toValueQuery = (
  group: string | null,
  filters: ValueFilters,
  page: number,
): CodeValueListQuery | null =>
  group === null
    ? null
    : {
        codeGroupCode: group,
        ...(filters.q !== '' ? { q: filters.q } : {}),
        ...(filters.includeInactive ? { includeInactive: true } : {}),
        ...(page > 1 ? { page } : {}),
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

interface ValuesPaneProps {
  group: string;
  filters: ValueFilters;
  page: number;
  onApply: (filters: ValueFilters, page?: number) => void;
}

/** 고른 그룹의 코드값 표. 조건 줄·쪽 이동을 함께 갖는다. */
const ValuesPane = ({ group, filters, page, onApply }: ValuesPaneProps) => {
  const values = useCodeValues(toValueQuery(group, filters, page));
  const rows = values.data?.items ?? [];
  const meta = values.data?.page ?? { page, size: 0, total: 0 };

  // 서버가 준 쪽을 정본으로 쓴다. size가 0이면 나눗셈이 무한대가 되므로 하한을 둔다.
  const size = meta.size > 0 ? meta.size : 1;
  const shownPage = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);
  const start = (shownPage - 1) * size + 1;
  const isBeyondLast = meta.total > 0 && shownPage > totalPages;

  const columns: Column<CodeValue>[] = [
    { key: 'code', header: t.values.code, width: '120px' },
    { key: 'codeName', header: t.values.codeName },
    { key: 'nameKo', header: t.values.nameKo, render: (row) => orEmpty(row.nameKo) },
    { key: 'nameVi', header: t.values.nameVi, render: (row) => orEmpty(row.nameVi) },
    { key: 'displayOrder', header: t.values.displayOrder, width: '96px', align: 'end' },
    {
      key: 'effectiveFrom',
      header: t.values.effectiveFrom,
      width: '112px',
      render: (row) => orEmpty(row.effectiveFrom),
    },
    {
      key: 'effectiveTo',
      header: t.values.effectiveTo,
      width: '112px',
      render: (row) => orEmpty(row.effectiveTo),
    },
    {
      key: 'isActive',
      header: t.values.isActive,
      width: '88px',
      render: (row) => activeLabel(row.isActive),
    },
  ];

  const emptySlot = isBeyondLast ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.beyondLastTitle}
      description={t.empty.beyondLastDescription}
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
    <EmptyState
      size="sm"
      live
      title={t.empty.noValuesTitle}
      description={t.empty.noValuesDescription}
    />
  );

  return (
    <>
      <h2>{t.values.labelOf(group)}</h2>

      {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <FilterBar
        applied={filters}
        onSearch={(next) => {
          onApply(next);
        }}
        onReset={() => {
          onApply(EMPTY_FILTERS);
        }}
      />

      {values.isError ? (
        <LoadErrorBanner error={values.error} onRetry={() => void values.refetch()} />
      ) : values.isPending ? (
        <div role="status" aria-label={t.loading.values}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <>
          <div className="wide-table">
            <Table
              density="compact"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.codeValueId)}
              empty={emptySlot}
            />
          </div>
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
                onApply(filters, shownPage - 1);
              }}
            >
              {t.actions.prevPage}
            </Button>
            <Button
              variant="outlined"
              size="sm"
              disabled={shownPage >= totalPages}
              onClick={() => {
                onApply(filters, shownPage + 1);
              }}
            >
              {t.actions.nextPage}
            </Button>
          </nav>
        </>
      )}
    </>
  );
};

/**
 * 공통코드 조회 (ERP). ERP 가 보낸 코드 그룹과 코드값을 읽기만 한다 — 쓰기 조작이 없다.
 *
 * 위에서 아래로 ERP 그룹 표 → 고른 그룹의 코드값 표. 어떤 그룹이 ERP 것인지는 `erp-groups.ts`가
 * 정한다(API 가 출처를 내리지 않는다). 그룹·조건·쪽은 전부 주소에 둔다.
 */
export const ErpCommonCodeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const group = readGroup(searchParams);
  const filters: ValueFilters = {
    q: searchParams.get('q') ?? '',
    includeInactive: searchParams.get('inactive') === '1',
  };
  const page = readPage(searchParams);

  const groups = useErpCodeGroups();
  const groupRows = groups.data ?? [];

  const groupColumns: Column<CodeGroup>[] = [
    {
      key: 'groupCode',
      header: t.groups.groupCode,
      width: '160px',
      render: (row) => (
        // 접근 이름에 그룹 코드를 넣는다 — 같은 동작이 행마다 되풀이되면 어느 그룹인지 알 수 없다.
        <button
          type="button"
          className="link-cell"
          aria-label={t.groups.openAction(row.groupCode)}
          aria-pressed={row.groupCode === group}
          onClick={() => {
            // 그룹을 바꾸면 코드값 조건을 비운다 — 앞 그룹의 검색어가 새 그룹을 빈 결과로 만든다.
            setSearchParams(toSearchParams(row.groupCode, EMPTY_FILTERS));
          }}
        >
          {row.groupCode}
        </button>
      ),
    },
    { key: 'groupName', header: t.groups.groupName },
    {
      key: 'description',
      header: t.groups.description,
      render: (row) => orEmpty(row.description),
    },
    {
      key: 'isActive',
      header: t.groups.isActive,
      width: '88px',
      render: (row) => activeLabel(row.isActive),
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />

      <section className="pane" aria-label={t.groups.label}>
        <p className="field-note">{t.readOnlyNote}</p>
        <h2>{t.groups.label}</h2>

        {/* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다. */}
        {groups.isError ? (
          <LoadErrorBanner error={groups.error} onRetry={() => void groups.refetch()} />
        ) : groups.isPending ? (
          <div role="status" aria-label={t.loading.groups}>
            <SkeletonText lines={3} />
          </div>
        ) : (
          <>
            <div className="wide-table">
              <Table
                density="compact"
                columns={groupColumns}
                rows={groupRows}
                getRowId={(row) => String(row.codeGroupId)}
                empty={
                  <EmptyState
                    size="sm"
                    live
                    title={t.empty.noGroupsTitle}
                    description={t.empty.noGroupsDescription}
                  />
                }
              />
            </div>
            {groupRows.length > 0 && (
              <p className="field-note">{t.groups.count(groupRows.length)}</p>
            )}
          </>
        )}
      </section>

      <section className="pane" aria-label={t.values.label}>
        {group === null ? (
          <p className="field-note">{t.values.selectHint}</p>
        ) : (
          <ValuesPane
            group={group}
            filters={filters}
            page={page}
            onApply={(next, nextPage = 1) => {
              setSearchParams(toSearchParams(group, next, nextPage));
            }}
          />
        )}
      </section>
    </>
  );
};
