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
} from './erp-data-parts';
import { type ErpItemListQuery, useErpItemList, useItemTypeLookup, useUomLookup } from './queries';
import type { ErpItem, SelectOption } from './types';

const t = messages.erpItem;

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

/** 쪽 크기 — 고른 적이 없으면 `null`(서버 기본값). */
const readSize = (params: URLSearchParams): PageSize | null => {
  const size = Number(params.get('size') ?? '');
  return PAGE_SIZES.find((option) => option === size) ?? null;
};

const toSearchParams = (filters: Filters, page = 1, size: PageSize | null = null) => {
  const next = new URLSearchParams();
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.itemTypeCode !== '') next.set('type', filters.itemTypeCode);
  if (filters.includeInactive) next.set('inactive', '1');
  if (page > 1) next.set('page', String(page));
  if (size !== null) next.set('size', String(size));
  return next;
};

const toListQuery = (filters: Filters, page: number, size: PageSize | null): ErpItemListQuery => ({
  ...(filters.q !== '' ? { q: filters.q } : {}),
  ...(filters.itemTypeCode !== '' ? { itemTypeCode: [filters.itemTypeCode] } : {}),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
  ...(size !== null ? { size } : {}),
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
  const searchRef = useFitPlaceholderWidth(t.fields.qPlaceholder);
  const typeId = useId();
  const { q, itemTypeCode, includeInactive } = applied;

  // 뒤로가기 등으로 주소가 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setDraft({ q, itemTypeCode, includeInactive });
  }, [q, itemTypeCode, includeInactive]);

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
      <ErpFilterActions onReset={reset} showReset={isChanged} />
    </form>
  );
};

const EMPTY_ROWS: ErpItem[] = [];

/**
 * 품목정보 조회 (ERP) · W-06-17. ERP 가 보낸 품목을 읽기만 한다 — 쓰기 조작이 하나도 없다.
 *
 * 조회 조건 · 목록 | 상세 통일 배치(omf-all-around#358): 목록은 식별 칸만, 고른 품목의 모든 칸은 오른쪽 상세에 「이름 : 값」으로
 * 보인다(같은 목록 응답만 쓴다 — 상세 요청을 따로 보내지 않는다). 조건·쪽을 전부 주소에 둔다.
 * **ERP 에서 온 칸만** 보인다 — 다국어 명칭·LOT 관리 같은 MES 확장 속성은 품목 확장속성 화면의 몫이다. 여기서 함께
 * 보이면 「ERP 가 준 값」으로 읽힌다. 품목그룹은 ERP 코드 그대로 낸다 — 이름을 담은 코드 그룹이 아직 없다(장부 P-67).
 */
export const ErpItemScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters: Filters = {
    q: searchParams.get('q') ?? '',
    itemTypeCode: searchParams.get('type') ?? '',
    includeInactive: searchParams.get('inactive') === '1',
  };
  const page = readPage(searchParams);
  const size = readSize(searchParams);

  const list = useErpItemList(toListQuery(filters, page, size));
  const itemTypes = useItemTypeLookup();
  const uoms = useUomLookup();
  const rows = list.data?.items ?? EMPTY_ROWS;
  const meta = list.data?.page ?? { page, size: size ?? 0, total: 0 };
  const selected = rows.find((row) => String(row.itemId) === selectedId) ?? null;

  // 서버가 준 쪽을 정본으로 쓴다. size가 0이면 나눗셈이 무한대가 되므로 하한을 둔다.
  const shownPage = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / (meta.size > 0 ? meta.size : 1));
  const isBeyondLast = meta.total > 0 && shownPage > totalPages;

  /** 조건·쪽을 주소로 옮긴다 — 주소가 바뀌면 목록을 다시 조회한다. */
  const applyQuery = (nextFilters: Filters, nextPage = 1, nextSize = size) => {
    setSearchParams(toSearchParams(nextFilters, nextPage, nextSize));
  };

  const columns: Column<ErpItem>[] = [
    { key: 'itemCode', header: t.table.itemCode, width: '140px' },
    {
      key: 'itemName',
      header: t.table.itemName,
      width: '200px',
      render: (row) => <OneLine text={row.itemName} />,
    },
    {
      key: 'itemTypeCode',
      header: t.table.itemType,
      width: '112px',
      render: (row) => itemTypes.nameOf(row.itemTypeCode),
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
      storageKey="omf-mes:erp-item"
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
              itemTypeOptions={itemTypes.options}
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
              storageKey="omf-mes:erp-item:columns:items"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.itemId)}
              pick={{
                currentId: selectedId,
                onPick: (row) => {
                  setSelectedId(String(row.itemId));
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
              icon="inventory_2"
              title={t.empty.pickTitle}
              description={t.empty.pickDescription}
            />
          ) : (
            <ErpDetailFields
              title={t.panes.detail}
              fields={[
                { key: 'itemCode', label: t.table.itemCode, value: selected.itemCode },
                { key: 'itemName', label: t.table.itemName, value: selected.itemName },
                {
                  key: 'itemType',
                  label: t.table.itemType,
                  value: itemTypes.nameOf(selected.itemTypeCode),
                },
                { key: 'erpSpec', label: t.table.erpSpec, value: orEmpty(selected.erpSpec) },
                {
                  key: 'erpItemGroupCode',
                  label: t.table.erpItemGroupCode,
                  value: orEmpty(selected.erpItemGroupCode),
                },
                { key: 'baseUom', label: t.table.baseUom, value: uoms.nameOf(selected.baseUomId) },
                { key: 'isActive', label: t.table.isActive, value: activeLabel(selected.isActive) },
              ]}
            />
          ),
      }}
    />
  );
};
