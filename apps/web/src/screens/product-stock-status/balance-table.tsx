import {
  Button,
  Chip,
  type Column,
  EmptyState,
  Progress,
  SkeletonText,
  Table,
  type SortState,
  type ThresholdStop,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { sortableKeysOf, toSortState, type SortKey } from './sort';
import { toGroupKey, toRowKey, type BalanceView } from './types';
import { groupAxisOf, type ViewAxis } from './view-axis';

const t = messages.productStockStatus;

/**
 * 열 폭 예산. **모든 열이 폭을 지정한다** — 디자인 시스템 `Table`은 `table-layout: fixed`이고
 * 폭이 없는 열은 남는 폭의 잔여분을 받아 선언과 실렌더가 어긋난다(W-01-07 브라우저 확인
 * F-B2가 드러낸 문제, `docs/layout-conventions.md`). 이 화면은 열 하나를 흡수 열로 남기지
 * 않고 축 열도 전부 지정한다 — 열이 W-01-07보다 적어(최대 8열) 합이 이미 하한에 가깝다.
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 축(품목·위치) | 200px | 「코드 · 이름」이 한 줄에 들어가는 폭. `docs/layout-conventions.md` 다수 사례와 같은 값 |
 * | LOT | 144px | `SAMPLE-LOT-0001` 형 식별자가 한 줄에 들어가는 폭 |
 * | 보유 | 120px | 수 아래 「음수 보유」 칩이 쌓인다 |
 * | 가용 | 88px | 아래에 쌓이는 것이 없다 |
 * | 가용률 | 140px | 진행 막대 + 「NN%」 표시 |
 * | 보류 | 136px | 수 아래 「보류 LOT n건」 칩이 쌓인다 |
 * | 품질 상태 · 재고 상태 | 각 120px | 코드 배지 하나 |
 * | 상세(LOT별만) | 88px | 「상세」 버튼 하나 |
 *
 * 품목별 합계 924px, LOT별 1,156px, 위치별 1,124px — 흡수 열이 없어 하한(58rem·928px)보다
 * 약간 작아도(품목별) 문제가 아니다. 지정 폭 그대로 렌더되고, 표 폭이 하한보다 작을 뿐이다.
 */
const WIDTH = {
  axis: '200px',
  lot: '144px',
  onHandQty: '120px',
  availableQty: '88px',
  availableRatio: '140px',
  blockedQty: '136px',
  code: '120px',
  select: '88px',
} as const;

export interface BalanceColumnDeps {
  view: ViewAxis;
  itemLookup: LookupSource;
  lotLookup: LookupSource;
  locationLookup: LookupSource;
  /** 지금 상세를 보고 있는 LOT. 주소가 소유하므로 표는 받아 쓰기만 한다. */
  selectedLotId: number | null;
  onToggleSelect: (lotId: number) => void;
}

const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 값 목록이 확정되지 않은 코드의 배지. **중립 변형 하나로만 쓴다** — 값 집합을 모르는 채
 * 색을 가르면 뜻을 지어내는 것이고, 값이 확정됐을 때 화면이 이미 틀린 뜻을 말하게 된다.
 */
const codeChip = (code: string | null): ReactNode =>
  code === null || code === '' ? (
    t.values.empty
  ) : (
    <Chip variant="status" size="sm">
      {code}
    </Chip>
  );

const QTY_ALIGN = 'end' as const;

/** 진행 막대의 색 경계. 낮을수록 위험하다는 통념을 따른다 — 값 목록과 무관한 산술 판정이다. */
const AVAILABLE_RATIO_THRESHOLDS: ThresholdStop[] = [
  { upTo: 50, tone: 'error' },
  { upTo: 80, tone: 'warning' },
];

/**
 * 가용률(가용 ÷ 보유, %). **보유가 0 이하면 계산하지 않는다** — 0으로 나누거나 음수 보유를
 * 나누면 뜻 없는 값이 나온다. 지어내지 않고 「계산 불가」로 낸다.
 */
export const availableRatioOf = (row: BalanceView): number | null => {
  if (row.onHandQty <= 0) return null;

  const percent = Math.round((row.availableQty / row.onHandQty) * 100);

  return Math.min(100, Math.max(0, percent));
};

/**
 * 보기마다의 열 구성. **부품 밖으로 내보내 열 폭 합과 정렬 가능한 열을 값으로 검사한다.**
 */
export const buildBalanceColumns = ({
  view,
  itemLookup,
  lotLookup,
  locationLookup,
  selectedLotId,
  onToggleSelect,
}: BalanceColumnDeps): Column<BalanceView>[] => {
  const itemColumn: Column<BalanceView> = {
    /* 열 `key`를 계약의 정렬 열거값과 같게 둔다 — 정렬 표시가 머리글에 붙으려면 필요하다. */
    key: 'itemCode',
    header: t.table.item,
    width: WIDTH.axis,
    render: (row) => lookupDisplayLabel(itemLookup, row.itemId),
  };

  const lotColumn: Column<BalanceView> = {
    key: 'lotNo',
    header: t.table.lot,
    width: WIDTH.lot,
    /* `null`이 확정된 뜻을 갖는 자리다 — LOT 무관인 줄은 대시로 낸다(빈 값과 같은 표기). */
    render: (row) =>
      row.lotId === null ? t.values.empty : lookupDisplayLabel(lotLookup, row.lotId),
  };

  const locationColumn: Column<BalanceView> = {
    key: 'locationCode',
    header: t.table.location,
    width: WIDTH.axis,
    render: (row) =>
      row.locationId === null ? t.values.empty : lookupDisplayLabel(locationLookup, row.locationId),
  };

  /**
   * 상세 열 — LOT별 보기에만 붙는다. 다른 두 보기의 줄은 `lotId`가 비어 있어 가리킬 LOT이
   * 없다. 접근 이름에 LOT 이름을 넣는다 — 「상세」가 줄마다 되풀이되면 어느 LOT을 여는지
   * 알 수 없다.
   */
  const selectColumn: Column<BalanceView> = {
    key: 'select',
    header: t.table.select,
    width: WIDTH.select,
    render: (row) => {
      if (row.lotId === null) return t.values.empty;

      const lotId = row.lotId;
      const name = lookupDisplayLabel(lotLookup, lotId);
      const isSelected = lotId === selectedLotId;

      return (
        <Button
          variant="outlined"
          size="sm"
          aria-label={isSelected ? t.actions.deselectRow(name) : t.actions.selectRow(name)}
          onClick={() => {
            onToggleSelect(lotId);
          }}
        >
          {isSelected ? t.actions.deselect : t.actions.select}
        </Button>
      );
    },
  };

  const axisColumns: Column<BalanceView>[] = {
    item: [itemColumn],
    lot: [itemColumn, lotColumn],
    location: [locationColumn, itemColumn],
  }[view];

  const columns: Column<BalanceView>[] = [
    ...axisColumns,
    {
      key: 'onHandQty',
      header: t.table.onHandQty,
      width: WIDTH.onHandQty,
      align: QTY_ALIGN,
      render: (row) => (
        <div className="field-cell">
          <span>{row.onHandQty}</span>
          {/* 음수를 허용하는 품목인지 알 수 있는 필드가 계약에 없다 — 오류로 부르지 않는다. */}
          {row.onHandQty < 0 && (
            <Chip variant="status" status="warning" size="sm">
              {t.values.negativeOnHand}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'availableQty',
      header: t.table.availableQty,
      width: WIDTH.availableQty,
      align: QTY_ALIGN,
      /* 서버가 계산해 내려준 값을 그대로 그린다(계약에서 `readonly`) — 화면이 다시 빼지 않는다. */
      render: (row) => row.availableQty,
    },
    {
      key: 'availableRatio',
      header: t.table.availableRatio,
      width: WIDTH.availableRatio,
      render: (row) => {
        const ratio = availableRatioOf(row);

        if (ratio === null) return t.values.availableRatioUnavailable;

        return (
          <Progress
            value={ratio}
            thresholds={AVAILABLE_RATIO_THRESHOLDS}
            tone="success"
            showValue
            size="sm"
            label={t.table.availableRatio}
            valueText={`${String(ratio)}%`}
          />
        );
      },
    },
    {
      key: 'blockedQty',
      header: t.table.blockedQty,
      width: WIDTH.blockedQty,
      align: QTY_ALIGN,
      render: (row) => (
        <div className="field-cell">
          <span>{row.blockedQty}</span>
          {/* 계약이 세어 준 값을 그대로 쓴다 — 0과 「없음」을 함께 감춘다. */}
          {row.heldLotCount !== null && row.heldLotCount > 0 && (
            <Chip variant="status" status="warning" size="sm">
              {t.values.heldLotCount(row.heldLotCount)}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'qualityStatusCode',
      header: t.table.qualityStatus,
      width: WIDTH.code,
      render: (row) => codeChip(row.qualityStatusCode),
    },
    {
      key: 'inventoryStatusCode',
      header: t.table.inventoryStatus,
      width: WIDTH.code,
      render: (row) => codeChip(row.inventoryStatusCode),
    },
    ...(view === 'lot' ? [selectColumn] : []),
  ];

  /*
   * 정렬 가능 여부를 열마다 적지 않고 한 곳에서 파생시킨다 — 열 정의가 스스로 `sortable`을
   * 켜면 계약 열거값 목록과 정본이 둘이 된다.
   */
  const sortable = new Set<string>(sortableKeysOf(view));

  return columns.map((column) => ({ ...column, sortable: sortable.has(column.key) }));
};

export interface BalanceTableProps extends BalanceColumnDeps {
  rows: BalanceView[];
  isLoading: boolean;
  /** 조회가 실제로 나갔는가. 거짓이면 「결과가 없다」로 말하지 않는다. */
  hasQuery: boolean;
  /** 결과는 있는데 이 쪽에는 없다. */
  isBeyondLast: boolean;
  sortKey: SortKey | null;
  onSortChange: (next: SortState | null) => void;
  onFirstPage: () => void;
  /** 이 구획이 이름을 내는 참조(품목·LOT·위치)의 복구. */
  onRetryReferences: () => void;
  referencesFailed: boolean;
}

/**
 * 완제품 재고 잔액 표 — 같은 목록의 세 보기를 한 부품이 그린다. 보기를 부품 셋으로 나누지
 * 않는 이유는 W-01-07과 같다 — 뒤쪽 열이 같고 빈 상태·정렬·안내가 전부 같아, 나누면 같은
 * 규칙이 세 벌로 복제된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const BalanceTable = ({
  view,
  rows,
  isLoading,
  hasQuery,
  isBeyondLast,
  sortKey,
  selectedLotId,
  onSortChange,
  onFirstPage,
  onToggleSelect,
  itemLookup,
  lotLookup,
  locationLookup,
  onRetryReferences,
  referencesFailed,
}: BalanceTableProps) => {
  const columns = buildBalanceColumns({
    view,
    itemLookup,
    lotLookup,
    locationLookup,
    selectedLotId,
    onToggleSelect,
  });
  const groupAxis = groupAxisOf(view);

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.balances}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  /** 조회 전 → 범위 밖 쪽 → 결과 없음 순서로 하나만 낸다. 사용자가 할 조치가 서로 다르다. */
  const emptySlot = (): ReactNode => {
    if (!hasQuery) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.notQueriedTitle}
          description={t.empty.notQueriedDescription}
        />
      );
    }

    if (isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={onFirstPage}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        title={t.empty.noResultTitle}
        description={t.empty.noResultDescription}
      />
    );
  };

  const groupKeyOf = (row: BalanceView): string =>
    toGroupKey(row, groupAxis === 'item' ? 'item' : 'location');

  const groupHeaderOf = (_key: string, groupRows: readonly BalanceView[]): ReactNode => {
    const first = groupRows[0];

    if (first === undefined) return null;

    return groupAxis === 'item'
      ? t.groupHeader.item(lookupDisplayLabel(itemLookup, first.itemId))
      : t.groupHeader.location(lookupDisplayLabel(locationLookup, first.locationId));
  };

  return (
    <>
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={toRowKey}
          /* 제어 정렬이다 — 계약의 `sort`가 전체 결과를 정렬해 쪽을 다시 나눠 준다. */
          sort={hasQuery ? toSortState(sortKey) : null}
          onSortChange={onSortChange}
          groupBy={groupAxis === null ? undefined : groupKeyOf}
          renderGroupHeader={groupAxis === null ? undefined : groupHeaderOf}
          empty={emptySlot()}
        />
      </div>

      {groupAxis !== null && <p className="field-note">{t.notes.groupScope}</p>}

      {referencesFailed && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.listReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
