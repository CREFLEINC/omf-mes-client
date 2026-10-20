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
import { useWorkerDetail, useWorkerList, type Worker, type WorkerListQuery } from './queries';

const t = messages.erpEmployee;

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

/** 주소의 조건. 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다. */
interface Filters {
  q: string;
  includeInactive: boolean;
}

const readPage = (params: URLSearchParams): number => {
  const page = Number(params.get('page') ?? '');
  return Number.isInteger(page) && page > 1 ? page : 1;
};

const toSearchParams = (filters: Filters, page = 1, sel: number | null = null) => {
  const next = new URLSearchParams();
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.includeInactive) next.set('inactive', '1');
  if (page > 1) next.set('page', String(page));
  if (sel !== null) next.set('sel', String(sel));
  return next;
};

const toListQuery = (filters: Filters, page: number): WorkerListQuery => ({
  ...(filters.q !== '' ? { q: filters.q } : {}),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
});

interface FilterBarProps {
  applied: Filters;
  onSearch: (filters: Filters) => void;
  onReset: () => void;
}

/** 입력 중인 값은 이 줄이 갖고, 「조회」를 눌러야 주소로 옮긴다 — 글자마다 요청이 나가지 않게 한다. */
const FilterBar = ({ applied, onSearch, onReset }: FilterBarProps) => {
  const [draft, setDraft] = useState<Filters>(applied);
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

interface DetailPaneProps {
  selectedId: number | null;
}

/**
 * 고른 사원의 상세. 목록에 없는 항목(사업장·연결된 사용자)이 여기서 보인다.
 * 사업장·공장·부서는 계약이 식별자만 주므로 번호 그대로 낸다 — 이름을 지어내지 않는다.
 */
const DetailPane = ({ selectedId }: DetailPaneProps) => {
  const detail = useWorkerDetail(selectedId);

  if (selectedId === null) {
    return <p className="field-note">{t.detail.selectHint}</p>;
  }

  if (detail.isError) {
    return <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  if (detail.data === undefined) {
    return (
      <div role="status" aria-label={t.loading.detail}>
        <SkeletonText lines={2} />
      </div>
    );
  }

  const worker = detail.data;
  const facts = [
    { key: 'workerNo', label: t.table.workerNo, value: worker.workerNo },
    { key: 'workerName', label: t.table.workerName, value: worker.workerName },
    { key: 'nameKo', label: t.table.nameKo, value: orEmpty(worker.nameKo) },
    { key: 'nameVi', label: t.table.nameVi, value: orEmpty(worker.nameVi) },
    {
      key: 'businessUnitId',
      label: t.detail.businessUnitId,
      value: orEmpty(worker.businessUnitId),
    },
    { key: 'plantId', label: t.table.plantId, value: orEmpty(worker.plantId) },
    { key: 'departmentId', label: t.table.departmentId, value: orEmpty(worker.departmentId) },
    { key: 'appUserId', label: t.detail.appUserId, value: orEmpty(worker.appUserId) },
    { key: 'statusCode', label: t.table.statusCode, value: orEmpty(worker.statusCode) },
    { key: 'isActive', label: t.table.isActive, value: activeLabel(worker.isActive) },
  ];

  return (
    <div role="group" aria-label={t.detail.label}>
      <dl className="filter-bar">
        {facts.map((fact) => (
          <div className="field-cell" key={fact.key}>
            <dt className="field-label">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/**
 * 사원정보 조회 (ERP). ERP 가 보낸 작업자를 읽기만 한다 — 쓰기 조작이 하나도 없다.
 *
 * 조건·쪽·고른 사원을 전부 주소에 둔다. 표 아래 상세는 고른 행이 있을 때만 조회한다.
 */
export const ErpEmployeeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: Filters = {
    q: searchParams.get('q') ?? '',
    includeInactive: searchParams.get('inactive') === '1',
  };
  const page = readPage(searchParams);
  const selectedId = Number(searchParams.get('sel') ?? '') || null;

  const list = useWorkerList(toListQuery(filters, page));
  const rows = list.data?.items ?? [];
  const meta = list.data?.page ?? { page, size: 0, total: 0 };

  // 서버가 준 쪽을 정본으로 쓴다. size가 0이면 나눗셈이 무한대가 되므로 하한을 둔다.
  const size = meta.size > 0 ? meta.size : 1;
  const shownPage = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);
  const start = (shownPage - 1) * size + 1;
  const isBeyondLast = meta.total > 0 && shownPage > totalPages;

  /** 조건·쪽이 바뀌면 상세를 닫는다 — 고른 사원이 새 결과에 없을 수 있다. */
  const applyQuery = (nextFilters: Filters, nextPage = 1) => {
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  const columns: Column<Worker>[] = [
    {
      key: 'workerNo',
      header: t.table.workerNo,
      width: '120px',
      render: (row) => (
        // 접근 이름에 사번을 넣는다 — 「상세 보기」가 행마다 되풀이되면 어느 사원인지 알 수 없다.
        <button
          type="button"
          className="link-cell"
          aria-label={t.detail.openAction(row.workerNo)}
          aria-pressed={row.workerId === selectedId}
          onClick={() => {
            setSearchParams(toSearchParams(filters, page, row.workerId));
          }}
        >
          {row.workerNo}
        </button>
      ),
    },
    { key: 'workerName', header: t.table.workerName, width: '140px' },
    { key: 'nameKo', header: t.table.nameKo, render: (row) => orEmpty(row.nameKo) },
    { key: 'nameVi', header: t.table.nameVi, render: (row) => orEmpty(row.nameVi) },
    { key: 'plantId', header: t.table.plantId, width: '88px', align: 'end' },
    {
      key: 'departmentId',
      header: t.table.departmentId,
      width: '88px',
      align: 'end',
      render: (row) => orEmpty(row.departmentId),
    },
    { key: 'statusCode', header: t.table.statusCode, width: '104px' },
    {
      key: 'isActive',
      header: t.table.isActive,
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
            applyQuery(filters);
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
      title={t.empty.noResultTitle}
      description={t.empty.noResultDescription}
    />
  );

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

      {list.isError && <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />}

      <section className="pane" aria-label={t.title}>
        <p className="field-note">{t.readOnlyNote}</p>

        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <FilterBar
          applied={filters}
          onSearch={(next) => {
            applyQuery(next);
          }}
          onReset={() => {
            applyQuery({ q: '', includeInactive: false });
          }}
        />

        {/* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다. */}
        {!list.isError &&
          (list.isPending ? (
            <div role="status" aria-label={t.loading.list}>
              <SkeletonText lines={3} />
            </div>
          ) : (
            <>
              <div className="wide-table">
                <Table
                  density="compact"
                  columns={columns}
                  rows={rows}
                  getRowId={(row) => String(row.workerId)}
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
          ))}
      </section>

      <section className="pane" aria-label={t.detail.label}>
        <DetailPane selectedId={selectedId} />
      </section>
    </>
  );
};
