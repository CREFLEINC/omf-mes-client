import { AlertBanner, Button, type Column, EmptyState, Icon, SkeletonText } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { BoardFrame } from '../../patterns/board-frame';
import { BoardTable } from '../../patterns/board-table';
import { ItemPickerDialog } from '../../patterns/item-picker';
import { OneLine } from '../../patterns/po-board';
import { toApiError } from '../../patterns/request';
import { pickBom, useBomTree, type BomTreeRoot, type BomTreeRow } from './bom-tree';
import {
  type ItemSummary,
  labelOf,
  type NameOf,
  useBomList,
  useItemLabels,
  useItemSummaries,
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

/** 주소의 조건 — 모품목 하나. 새로고침·뒤로가기·공유가 같은 결과를 낸다. */
const readParent = (params: URLSearchParams): number | null => {
  const id = Number(params.get('item') ?? '');
  return Number.isInteger(id) && id > 0 ? id : null;
};

const toSearchParams = (parentItemId: number | null) => {
  const next = new URLSearchParams();
  if (parentItemId !== null) next.set('item', String(parentItemId));
  return next;
};

/**
 * 모품목 고르는 창의 유형 — 처음은 제품. 원자재 · 상품 · 부자재는 BOM 이 없어 선택지에서 뺀다(사용자 지시 2026-10-27).
 * 남는 것은 제품 · 반제품(과 「전체」)이다.
 */
const DEFAULT_PARENT_TYPE = 'FINISHED';
const EXCLUDED_PARENT_TYPES = ['RAW_MATERIAL', 'MERCHANDISE', 'SUBSIDIARY_MATERIAL'] as const;

interface FilterBarProps {
  parentLabel: string;
  onPick: (parentItemId: number) => void;
  onReset: () => void;
}

/** 조건 줄 — 모품목 하나. 대화상자에서 고르는 순간 조회한다(계약이 모품목을 필수로 요구한다). */
const FilterBar = ({ parentLabel, onPick, onReset }: FilterBarProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const parentLabelId = useId();

  return (
    <>
      <div className="filter-bar">
        <div className="field-cell">
          <span className="field-label" id={parentLabelId}>
            {t.fields.parentItem}
          </span>
          <div className="filter-actions">
            <span role="status" aria-labelledby={parentLabelId}>
              {parentLabel}
            </span>
            <Button
              variant="outlined"
              size="sm"
              onClick={() => {
                setPickerOpen(true);
              }}
            >
              {t.actions.pickParent}
            </Button>
          </div>
        </div>
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button variant="outlined" onClick={onReset}>
              {messages.common.reset}
            </Button>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <ItemPickerDialog
          multiple={false}
          defaultItemTypeCode={DEFAULT_PARENT_TYPE}
          excludeItemTypeCodes={EXCLUDED_PARENT_TYPES}
          /* 지난 자료를 보는 창이다 — 사용 중지된 품목의 BOM 도 찾을 수 있어야 한다. */
          includeInactive
          showAvailability={false}
          confirmLabel={t.actions.confirmPick}
          onClose={() => {
            setPickerOpen(false);
          }}
          onConfirm={(items) => {
            setPickerOpen(false);
            const [picked] = items;
            if (picked !== undefined) onPick(picked.itemId);
          }}
        />
      )}
    </>
  );
};

interface BomTreeCellProps {
  row: BomTreeRow;
  item: ItemSummary;
  onToggle: (key: string) => void;
}

/** 하이라키 칸 — 단계만큼 들여 쓰고, 하위 구성이 있으면 펼치고 접는 단추를 앞에 둔다. */
const BomTreeCell = ({ row, item, onToggle }: BomTreeCellProps) => {
  const label = labelOf(item);
  const canToggle = row.state === 'expanded' || row.state === 'collapsed';
  const note =
    row.state === 'loading'
      ? t.tree.loading
      : row.state === 'failed'
        ? t.tree.failed
        : row.state === 'cycle'
          ? t.tree.cycle
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
      render: (row) => <BomTreeCell row={row} item={itemOf(row.itemId)} onToggle={toggle} />,
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
      value: t.parent.effectiveRange(bom.effectiveFrom, bom.effectiveTo ?? ''),
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

/**
 * BOM 조회 (ERP) · W-06-18. ERP 가 보낸 BOM 을 읽기만 한다 — 쓰기 조작이 하나도 없다.
 *
 * 한 구획이다(사용자 지시 2026-10-27 「모품목 · 구성품으로 좌우 분할하지 말고 하나에서」): 위에 모품목, 아래에 그 품목의
 * 기본 BOM(없으면 첫 BOM) 하이라키. 모품목만 주소에 둔다. 모품목은 공용 품목 선택 대화상자로 고른다 — 품목 마스터가
 * 수천 건이라 선택칸에 담을 수 없다.
 */
export const ErpBomScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const parentItemId = readParent(searchParams);

  const list = useBomList(parentItemId === null ? null : { parentItemId });
  const uomNameOf = useUomNames();
  const itemLabelOf = useItemLabels(parentItemId === null ? [] : [parentItemId]);
  const parentOf = useItemSummaries(parentItemId === null ? [] : [parentItemId]);
  const bom = pickBom(list.data ?? EMPTY_BOMS) ?? null;

  const content = (): ReactNode => {
    if (parentItemId === null) return <EmptyState size="sm" title={t.empty.noParentTitle} />;
    // 조회에 실패했으면 빈 상태를 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다.
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
      above={{
        label: t.panes.filter,
        content: (
          <div className="pane po-board-filter">
            <FilterBar
              parentLabel={parentItemId === null ? t.values.notPicked : itemLabelOf(parentItemId)}
              onPick={(id) => {
                setSearchParams(toSearchParams(id));
              }}
              onReset={() => {
                setSearchParams(toSearchParams(null));
              }}
            />
          </div>
        ),
      }}
      list={{ label: t.panes.components, content: content() }}
    />
  );
};
