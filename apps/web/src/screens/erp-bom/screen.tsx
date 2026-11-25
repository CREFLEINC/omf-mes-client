import { Checkbox, Chip, type Column, EmptyState, SkeletonText, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { pickBom, useBomTree, type BomTreeRoot, type BomTreeRow } from '../../patterns/bom-tree';
import { BomTreeCell } from '../../patterns/bom-tree-cell';
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
import { UsageChip } from '../../patterns/usage-chip';
import {
  ERP_DATA_ORIENTATION_KEY,
  ErpDetailFields,
  ErpFilterActions,
  ErpListTable,
  ErpPickEmpty,
} from '../erp-item/erp-data-parts';
import {
  ERP_BOM_TREE,
  erpBomKeys,
  type ItemDetail,
  type ItemSummary,
  type NameOf,
  PARENT_PAGE_SIZE,
  useBomList,
  useItemSummaries,
  useParentItems,
  useItemTypeNames,
  useUomNames,
} from './queries';
import type { Bom } from './types';

const t = messages.erpBom;

/** 필수 여부 — 「필수 · 선택」(「예 · 아니오」가 어색하다 — 사용자 지시 2026-11-24). */
/** 필수 여부 라벨 — 필수는 파랑, 선택은 회색(사용자 지시 2026-11-25 「필수 여부는 라벨 디자인」). */
const MandatoryChip = ({ value }: { value: boolean }) => (
  <Chip variant="status" size="sm" status={value ? 'info' : 'idle'}>
    {value ? t.values.mandatory : t.values.optional}
  </Chip>
);

const formatQty = (qty: number, uom: string): string => `${qty.toLocaleString()} ${uom}`;

/** 손실률은 0~1 비율로 온다(A-8) — 퍼센트로 옮겨 낸다. 부동소수 꼬리는 소수 둘째 자리에서 자른다. */
const formatRate = (rate: number): string => `${String(Math.round(rate * 10000) / 100)}%`;

/** 모품목 목록의 유형 — BOM 이 있는 제품 · 반제품만(원자재 · 상품 · 부자재는 BOM 이 없다). 처음은 제품. */
const PARENT_TYPES = ['FINISHED', 'SEMI_FINISHED'] as const;
const DEFAULT_PARENT_TYPE = 'FINISHED';

/** 주소의 조건 — 검색어 · 유형 · 쪽 · 고른 모품목. 새로고침·뒤로가기·공유가 같은 결과를 낸다. */
interface Filters {
  q: string;
  type: string;
  /** BOM 이 있는 품목만 — 처음은 켜짐. 끄면 주소에 `bom=all`. */
  hasBom: boolean;
}

/** 화면을 처음 열었을 때의 조건. 「초기화」가 돌아가는 자리이기도 하다. */
const DEFAULT_FILTERS: Filters = { q: '', type: DEFAULT_PARENT_TYPE, hasBom: true };

const readId = (value: string | null): number | null => {
  const id = Number(value ?? '');
  return Number.isInteger(id) && id > 0 ? id : null;
};

const readFilters = (params: URLSearchParams): Filters => {
  const type = params.get('type') ?? '';
  return {
    q: params.get('q') ?? '',
    type: (PARENT_TYPES as readonly string[]).includes(type) ? type : DEFAULT_PARENT_TYPE,
    hasBom: params.get('bom') !== 'all',
  };
};

/** 쪽 크기 — 고른 적이 없으면 `null`(종전 크기 그대로). */
const readSize = (params: URLSearchParams): PageSize | null => {
  const size = Number(params.get('size') ?? '');
  return PAGE_SIZES.find((option) => option === size) ?? null;
};

const toSearchParams = (
  filters: Filters,
  page = 1,
  item: number | null = null,
  size: PageSize | null = null,
) => {
  const next = new URLSearchParams();
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.type !== DEFAULT_PARENT_TYPE) next.set('type', filters.type);
  if (!filters.hasBom) next.set('bom', 'all');
  if (page > 1) next.set('page', String(page));
  if (item !== null) next.set('item', String(item));
  if (size !== null) next.set('size', String(size));
  return next;
};

interface FilterBarProps {
  applied: Filters;
  onSearch: (filters: Filters) => void;
  onReset: () => void;
}

/** 모품목 목록의 조건 줄 — 유형은 고르는 즉시, 검색어는 「조회」로 건다. */
const FilterBar = ({ applied, onSearch, onReset }: FilterBarProps) => {
  const typeNameOf = useItemTypeNames();
  const typeId = useId();
  const [q, setQ] = useState(applied.q);
  const searchRef = useFitPlaceholderWidth(t.fields.qPlaceholder);

  // 뒤로가기 등으로 주소가 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setQ(applied.q);
  }, [applied.q]);

  /*
   * 초기화는 치던 검색어도 함께 비운다 — 주소가 이미 처음 값이면 주소가 바뀌지 않아 따라가는 effect 가
   * 깨어나지 않는다. 「초기화」는 바뀐 것이 있을 때만 보인다(C-6).
   */
  const reset = (): void => {
    setQ('');
    onReset();
  };

  const isChanged = hasChangedFilters(DEFAULT_FILTERS, { ...applied, q }, applied);

  return (
    <form
      className="filter-bar erp-data-filter-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch({ ...applied, q: q.trim() });
      }}
    >
      {/* 유형 선택 · 품목 검색 · BOM 있는 품목만 순서(사용자 지시 2026-11-24). */}
      <div className="field-cell">
        <label className="field-label" htmlFor={typeId}>
          {t.fields.itemType}
        </label>
        <Select
          id={typeId}
          value={applied.type}
          options={PARENT_TYPES.map((code) => ({ value: code, label: typeNameOf(code) }))}
          onChange={(value) => {
            onSearch({ ...applied, q: q.trim(), type: value });
          }}
        />
      </div>
      <TextField
        containerClassName={FIT_PLACEHOLDER_CLASS}
        label={t.fields.q}
        placeholder={t.fields.qPlaceholder}
        ref={searchRef}
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
        }}
      />
      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          checked={applied.hasBom}
          onChange={(event) => {
            onSearch({ ...applied, q: q.trim(), hasBom: event.target.checked });
          }}
        >
          {t.fields.hasBom}
        </Checkbox>
      </div>
      <ErpFilterActions onReset={reset} showReset={isChanged} />
    </form>
  );
};

interface BomTreePaneProps {
  root: BomTreeRoot;
  uomNameOf: NameOf;
}

/**
 * 고른 BOM 의 **하이라키**(사용자 지시 2026-10-27 — ERP BOM 뷰어처럼). 모품목 줄 아래로 자품목을 들여 쓰고, 자품목이
 * 또 BOM 을 가지면 그 구성을 한 단계 더 들여 쓴다(`bom-tree.ts`). 처음에는 다 펼친 채로 서고 줄마다 접는다.
 *
 * **ERP 원본 열만** 보인다 — 공정·LOT 추적·자동 차감 같은 MES 확장 열은 품목 확장속성 화면의 몫이다.
 * 소요량은 그 줄의 윗 BOM 기준 수량이다(단계를 곱하지 않는다).
 */
const BomTreePane = ({ root, uomNameOf }: BomTreePaneProps) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useBomTree(root, collapsed, ERP_BOM_TREE);
  const itemOf = useItemSummaries(rows.map((row) => row.itemId));
  const queryClient = useQueryClient();
  /* 받지 못한 하위 구성(BOM 목록 · 구성품)만 다시 부른다 — 받으면 트리가 그 자리부터 다시 펴진다. */
  const retryFailed = (): void => {
    void queryClient.refetchQueries({
      queryKey: erpBomKeys.all,
      predicate: (query) => query.state.status === 'error',
    });
  };

  const toggle = (key: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const columns: Column<BomTreeRow>[] = [
    /*
     * 다섯 열 모두 폭을 주어 상자 폭을 그 비율로 나눈다(사용자 지시 2026-11-25 — 품목코드 칸만 남는 폭을 다 쓰지 않게). 칸 안은 왼쪽 정렬(app.css `.bom-tree-table`)이라
     * 단계마다 들여 쓴 자리 · 연결선이 줄마다 같은 세로선에 선다. 품목명은 옆 칸에 따로 둔다(사용자 지시 2026-11-24) —
     * 이 칸은 펼침 단추 이름에 쓰려고 이름도 넘기고, 보이는 이름은 app.css `.bom-tree-split` 이 감춘다.
     */
    {
      key: 'item',
      header: t.parent.itemCode,
      width: '280px',
      render: (row) => {
        const item = itemOf(row.itemId);
        return (
          <BomTreeCell
            row={row}
            code={item.code}
            name={item.name}
            labels={t.tree}
            onToggle={toggle}
            onRetry={retryFailed}
          />
        );
      },
    },
    {
      key: 'itemName',
      header: t.parent.itemName,
      width: '240px',
      render: (row) => {
        const item = itemOf(row.itemId);
        /* 받기 전 · 못 받음은 코드 칸이 그 사정을 낸다 — 여기는 비운다. */
        return item.code === null ? t.values.empty : <OneLine text={item.name} />;
      },
    },
    {
      key: 'requiredQty',
      header: t.componentTable.requiredQty,
      width: '128px',
      align: 'end',
      render: (row) =>
        row.component === null
          ? t.values.empty
          : formatQty(row.component.requiredQty, uomNameOf(row.component.uomId)),
    },
    {
      key: 'scrapRate',
      header: t.componentTable.scrapRate,
      width: '96px',
      align: 'end',
      render: (row) =>
        row.component === null ? t.values.empty : formatRate(row.component.scrapRate),
    },
    {
      key: 'isMandatory',
      header: t.componentTable.isMandatory,
      /* 머리글 「필수 여부」와 끌기 손잡이가 잘리지 않는 폭(사용자 지시 2026-11-24). */
      width: '104px',
      render: (row) =>
        row.component === null ? (
          t.values.empty
        ) : (
          <MandatoryChip value={row.component.isMandatory} />
        ),
    },
  ];

  return (
    <ErpListTable
      label={t.panes.components}
      className="bom-tree-table bom-tree-split"
      storageKey="omf-mes:erp-bom:columns:tree"
      columns={columns}
      rows={rows}
      getRowId={(row) => row.key}
    />
  );
};

interface ParentFactsProps {
  item: ItemSummary;
  /** 그 품목의 BOM — 받는 중이거나 없으면 `null`(품목 칸만 낸다). */
  bom: Bom | null;
}

/**
 * 모품목 상세(사용자 지시 2026-10-27 「모품목 상세 정보는 표시해줘야지」) — 품목 칸과 그 BOM 칸을 「이름 : 값」으로
 * 하이라키 위에 낸다(omf-all-around#358).
 */
const ParentFacts = ({ item, bom }: ParentFactsProps) => {
  const typeNameOf = useItemTypeNames();
  const uomNameOf = useUomNames();
  const detail = item.item;
  const itemFacts = [
    /* 품목명 · 품목코드 순(사용자 지시 2026-11-24). */
    { key: 'name', label: t.parent.itemName, value: detail?.itemName ?? t.values.empty },
    {
      key: 'code',
      label: t.parent.itemCode,
      value: <span className="bom-tree-code">{item.code ?? item.name}</span>,
    },
    {
      key: 'type',
      label: t.parent.itemType,
      value: detail === null ? t.values.empty : typeNameOf(detail.itemTypeCode),
    },
    {
      key: 'spec',
      label: t.parent.spec,
      value: orEmptyText(detail?.erpSpec),
    },
    {
      key: 'uom',
      label: t.parent.baseUom,
      value: detail === null ? t.values.empty : uomNameOf(detail.baseUomId),
    },
  ];
  const bomFacts =
    bom === null
      ? []
      : [
          { key: 'bom', label: t.parent.bomCode, value: bom.bomCode },
          { key: 'rev', label: t.parent.bomVersion, value: String(bom.bomVersion) },
          /*
           * 상태는 「사용 / 미사용」 라벨로(사용자 지시 2026-11-24 「전반적인 화면의 상태는 사용/미사용」) — 확정(CONFIRMED) ·
           * 사용 중(ACTIVE)은 사용, 그 밖(작성중 · 폐기 · 사용 종료)은 미사용.
           */
          {
            key: 'status',
            label: t.parent.status,
            value: <UsageChip isActive={IN_USE_STATUSES.has(bom.statusCode)} />,
          },
          {
            key: 'effective',
            label: t.parent.effective,
            /* 끝이 없는 BOM 은 「~ —」로 — 끝이 비면 잘린 값처럼 보인다. */
            value: t.parent.effectiveRange(bom.effectiveFrom, bom.effectiveTo ?? t.values.empty),
          },
          {
            key: 'baseQty',
            label: t.parent.baseQty,
            value: formatQty(bom.baseQty, uomNameOf(bom.baseUomId)),
          },
        ];

  return <ErpDetailFields title={t.parent.label} fields={[...itemFacts, ...bomFacts]} />;
};

/** 「사용」으로 보는 BOM 상태 — 계약의 확정(CONFIRMED) · 목 자료의 사용 중(ACTIVE). */
const IN_USE_STATUSES: ReadonlySet<string> = new Set(['CONFIRMED', 'ACTIVE']);

const orEmptyText = (value: string | null | undefined): string =>
  value === null || value === undefined || value === '' ? t.values.empty : value;

const EMPTY_BOMS: Bom[] = [];

type ParentRow = ItemDetail;

/**
 * BOM 조회 (ERP) · W-06-18. ERP 가 보낸 BOM 을 읽기만 한다 — 쓰기 조작이 하나도 없다.
 *
 * 입고 관리 짜임이다(사용자 지시 2026-10-28): 위에 조건(유형 · 품목코드·품목명), 왼쪽 모품목 목록 | 오른쪽 고른 모품목의
 * 상세와 기본 BOM(없으면 첫 BOM) 하이라키. 줄 어디를 눌러도 그 모품목을 고른다. 조건 · 쪽 · 고른 모품목을 전부 주소에 둔다.
 */
export const ErpBomScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const page = readId(searchParams.get('page')) ?? 1;
  const size = readSize(searchParams);
  const parentItemId = readId(searchParams.get('item'));

  const parents = useParentItems({
    itemTypeCode: filters.type,
    ...(filters.hasBom ? { hasBom: true } : {}),
    ...(filters.q === '' ? {} : { q: filters.q }),
    ...(page > 1 ? { page } : {}),
    ...(size === null ? {} : { size }),
  });
  const parentRows = parents.data?.items ?? [];
  const meta = parents.data?.page ?? { page, size: size ?? PARENT_PAGE_SIZE, total: 0 };
  const isBeyondLast =
    meta.total > 0 && meta.page > Math.ceil(meta.total / (meta.size > 0 ? meta.size : 1));

  const list = useBomList(parentItemId === null ? null : { parentItemId });
  const uomNameOf = useUomNames();
  const typeNameOf = useItemTypeNames();
  const parentOf = useItemSummaries(parentItemId === null ? [] : [parentItemId]);
  const bom = pickBom(list.data ?? EMPTY_BOMS) ?? null;

  const parentColumns: Column<ParentRow>[] = [
    /* 고르는 단추 자리 — 품목코드는 굵게. */
    {
      key: 'itemCode',
      header: t.parent.itemCode,
      width: '152px',
      render: (row) => <span className="bom-tree-code bom-code-cell">{row.itemCode}</span>,
    },
    {
      key: 'itemName',
      header: t.parent.itemName,
      width: '200px',
      render: (row) => <OneLine text={row.itemName} />,
    },
    {
      key: 'itemTypeCode',
      header: t.parent.itemType,
      width: '96px',
      render: (row) => typeNameOf(row.itemTypeCode),
    },
    /*
     * 상세의 품목 칸 중 목록 응답(`/mdm/items`)에 있는 값만 — 규격 · 기본 단위(사용자 지시 2026-11-24). BOM 코드 · 개정 번호 ·
     * 상태 · 기준 수량은 BOM 헤더 조회(줄마다 따로 부름)에만 있어 목록에 두지 않는다.
     */
    {
      key: 'erpSpec',
      header: t.parent.spec,
      width: '160px',
      render: (row) => <OneLine text={orEmptyText(row.erpSpec)} />,
    },
    {
      key: 'baseUomId',
      header: t.parent.baseUom,
      width: '96px',
      render: (row) => uomNameOf(row.baseUomId),
    },
  ];

  const listContent = (): ReactNode => {
    // 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다.
    if (parents.isError) {
      return <LoadErrorBanner error={parents.error} onRetry={() => void parents.refetch()} />;
    }
    if (parents.isPending) {
      return (
        <div role="status" aria-label={t.loading.parents}>
          <SkeletonText lines={4} />
        </div>
      );
    }
    return (
      <>
        <ErpListTable
          label={t.panes.parents}
          storageKey="omf-mes:erp-bom:columns:parents"
          columns={parentColumns}
          scrollX
          rows={parentRows}
          getRowId={(row) => String(row.itemId)}
          pick={{
            columnKey: 'itemCode',
            currentId: parentItemId === null ? null : String(parentItemId),
            onPick: (row) => {
              setSearchParams(toSearchParams(filters, page, row.itemId, size));
            },
            onUnpick: () => {
              setSearchParams(toSearchParams(filters, page, null, size));
            },
          }}
          empty={
            <EmptyState
              size="sm"
              live
              title={isBeyondLast ? t.empty.parentsBeyondLast : t.empty.noParentsTitle}
            />
          }
        />
        <PageNav
          meta={meta}
          buttonSize="md"
          onChangePage={(next) => {
            setSearchParams(toSearchParams(filters, next, parentItemId, size));
          }}
          onChangeSize={(next) => {
            setSearchParams(toSearchParams(filters, 1, parentItemId, next));
          }}
        />
      </>
    );
  };

  const treeContent = (): ReactNode => {
    if (list.isError) {
      return <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />;
    }
    if (list.isPending) {
      return (
        <div role="status" aria-label={t.loading.boms}>
          <SkeletonText lines={3} />
        </div>
      );
    }
    if (bom === null) return <EmptyState size="sm" live title={t.empty.noBomTitle} />;

    /* 모품목을 바꾸면 접은 줄을 잊는다 — 다른 BOM 의 경로다. */
    return (
      <BomTreePane
        key={bom.bomId}
        root={{ itemId: bom.parentItemId, bomId: bom.bomId }}
        uomNameOf={uomNameOf}
      />
    );
  };

  const detailContent = (): ReactNode => {
    if (parentItemId === null) {
      return (
        <ErpPickEmpty
          icon="account_tree"
          title={t.empty.noParentTitle}
          description={t.empty.noParentDescription}
        />
      );
    }
    return (
      <div className="erp-data-detail">
        <ParentFacts item={parentOf(parentItemId)} bom={bom} />
        <section className="erp-data-sub" aria-label={t.panes.components}>
          <div className="erp-data-sub-head">
            <h2 className="pane-title">{t.panes.components}</h2>
          </div>
          {treeContent()}
        </section>
      </div>
    );
  };

  return (
    <ListDetailWorkspace
      storageKey="omf-mes:erp-bom"
      orientationKey={ERP_DATA_ORIENTATION_KEY}
      filter={{
        label: t.panes.filter,
        content: (
          <FilterBar
            applied={filters}
            onSearch={(next) => {
              setSearchParams(toSearchParams(next, 1, null, size));
            }}
            onReset={() => {
              setSearchParams(toSearchParams(DEFAULT_FILTERS, 1, null, size));
            }}
          />
        ),
      }}
      list={{
        label: t.panes.parents,
        title: t.panes.parents,
        count: parents.data?.page.total,
        content: listContent(),
      }}
      detail={{ label: t.parent.label, content: detailContent() }}
    />
  );
};
