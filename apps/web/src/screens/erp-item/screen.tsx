import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  type Column,
  EmptyState,
  PageHeader,
  Select,
  SkeletonText,
  Table,
  TextField,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import {
  type CodeLookup,
  type ErpItemListQuery,
  useErpItemDetail,
  useErpItemList,
  useItemTypeLookup,
  useUomLookup,
} from './queries';
import type { ErpItem, SelectOption } from './types';

const t = messages.erpItem;

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
  itemTypeCode: string;
  includeInactive: boolean;
}

const EMPTY_FILTERS: Filters = { q: '', itemTypeCode: '', includeInactive: false };

const readPage = (params: URLSearchParams): number => {
  const page = Number(params.get('page') ?? '');
  return Number.isInteger(page) && page > 1 ? page : 1;
};

const toSearchParams = (filters: Filters, page = 1, sel: number | null = null) => {
  const next = new URLSearchParams();
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.itemTypeCode !== '') next.set('type', filters.itemTypeCode);
  if (filters.includeInactive) next.set('inactive', '1');
  if (page > 1) next.set('page', String(page));
  if (sel !== null) next.set('sel', String(sel));
  return next;
};

const toListQuery = (filters: Filters, page: number): ErpItemListQuery => ({
  ...(filters.q !== '' ? { q: filters.q } : {}),
  ...(filters.itemTypeCode !== '' ? { itemTypeCode: filters.itemTypeCode } : {}),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
});

interface FilterBarProps {
  applied: Filters;
  itemTypeOptions: SelectOption[];
  onSearch: (filters: Filters) => void;
  onReset: () => void;
}

/** 입력 중인 값은 이 줄이 갖고, 「조회」를 눌러야 주소로 옮긴다 — 글자마다 요청이 나가지 않게 한다. */
const FilterBar = ({ applied, itemTypeOptions, onSearch, onReset }: FilterBarProps) => {
  const [draft, setDraft] = useState<Filters>(applied);
  const typeId = useId();
  const { q, itemTypeCode, includeInactive } = applied;

  // 뒤로가기 등으로 주소가 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setDraft({ q, itemTypeCode, includeInactive });
  }, [q, itemTypeCode, includeInactive]);

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
        <label className="field-label" htmlFor={typeId}>
          {t.fields.itemType}
        </label>
        {/* 유형 목록을 못 받아도 「전체」로는 조회할 수 있다 — 길을 막지 않는다. */}
        <Select
          id={typeId}
          options={[{ value: '', label: t.filters.all }, ...itemTypeOptions]}
          value={draft.itemTypeCode}
          onChange={(value) => {
            setDraft((prev) => ({ ...prev, itemTypeCode: value }));
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

interface DetailPaneProps {
  selectedId: number | null;
  itemTypes: CodeLookup;
  uoms: CodeLookup;
}

/**
 * 고른 품목의 상세. **ERP 에서 온 칸만** 보인다 — 다국어 명칭·LOT 관리 같은 MES 확장 속성은
 * 품목 확장속성 화면의 몫이다. 여기서 함께 보이면 「ERP 가 준 값」으로 읽힌다.
 */
const DetailPane = ({ selectedId, itemTypes, uoms }: DetailPaneProps) => {
  const detail = useErpItemDetail(selectedId);

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

  const item = detail.data;
  const facts = [
    { key: 'itemCode', label: t.table.itemCode, value: item.itemCode },
    { key: 'itemName', label: t.table.itemName, value: item.itemName },
    { key: 'itemType', label: t.table.itemType, value: itemTypes.nameOf(item.itemTypeCode) },
    { key: 'baseUom', label: t.table.baseUom, value: uoms.nameOf(item.baseUomId) },
    { key: 'erpSpec', label: t.table.erpSpec, value: orEmpty(item.erpSpec) },
    {
      key: 'erpItemGroupCode',
      label: t.table.erpItemGroupCode,
      value: orEmpty(item.erpItemGroupCode),
    },
    { key: 'isActive', label: t.table.isActive, value: activeLabel(item.isActive) },
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

const EMPTY_ROWS: ErpItem[] = [];

/**
 * 품목정보 조회 (ERP) · W-06-17. ERP 가 보낸 품목을 읽기만 한다 — 쓰기 조작이 하나도 없다.
 *
 * 조건·쪽·고른 품목을 전부 주소에 둔다. 표 아래 상세는 고른 행이 있을 때만 조회한다.
 * 품목그룹은 ERP 코드 그대로 낸다 — 이름을 담은 코드 그룹이 아직 없다(장부 P-67).
 */
export const ErpItemScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: Filters = {
    q: searchParams.get('q') ?? '',
    itemTypeCode: searchParams.get('type') ?? '',
    includeInactive: searchParams.get('inactive') === '1',
  };
  const page = readPage(searchParams);
  const selectedId = Number(searchParams.get('sel') ?? '') || null;

  const list = useErpItemList(toListQuery(filters, page));
  const itemTypes = useItemTypeLookup();
  const uoms = useUomLookup();
  const rows = list.data?.items ?? EMPTY_ROWS;
  const meta = list.data?.page ?? { page, size: 0, total: 0 };

  // 서버가 준 쪽을 정본으로 쓴다. size가 0이면 나눗셈이 무한대가 되므로 하한을 둔다.
  const size = meta.size > 0 ? meta.size : 1;
  const shownPage = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);
  const start = (shownPage - 1) * size + 1;
  const isBeyondLast = meta.total > 0 && shownPage > totalPages;

  /** 조건·쪽이 바뀌면 상세를 닫는다 — 고른 품목이 새 결과에 없을 수 있다. */
  const applyQuery = (nextFilters: Filters, nextPage = 1) => {
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  const columns: Column<ErpItem>[] = [
    {
      key: 'itemCode',
      header: t.table.itemCode,
      width: '140px',
      render: (row) => (
        // 접근 이름에 품목코드를 넣는다 — 「상세 보기」가 행마다 되풀이되면 어느 품목인지 알 수 없다.
        <button
          type="button"
          className="link-cell"
          aria-label={t.detail.openAction(row.itemCode)}
          aria-pressed={row.itemId === selectedId}
          onClick={() => {
            setSearchParams(toSearchParams(filters, page, row.itemId));
          }}
        >
          {row.itemCode}
        </button>
      ),
    },
    { key: 'itemName', header: t.table.itemName },
    {
      key: 'itemTypeCode',
      header: t.table.itemType,
      width: '112px',
      render: (row) => itemTypes.nameOf(row.itemTypeCode),
    },
    { key: 'erpSpec', header: t.table.erpSpec, render: (row) => orEmpty(row.erpSpec) },
    {
      key: 'erpItemGroupCode',
      header: t.table.erpItemGroupCode,
      width: '112px',
      render: (row) => orEmpty(row.erpItemGroupCode),
    },
    {
      key: 'baseUomId',
      header: t.table.baseUom,
      width: '88px',
      render: (row) => uoms.nameOf(row.baseUomId),
    },
    {
      key: 'isActive',
      header: t.table.isActive,
      width: '80px',
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
          itemTypeOptions={itemTypes.options}
          onSearch={(next) => {
            applyQuery(next);
          }}
          onReset={() => {
            applyQuery(EMPTY_FILTERS);
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
                  getRowId={(row) => String(row.itemId)}
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
        <DetailPane selectedId={selectedId} itemTypes={itemTypes} uoms={uoms} />
      </section>
    </>
  );
};
