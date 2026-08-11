import { Button, Chip, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import {
  describeReference,
  isLotHeld,
  toReference,
  type LotReferenceSource,
  type ReferenceSource,
} from './lookups';
import type { ReceiptLineView } from './types';

const t = messages.supplierReturn;

export interface GrLineColumnsInput {
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  lotLookup: LotReferenceSource;
  locationLookup: ReferenceSource;
}

/**
 * 입고 라인 표의 열 구성 — **이 회차에는 넷이고 전부 읽기다.**
 *
 * 선택·보유 수량·반품 수량 세 열은 줄을 고르고 수량을 넣는 회차에서 붙는다. 지금 자리만
 * 잡아 두지 않는 이유는, 고를 수 없는 표에 선택칸이 있으면 **화면이 할 수 있다고 말한 것을
 * 못 하게 되기** 때문이다.
 *
 * **단위 열을 따로 두지 않고 수량 표기에 붙인다**(「100 SAMPLE-EA」 — W-01-03이 세운 처리).
 * 열로 만들면 폭이 130px 더 드는데, 단위는 수량을 읽는 순간에만 필요하다.
 *
 * **줄번호 열을 두지 않는다.** 서버가 부여한 순번이라 사용자에게 뜻이 적고, 이 표에서 줄을
 * 식별하는 것은 품목과 자재 LOT이다 — 열을 늘리는 것보다 줄이는 것이 먼저다.
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | **품목** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다(예산 184px) |
 * | 자재 LOT | 168px | LOT 번호 15자 113px + 4갈래 표기 + **보류 표식** |
 * | 위치 | 136px | 「코드 · 이름」 |
 * | 입고 수량 | 104px | 수 + 단위 표기 |
 * | **지정 폭 합** | **408px** | |
 * | 흡수 열 예산 | 184px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **592px** | `58rem`(928px) 안에 들어간다 |
 *
 * 세 열이 붙는 회차에도 합이 하한 안에 들도록 예산을 미리 잡아 두었다(계획 §5.5).
 */
export const buildGrLineColumns = ({
  itemLookup,
  uomLookup,
  lotLookup,
  locationLookup,
}: GrLineColumnsInput): Column<ReceiptLineView>[] => [
  {
    key: 'item',
    header: t.lineTable.item,
    render: (row) => describeReference(toReference(itemLookup, row.itemId)),
  },
  {
    key: 'lot',
    header: t.lineTable.lot,
    width: '168px',
    /*
     * **보류 표식은 이름 옆에 글자로 붙는다**(색에만 기대지 않는다). 반품해도 보류가
     * 유지된다는 사실을 사용자가 이 자리에서 읽는다 — **막지는 않는다.** 보류된 LOT을
     * 되돌려 보내는 것이 이 화면의 주 용도다.
     */
    render: (row) => (
      <>
        {describeReference(toReference(lotLookup, row.lotId))}
        {isLotHeld(lotLookup, row.lotId) && (
          <>
            {' '}
            <Chip variant="status" size="sm">
              {t.values.lotHeld}
            </Chip>
          </>
        )}
      </>
    ),
  },
  {
    key: 'location',
    header: t.lineTable.location,
    width: '136px',
    render: (row) => describeReference(toReference(locationLookup, row.destinationLocationId)),
  },
  {
    key: 'receiptQty',
    header: t.lineTable.receiptQty,
    align: 'end',
    width: '104px',
    render: (row) =>
      t.lineTable.receiptQtyPair(row.receiptQty, describeReference(toReference(uomLookup, row.uomId))),
  },
];

export interface GrLineTableProps extends GrLineColumnsInput {
  rows: ReceiptLineView[];
  onRetryReferences: () => void;
}

/**
 * 고른 입고 전표의 라인 표.
 *
 * **라인을 따로 부르지 않는다** — 상세 응답이 헤더와 함께 준다. 라인 목록에 쪽 정보가 없어
 * 전건이 오므로 이 표에는 **잘림 판정도 쪽 이동도 없다.**
 *
 * **불러오는 중 갈래를 두지 않는다.** 상세를 기다리는 동안에는 이 구획 자체가 그려지지
 * 않으므로(화면이 골격을 낸다) 여기에 두면 닿을 수 없는 가지가 된다.
 */
export const GrLineTable = ({
  rows,
  itemLookup,
  uomLookup,
  lotLookup,
  locationLookup,
  onRetryReferences,
}: GrLineTableProps) => {
  const columns = buildGrLineColumns({ itemLookup, uomLookup, lotLookup, locationLookup });

  /* 이 구획이 이름을 내는 참조 넷 중 **하나라도** 실패하면 안내와 복구 수단을 낸다. */
  const hasReferenceError =
    itemLookup.isError || uomLookup.isError || lotLookup.isError || locationLookup.isError;

  /*
   * **잘림은 실패와 따로 낸다.** 실패는 「이름을 못 받았다」이고 잘림은 「일부만 받았다」인데,
   * 잘린 목록으로 이름을 풀면 그 뒤의 정상 값이 **「알 수 없음」**으로 찍힌다 —
   * 이 화면 자신이 그 문구를 「값이 잘못됐다는 신호」로 정의해 두었으므로, 밝히지 않으면
   * 사용자가 정상 LOT을 잘못된 값으로 읽는다.
   *
   * **복구 버튼을 붙이지 않는다** — 다시 불러도 같은 쪽이 온다. 사용자가 할 조치가 없고
   * 알아야 할 사실만 있다.
   */
  const hasTruncatedReference =
    itemLookup.truncated || uomLookup.truncated || lotLookup.truncated || locationLookup.truncated;

  /* 보류가 실제로 있을 때만 그 뜻을 밝힌다 — 늘 세워 두면 안내가 배경이 된다. */
  const hasHeldLot = rows.some((row) => isLotHeld(lotLookup, row.lotId));

  const emptySlot = (): ReactNode => (
    <EmptyState
      size="sm"
      live
      title={t.empty.noLinesTitle}
      description={t.empty.noLinesDescription}
    />
  );

  return (
    <>
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.goodsReceiptLineId)}
          empty={emptySlot()}
        />
      </div>

      {hasHeldLot && <p className="field-note">{t.notes.lotHold}</p>}

      {hasTruncatedReference && <p className="field-note">{t.reasons.lineReferencesTruncated}</p>}

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
