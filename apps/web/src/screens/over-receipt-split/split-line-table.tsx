import {
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { SplitLineView } from './split-calc';
import type { PoView } from './types';

const t = messages.overReceiptSplit;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

export interface SplitLineColumnsInput {
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  onChangeQty: (purchaseOrderLineId: number, text: string) => void;
}

/**
 * 라인 표의 열 구성.
 *
 * **수량 넷을 네 열에 담는다.** 발주·기입하·잔량·허용을 각각 열로 펴면 지정 폭 합이
 * 1,000px을 넘어 표 하한(`58rem`)을 처음으로 넘긴다. 짝지어 한 칸에 넣으면 그 안에 들어간다 —
 * 「열을 줄이는 것이 먼저다」를 여덟 번째로 적용한 자리다(`docs/layout-conventions.md`).
 *
 * **단위 열을 따로 두지 않는다.** 단위는 수량을 치는 자리에 붙는다 — 열로 만들면 폭이
 * 132px 더 들고, 정작 필요한 순간(수량을 칠 때)에는 눈이 표를 가로질러야 한다.
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 줄번호 | 64px | 두 자리 수 + 우측정렬 여백 |
 * | **품목** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 발주 · 기입하 | 168px | 두 수를 한 칸에(「발주 100 · 기입하 40」) |
 * | 잔량 · 허용 | 160px | 「잔량 60 (+5)」 |
 * | **이번 도착 수량** | 160px | 입력칸 + 단위 표기 + 인라인 오류가 들어가는 폭 |
 * | 정량 · 초과 | 160px | 화면이 만든 두 값을 한 칸에 |
 * | **지정 폭 합** | **712px** | |
 * | 흡수 열 예산 | 200px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **912px** | `58rem`(928px) 안에 들어간다 — 16px 여유 |
 *
 * 흡수 열이 실제로 받는 폭은 216px(928 − 712)로 예산 200px보다 넓다.
 */
export const buildSplitLineColumns = ({
  itemLookup,
  uomLookup,
  onChangeQty,
}: SplitLineColumnsInput): Column<SplitLineView>[] => [
  {
    key: 'lineNo',
    header: t.lineTable.lineNo,
    align: 'end',
    width: '64px',
    render: (row) => row.line.lineNo,
  },
  {
    key: 'item',
    header: t.lineTable.item,
    render: (row) => describeReference(toReference(itemLookup, row.line.itemId)),
  },
  {
    key: 'ordered',
    header: t.lineTable.ordered,
    align: 'end',
    width: '168px',
    render: (row) => t.lineTable.orderedPair(row.line.orderedQty, row.line.receivedQty),
  },
  {
    key: 'remaining',
    header: t.lineTable.remaining,
    align: 'end',
    width: '160px',
    /* 잔량은 **화면이 만든 값이다** — 계약이 내려주는 것은 발주 수량과 누적 입하뿐이다. */
    render: (row) => t.lineTable.remainingPair(row.remainingQty, row.line.toleranceOverQty),
  },
  {
    key: 'arrivedQty',
    header: t.lineTable.arrivedQty,
    width: '160px',
    /*
     * **표 안의 입력칸** — 이 저장소의 첫 사례다. 보이는 라벨을 둘 자리가 없어
     * `aria-label`로 준다(배치 규범 3의 이탈 조건이 이 형태를 이미 정했다).
     *
     * 단위는 `helperText`로 붙인다. 오류가 있으면 디자인 시스템이 오류 문구로 대체하는데,
     * 그 순간에는 단위보다 「무엇이 잘못됐는지」가 먼저 읽혀야 하므로 그 규칙을 그대로 쓴다.
     */
    render: (row) => (
      <TextField
        type="number"
        size="sm"
        fullWidth
        inputMode="decimal"
        aria-label={t.lineTable.arrivedQtyLabel(row.line.lineNo)}
        value={row.qtyText}
        error={row.qtyError ?? undefined}
        helperText={t.lineTable.uomNote(describeReference(toReference(uomLookup, row.line.uomId)))}
        onChange={(event) => {
          onChangeQty(row.line.purchaseOrderLineId, event.target.value);
        }}
      />
    ),
  },
  {
    key: 'split',
    header: t.lineTable.split,
    align: 'end',
    width: '160px',
    /*
     * **이 칸의 값을 여기서 계산하지 않는다.** 잔량·한도·가르기는 `split-calc.ts`가 한 번만 하고
     * 표는 받은 결과를 그린다 — 두 곳에서 계산하면 보이는 값과 보내는 값이 갈린다.
     */
    render: (row) =>
      row.split === null
        ? t.values.notSplit
        : t.lineTable.splitPair(row.split.normalQty, row.split.excessQty),
  },
];

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

export interface SplitLineTableProps extends SplitLineColumnsInput {
  /** 고른 발주. 제목줄의 자료는 목록 응답의 행에 이미 있어 상세 경로를 부르지 않는다. */
  purchaseOrder: PoView;
  /**
   * 공급사는 **위 구획이 실패 안내와 복구를 소유**하므로 이름만 받는다.
   * 이 부품에 번호를 문자열로 만드는 자리는 어느 쪽에도 없다.
   */
  supplierName: string;
  rows: SplitLineView[];
  isLoading: boolean;
  /**
   * 공장 — **이름이 이 구획의 제목줄에서만 보인다.** 그래서 실패 안내와 다시 시도도
   * 여기가 소유하고, 그러려면 이름이 아니라 참조 자체를 받아 실패 여부를 알아야 한다.
   */
  plantLookup: ReferenceSource;
  onRetryReferences: () => void;
}

/**
 * 고른 발주의 라인 표와 그 제목줄. **이 화면이 파생값을 그리는 자리다.**
 *
 * 지금까지의 조회 화면은 서버가 준 값을 그대로 그렸다. 이 표의 「잔량 · 허용」과
 * 「정량 · 초과」는 화면이 만든 값이라, 그 사실을 표 아래 안내가 밝힌다 —
 * 서버가 정한 값으로 읽히면 사용자가 수량을 다시 보지 않는다.
 *
 * **상세 경로를 부르지 않는다.** 제목줄에 필요한 값은 전부 목록 응답의 행에 들어 있다.
 */
export const SplitLineTable = ({
  purchaseOrder,
  supplierName,
  rows,
  isLoading,
  plantLookup,
  itemLookup,
  uomLookup,
  onChangeQty,
  onRetryReferences,
}: SplitLineTableProps) => {
  const columns = buildSplitLineColumns({ itemLookup, uomLookup, onChangeQty });

  const summary: SummaryItem[] = [
    {
      key: 'purchaseOrderNo',
      label: t.summary.purchaseOrderNo,
      value: purchaseOrder.purchaseOrderNo,
    },
    { key: 'supplier', label: t.summary.supplier, value: supplierName },
    {
      key: 'plant',
      label: t.summary.plant,
      value: describeReference(toReference(plantLookup, purchaseOrder.plantId)),
    },
    { key: 'orderDate', label: t.summary.orderDate, value: purchaseOrder.orderDate },
    {
      key: 'expectedReceiptDate',
      label: t.summary.expectedReceiptDate,
      value: orEmptyMark(purchaseOrder.expectedReceiptDate),
    },
    {
      key: 'status',
      label: t.summary.status,
      value: (
        <Chip variant="status" size="sm">
          {purchaseOrder.statusCode}
        </Chip>
      ),
    },
  ];

  /* 이 구획이 이름을 내는 참조 셋 중 **하나라도** 실패하면 안내와 복구 수단을 낸다. */
  const hasReferenceError = itemLookup.isError || uomLookup.isError || plantLookup.isError;

  return (
    <>
      {/*
       * 값 표기다 — 폼 컨트롤을 잠그지 않는다(배치 규범 3). `role="group"`을 명시해
       * 제목줄 전체가 하나의 이름을 갖게 한다.
       */}
      <div role="group" aria-label={t.summary.label}>
        <dl className="filter-bar">
          {summary.map((item) => (
            <div className="field-cell" key={item.key}>
              <dt className="field-label">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {isLoading ? (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={2} />
        </div>
      ) : (
        <>
          <div className="wide-table">
            <Table
              density="compact"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.line.purchaseOrderLineId)}
              empty={
                <EmptyState
                  size="sm"
                  live
                  title={t.empty.noLinesTitle}
                  description={t.empty.noLinesDescription}
                />
              }
            />
          </div>

          {/* 파생값이라는 사실과 빈 칸이 오류가 아니라는 사실은 화면에서 읽혀야 한다. */}
          <p className="field-note">{t.notes.splitDerived}</p>
          <p className="field-note">{t.notes.arrivedQtyOptional}</p>
        </>
      )}

      {hasReferenceError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.lineReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
