import { Button, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { SelectableTable } from '../../patterns/selectable-table';
import { describeLineSelect, isLineSelectable, type LineBlockCause } from './line-select';
import {
  describeReference,
  toReference,
  type ItemNameLookup,
  type ReferenceSource,
} from './lookups';
import type { IrLineView } from './types';

const t = messages.goodsReceipt;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 수량 옆 단위 — **코드만 쓴다**(「1 EA」). 「코드 · 이름」(「EA · 개」)은 같은 뜻을 두 번 적는다.
 * 코드를 모르는 갈래(불러오는 중·목록에 없음·실패)는 참조 풀이의 문구를 그대로 낸다.
 */
export const uomCodeOf = (lookup: ReferenceSource, uomId: number): string =>
  lookup.entries.find((entry) => entry.value === String(uomId))?.code ??
  describeReference(toReference(lookup, uomId));

/**
 * 고를 수 없는 줄의 사유 — **원인이 된 칸 안에** 짧은 보조 글자로 둔다(사용자 지시). 고를 수 없는 행이
 * `aria-describedby` 로 이 글자를 잇는다(배치 규범 4 — 사유는 늘 보이는 DOM 텍스트). 경고색을 쓰지
 * 않는다 — 오류가 아니라 아직 조건이 안 된 상태다.
 */
const blockedReasonIn = (
  row: IrLineView,
  cause: LineBlockCause,
  reasonIdPrefix: string,
): ReactNode => {
  const state = describeLineSelect(row);

  return state.kind === 'blocked' && state.cause === cause ? (
    <span id={`${reasonIdPrefix}-${String(row.lineNo)}`} className="goods-receipt-line-cell-reason">
      {state.reason}
    </span>
  ) : null;
};

/**
 * 자재 LOT 칸.
 *
 * **「없다」와 「이름을 못 풀었다」를 가른다.** `lotId`가 `null`인 것은 *아직 LOT이 만들어지지
 * 않았다*는 사실이고, 그것을 참조 풀이에 넘기면 「알 수 없음」으로 나온다 — 그 문구는
 * *값이 잘못됐다*는 뜻이라 사용자에게 반대로 읽힌다(#47과 같은 갈래의 오해다).
 */
export const lotCell = (lookup: ReferenceSource, lotId: number | null): string =>
  lotId === null ? t.values.empty : describeReference(toReference(lookup, lotId));

export interface IrLineColumnsInput {
  /** 품목은 번호마다 하나씩 푼다 — 목록 참조가 아니라 풀이 함수를 받는다. */
  itemNames: ItemNameLookup;
  uomLookup: ReferenceSource;
  lotLookup: ReferenceSource;
  /** 사유 텍스트의 `id` 앞머리 */
  reasonIdPrefix: string;
}

/**
 * 입하 라인 표의 열. **끝 열 [선택] 버튼이 없다** — 행 전체를 눌러 고른다(C-1).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 줄번호 | 72px | 세 자리 |
 * | 품목 | 28% | 「코드 · 이름」 |
 * | 입하 수량 | 140px | 「200 EA」 + 고를 수 없는 사유 |
 * | 자재 LOT | 35% | 긴 LOT 번호 |
 * | 유효기한 | 128px | `YYYY-MM-DD` |
 */
export const buildIrLineColumns = ({
  itemNames,
  uomLookup,
  lotLookup,
  reasonIdPrefix,
}: IrLineColumnsInput): Column<IrLineView>[] => [
  { key: 'lineNo', header: t.lineTable.lineNo, width: '72px' },
  {
    key: 'item',
    header: t.lineTable.item,
    width: '28%',
    render: (row) => describeReference(itemNames.of(row.itemId)),
  },
  {
    key: 'receivedQty',
    header: t.lineTable.receivedQty,
    width: '140px',
    /* **수량을 화면이 고치지 않는다**(계획 결정 4 — 전량 입고라 입력칸이 없다). 그대로 보인다. */
    render: (row) => (
      <>
        <span className="goods-receipt-ir-nowrap">
          {t.lineTable.receivedQtyPair(row.receivedQty, uomCodeOf(uomLookup, row.uomId))}
        </span>
        {blockedReasonIn(row, 'qtyNotPositive', reasonIdPrefix)}
      </>
    ),
  },
  {
    key: 'lot',
    header: t.lineTable.lot,
    width: '35%',
    /* 자재 LOT이 없는 줄은 `—` 대신 그 사유 문구만 둔다(사용자 지시). */
    render: (row) => blockedReasonIn(row, 'noLot', reasonIdPrefix) ?? lotCell(lotLookup, row.lotId),
  },
  {
    key: 'expiryDate',
    header: t.lineTable.expiryDate,
    width: '128px',
    render: (row) => <span className="goods-receipt-ir-nowrap">{orEmptyMark(row.expiryDate)}</span>,
  },
];

export interface IrLineTableProps extends Omit<IrLineColumnsInput, 'reasonIdPrefix'> {
  rows: IrLineView[];
  isLoading: boolean;
  selectedLineId: number | null;
  onSelect: (inboundReceiptLineId: number) => void;
  onRetryReferences: () => void;
}

/**
 * 처리 화면 단계 1 「라인 선택」의 본문 — 입하 라인 표.
 *
 * **한 줄만 고른다**(계획 결정 3). 고를 수 있는지는 `line-select.ts` 한 곳이 판정한다 —
 * 표에는 고를 수 있다고 나오는데 보낼 때 막히는 어긋남을 만들지 않는다.
 */
export const IrLineTable = ({
  rows,
  isLoading,
  itemNames,
  uomLookup,
  lotLookup,
  selectedLineId,
  onSelect,
  onRetryReferences,
}: IrLineTableProps) => {
  const reasonIdPrefix = `${useId()}-reason`;
  const columns = buildIrLineColumns({ itemNames, uomLookup, lotLookup, reasonIdPrefix });

  /* 이 구획이 이름을 내는 참조 셋 중 **하나라도** 실패하면 안내와 복구 수단을 낸다. */
  const hasReferenceError = itemNames.isError || uomLookup.isError || lotLookup.isError;
  /* 잘림은 실패와 다르다 — 다시 시도로 풀리지 않으므로 사실만 밝힌다. */
  const hasTruncatedReference = uomLookup.truncated || lotLookup.truncated;

  return (
    <>
      <h2 className="goods-receipt-section-title goods-receipt-section-title-first">
        {t.lineTable.title}
        <span className="goods-receipt-section-hint">{t.notes.singleLineSelect}</span>
        {hasTruncatedReference && (
          <span className="goods-receipt-section-hint">{t.reasons.lineReferencesTruncated}</span>
        )}
      </h2>

      {isLoading ? (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={2} />
        </div>
      ) : (
        <SelectableTable
          wrapperClassName="wide-table goods-receipt-line-table"
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.inboundReceiptLineId)}
          getRowLabel={(row) => t.lineTable.rowLabel(row.lineNo)}
          isRowSelected={(row) => row.inboundReceiptLineId === selectedLineId}
          isRowDisabled={(row) => !isLineSelectable(row)}
          getRowDescribedBy={(row) =>
            isLineSelectable(row) ? undefined : `${reasonIdPrefix}-${String(row.lineNo)}`
          }
          onRowActivate={(row) => {
            onSelect(row.inboundReceiptLineId);
          }}
          empty={
            <EmptyState
              size="sm"
              live
              title={t.empty.noLinesTitle}
              description={t.empty.noLinesDescription}
            />
          }
        />
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
