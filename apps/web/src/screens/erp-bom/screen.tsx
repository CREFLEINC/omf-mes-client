import {
  AlertBanner,
  Button,
  Checkbox,
  type Column,
  EmptyState,
  Icon,
  Select,
  SkeletonText,
  TextField,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { BoardFrame } from '../../patterns/board-frame';
import { BoardTable } from '../../patterns/board-table';
import { OneLine } from '../../patterns/po-board';
import { toApiError } from '../../patterns/request';
import { PageNav } from '../integration-sync/page-nav';
import { toPageView } from '../integration-sync/pagination';
import { pickBom, useBomTree, type BomTreeRoot, type BomTreeRow } from './bom-tree';
import {
  erpBomKeys,
  type ItemDetail,
  type ItemSummary,
  labelOf,
  type NameOf,
  PARENT_PAGE_SIZE,
  useBomList,
  useItemSummaries,
  useParentItems,
  useItemTypeNames,
  useStatusNames,
  useUomNames,
} from './queries';
import type { Bom } from './types';

const t = messages.erpBom;

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

const yesNo = (value: boolean): string => (value ? t.values.yes : t.values.no);

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

const toSearchParams = (filters: Filters, page = 1, item: number | null = null) => {
  const next = new URLSearchParams();
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.type !== DEFAULT_PARENT_TYPE) next.set('type', filters.type);
  if (!filters.hasBom) next.set('bom', 'all');
  if (page > 1) next.set('page', String(page));
  if (item !== null) next.set('item', String(item));
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

  // 뒤로가기 등으로 주소가 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setQ(applied.q);
  }, [applied.q]);

  return (
    <form
      className="filter-bar"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch({ ...applied, q: q.trim() });
      }}
    >
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
      <TextField
        label={t.fields.q}
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
        }}
      />
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

interface BomTreeCellProps {
  row: BomTreeRow;
  item: ItemSummary;
  onToggle: (key: string) => void;
  /** 하위 구성을 받지 못한 줄의 다시 시도. */
  onRetry: () => void;
}

/** 하이라키 칸 — 단계만큼 들여 쓰고, 하위 구성이 있으면 펼치고 접는 단추를 앞에 둔다. */
const BomTreeCell = ({ row, item, onToggle, onRetry }: BomTreeCellProps) => {
  const label = labelOf(item);
  const canToggle = row.state === 'expanded' || row.state === 'collapsed';
  const note =
    row.state === 'loading'
      ? t.tree.loading
      : row.state === 'failed'
        ? t.tree.failed
        : row.state === 'cycle'
          ? t.tree.cycle
          : row.state === 'depthLimit'
            ? t.tree.depthLimit
            : null;

  return (
    <span className="bom-tree-cell">
      {/* 연결선 — 윗 단계마다 세로선(이어지면 │, 끝났으면 빈칸), 그다음 이 줄의 가지선(├ · └). 뿌리는 없다. */}
      {row.rails.map((pass, level) => (
        <span
          /* 단계 자리라 순서가 곧 열쇠다. */
          key={level}
          className="bom-tree-rail"
          data-line={pass ? 'pass' : 'none'}
          aria-hidden="true"
        />
      ))}
      {row.depth > 0 && (
        <span
          className="bom-tree-rail"
          data-line={row.isLast ? 'elbow' : 'tee'}
          aria-hidden="true"
        />
      )}
      {canToggle ? (
        <button
          type="button"
          className="bom-tree-toggle"
          aria-expanded={row.state === 'expanded'}
          aria-label={row.state === 'expanded' ? t.tree.collapse(label) : t.tree.expand(label)}
          onClick={() => {
            onToggle(row.key);
          }}
        >
          <Icon name={row.state === 'expanded' ? 'expand_more' : 'chevron_right'} size={18} />
        </button>
      ) : (
        /* 하위 구성이 없는 줄은 가지선을 이름 앞까지 끌어온다. */
        <span
          className="bom-tree-spacer"
          data-branch={row.depth > 0 ? 'true' : undefined}
          aria-hidden="true"
        />
      )}
      {/* 품목코드는 굵게(사용자 지시 2026-10-27) — 이름은 넘치면 말줄임. */}
      {item.code !== null && <span className="bom-tree-code">{item.code}</span>}
      <OneLine text={item.code === null ? item.name : `· ${item.name}`} />
      {note !== null && <span className="field-note bom-tree-note">{note}</span>}
      {row.state === 'failed' && (
        <Button variant="text" size="sm" aria-label={t.tree.retry(label)} onClick={onRetry}>
          {messages.common.retry}
        </Button>
      )}
    </span>
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
  const rows = useBomTree(root, collapsed);
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
    /* 폭을 주지 않는 유일한 열 — 들여 쓴 품목 이름이 남는 폭을 다 쓴다. */
    {
      key: 'item',
      header: t.tree.item,
      render: (row) => (
        <BomTreeCell row={row} item={itemOf(row.itemId)} onToggle={toggle} onRetry={retryFailed} />
      ),
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
      width: '80px',
      align: 'end',
      render: (row) =>
        row.component === null ? t.values.empty : formatRate(row.component.scrapRate),
    },
    {
      key: 'isMandatory',
      header: t.componentTable.isMandatory,
      width: '64px',
      render: (row) => (row.component === null ? t.values.empty : yesNo(row.component.isMandatory)),
    },
  ];

  return (
    <BoardTable
      label={t.panes.components}
      className="bom-tree-table"
      widthKey="omf-mes:erp-bom:columns:tree"
      minWidth="38rem"
      columns={columns}
      rows={rows}
      getRowId={(row) => row.key}
    />
  );
};

interface ParentFactsProps {
  item: ItemSummary;
  bom: Bom;
}

/**
 * 모품목 상세(사용자 지시 2026-10-27 「모품목 상세 정보는 표시해줘야지」) — 품목 칸과 그 BOM 칸을 하이라키 위에 한 줄로.
 * 입고 관리 라인 머리의 사실 칸과 같은 모양이다.
 */
const ParentFacts = ({ item, bom }: ParentFactsProps) => {
  const typeNameOf = useItemTypeNames();
  const statusNameOf = useStatusNames();
  const uomNameOf = useUomNames();
  const detail = item.item;
  const facts = [
    { key: 'code', label: t.parent.itemCode, value: item.code ?? item.name, strong: true },
    { key: 'name', label: t.parent.itemName, value: detail?.itemName ?? t.values.empty },
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
    { key: 'bom', label: t.parent.bomCode, value: bom.bomCode },
    { key: 'rev', label: t.parent.bomVersion, value: String(bom.bomVersion) },
    { key: 'status', label: t.parent.status, value: statusNameOf(bom.statusCode) },
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

  return (
    <dl className="po-board-order-facts bom-parent-facts" aria-label={t.parent.label}>
      {facts.map((fact) => (
        <div key={fact.key}>
          <dt>{fact.label}</dt>
          <dd className={fact.strong === true ? 'bom-tree-code' : undefined}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
};

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
  const parentItemId = readId(searchParams.get('item'));

  const parents = useParentItems({
    itemTypeCode: filters.type,
    ...(filters.hasBom ? { hasBom: true } : {}),
    ...(filters.q === '' ? {} : { q: filters.q }),
    ...(page > 1 ? { page } : {}),
  });
  const parentRows = parents.data?.items ?? [];
  const pageView = toPageView(
    parents.data?.page ?? { page, size: PARENT_PAGE_SIZE, total: 0 },
    parentRows.length,
  );

  const list = useBomList(parentItemId === null ? null : { parentItemId });
  const uomNameOf = useUomNames();
  const typeNameOf = useItemTypeNames();
  const parentOf = useItemSummaries(parentItemId === null ? [] : [parentItemId]);
  const bom = pickBom(list.data ?? EMPTY_BOMS) ?? null;

  const parentColumns: Column<ParentRow>[] = [
    /* 고르는 단추 자리(`BoardTable` 의 `pick`) — 품목코드는 굵게. */
    {
      key: 'itemCode',
      header: t.parent.itemCode,
      width: '152px',
      render: (row) => <span className="bom-tree-code bom-code-cell">{row.itemCode}</span>,
    },
    {
      key: 'itemName',
      header: t.parent.itemName,
      render: (row) => <OneLine text={row.itemName} />,
    },
    {
      key: 'itemTypeCode',
      header: t.parent.itemType,
      width: '72px',
      render: (row) => typeNameOf(row.itemTypeCode),
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
        <BoardTable
          label={t.panes.parents}
          widthKey="omf-mes:erp-bom:columns:parents"
          minWidth="26rem"
          columns={parentColumns}
          rows={parentRows}
          getRowId={(row) => String(row.itemId)}
          pick={{
            columnKey: 'itemCode',
            label: (row) => t.pickParent(row.itemCode),
            currentId: parentItemId === null ? null : String(parentItemId),
            onPick: (row) => {
              setSearchParams(toSearchParams(filters, page, row.itemId));
            },
          }}
          empty={
            <EmptyState
              size="sm"
              live
              title={pageView.isBeyondLast ? t.empty.parentsBeyondLast : t.empty.noParentsTitle}
            />
          }
        />
        <PageNav
          view={pageView}
          onChange={(next) => {
            setSearchParams(toSearchParams(filters, next, parentItemId));
          }}
        />
      </>
    );
  };

  const detailContent = (): ReactNode => {
    if (parentItemId === null) return <EmptyState size="sm" title={t.empty.noParentTitle} />;
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
      <>
        <ParentFacts item={parentOf(bom.parentItemId)} bom={bom} />
        <BomTreePane
          key={bom.bomId}
          root={{ itemId: bom.parentItemId, bomId: bom.bomId }}
          uomNameOf={uomNameOf}
        />
      </>
    );
  };

  return (
    <BoardFrame
      splitKey="omf-mes:erp-bom:split"
      initialRatio={0.35}
      splitter={{ label: t.splitter, collapseLabel: t.listCollapse, expandLabel: t.listExpand }}
      above={{
        label: t.panes.filter,
        content: (
          <div className="pane po-board-filter">
            <FilterBar
              applied={filters}
              onSearch={(next) => {
                setSearchParams(toSearchParams(next));
              }}
              onReset={() => {
                setSearchParams(toSearchParams({ q: '', type: DEFAULT_PARENT_TYPE, hasBom: true }));
              }}
            />
          </div>
        ),
      }}
      list={{ label: t.panes.parents, content: listContent() }}
      detail={{ label: t.panes.components, scroll: false, content: detailContent() }}
    />
  );
};
