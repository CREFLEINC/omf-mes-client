import { Button, Checkbox, type Column, EmptyState, SkeletonText, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { hasChangedFilters } from '../../patterns/filter-more';
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
import { useWorkerList, type Worker, type WorkerListQuery } from './queries';

const t = messages.erpEmployee;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmpty = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? t.values.empty : String(value);

const activeLabel = (isActive: boolean): string => (isActive ? t.values.active : t.values.inactive);

/** 주소의 조건. 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다. */
interface Filters {
  q: string;
  includeInactive: boolean;
}

/** 화면을 처음 열었을 때의 조건. 「초기화」가 돌아가는 자리이기도 하다. */
const EMPTY_FILTERS: Filters = { q: '', includeInactive: false };

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
  if (filters.includeInactive) next.set('inactive', '1');
  if (page > 1) next.set('page', String(page));
  if (size !== null) next.set('size', String(size));
  return next;
};

const toListQuery = (filters: Filters, page: number, size: PageSize | null): WorkerListQuery => ({
  ...(filters.q !== '' ? { q: filters.q } : {}),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
  ...(size !== null ? { size } : {}),
});

interface FilterBarProps {
  applied: Filters;
  onSearch: (filters: Filters) => void;
  onReset: () => void;
}

/** 입력 중인 값은 이 줄이 갖고, 「조회」를 눌러야 주소로 옮긴다 — 글자마다 요청이 나가지 않게 한다. */
const FilterBar = ({ applied, onSearch, onReset }: FilterBarProps) => {
  const [draft, setDraft] = useState<Filters>(applied);
  const searchRef = useFitPlaceholderWidth(t.fields.qPlaceholder);
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

  return (
    <form
      className="filter-bar erp-data-filter-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch({ ...draft, q: draft.q.trim() });
      }}
    >
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

const EMPTY_ROWS: Worker[] = [];

/**
 * 사원정보 조회 (ERP). ERP 가 보낸 작업자를 읽기만 한다 — 쓰기 조작이 하나도 없다.
 *
 * 조회 조건 · 목록 | 상세 통일 배치(omf-all-around#358): 목록은 식별 칸만, 고른 사원의 모든 칸은 오른쪽 상세에
 * 「이름 : 값」으로 보인다(같은 목록 응답만 쓴다 — 상세 요청을 따로 보내지 않는다). 조건·쪽을 전부 주소에 둔다.
 * 공장·부서는 계약이 식별자만 주므로 번호 그대로 낸다 — 이름을 지어내지 않는다. 다국어 명칭은 MES 확장이라 보이지 않는다.
 */
export const ErpEmployeeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters: Filters = {
    q: searchParams.get('q') ?? '',
    includeInactive: searchParams.get('inactive') === '1',
  };
  const page = readPage(searchParams);
  const size = readSize(searchParams);

  const list = useWorkerList(toListQuery(filters, page, size));
  const rows = list.data?.items ?? EMPTY_ROWS;
  const meta = list.data?.page ?? { page, size: size ?? 0, total: 0 };
  const selected = rows.find((row) => String(row.workerId) === selectedId) ?? null;

  // 서버가 준 쪽을 정본으로 쓴다. size가 0이면 나눗셈이 무한대가 되므로 하한을 둔다.
  const shownPage = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / (meta.size > 0 ? meta.size : 1));
  const isBeyondLast = meta.total > 0 && shownPage > totalPages;

  /** 조건·쪽을 주소로 옮긴다 — 주소가 바뀌면 목록을 다시 조회한다. */
  const applyQuery = (nextFilters: Filters, nextPage = 1, nextSize = size) => {
    setSearchParams(toSearchParams(nextFilters, nextPage, nextSize));
  };

  const columns: Column<Worker>[] = [
    { key: 'workerNo', header: t.table.workerNo, width: '120px' },
    {
      key: 'workerName',
      header: t.table.workerName,
      width: '160px',
      render: (row) => <OneLine text={row.workerName} />,
    },
    { key: 'plantId', header: t.table.plantId, width: '72px' },
    {
      key: 'departmentId',
      header: t.table.departmentId,
      width: '72px',
      render: (row) => orEmpty(row.departmentId),
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
      storageKey="omf-mes:erp-employee"
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
              storageKey="omf-mes:erp-employee:columns:workers"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.workerId)}
              pick={{
                currentId: selectedId,
                onPick: (row) => {
                  setSelectedId(String(row.workerId));
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
              icon="badge"
              title={t.empty.pickTitle}
              description={t.empty.pickDescription}
            />
          ) : (
            <ErpDetailFields
              title={t.panes.detail}
              fields={[
                { key: 'workerNo', label: t.table.workerNo, value: selected.workerNo },
                { key: 'workerName', label: t.table.workerName, value: selected.workerName },
                {
                  key: 'businessUnitId',
                  label: t.table.businessUnitId,
                  value: String(selected.businessUnitId),
                },
                { key: 'plantId', label: t.table.plantId, value: String(selected.plantId) },
                {
                  key: 'departmentId',
                  label: t.table.departmentId,
                  value: orEmpty(selected.departmentId),
                },
                { key: 'statusCode', label: t.table.statusCode, value: selected.statusCode },
                { key: 'isActive', label: t.table.isActive, value: activeLabel(selected.isActive) },
              ]}
            />
          ),
      }}
    />
  );
};
