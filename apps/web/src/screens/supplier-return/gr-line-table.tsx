import { Button, Checkbox, Chip, type Column, EmptyState, Table, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import {
  describeReference,
  isLotHeld,
  toReference,
  type LotReferenceSource,
  type ReferenceSource,
} from './lookups';
import { describeOnHand } from './on-hand';
import { describeReturnSelection, type ReturnLineRow } from './return-selection';

const t = messages.supplierReturn;

export interface GrLineColumnsInput {
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  lotLookup: LotReferenceSource;
  locationLookup: ReferenceSource;
  /** 잠금 사유 `id`의 앞머리. 고를 수 없는 줄의 두 컨트롤을 한 사유에 잇는다. */
  reasonIdPrefix: string;
  onToggleSelect: (goodsReceiptLineId: number) => void;
  onChangeQty: (goodsReceiptLineId: number, text: string) => void;
}

/**
 * 입고 라인 표의 열 구성 — **일곱이고 그중 둘이 입력칸이다.**
 *
 * **단위 열을 따로 두지 않고 수량 표기에 붙인다**(「100 SAMPLE-EA」 — W-01-03이 세운 처리).
 * 열로 만들면 폭이 130px 더 드는데, 단위는 수량을 읽는 순간에만 필요하다.
 *
 * **줄번호 열을 두지 않는다.** 서버가 부여한 순번이라 사용자에게 뜻이 적고, 이 표에서 줄을
 * 식별하는 것은 품목과 자재 LOT이다 — 열을 늘리는 것보다 줄이는 것이 먼저다.
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 선택 | 56px | `Checkbox` 하나(머리글은 「선택」) |
 * | **품목** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다(예산 184px) |
 * | 자재 LOT | 168px | LOT 번호 15자 113px + 4갈래 표기 + **보류 표식** |
 * | 위치 | 136px | 「코드 · 이름」 |
 * | 입고 수량 | 104px | 수 + 단위 표기 |
 * | 보유 수량 | 120px | 수 + 단위 표기 · **「확인하지 못함」** 표식 |
 * | **반품 수량** | 136px | `sm` `TextField` + 인라인 오류 + **잠금 사유** |
 * | **지정 폭 합** | **720px** | |
 * | 흡수 열 예산 | 184px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **904px** | `58rem`(928px) 안에 들어간다 — 24px 여유 |
 *
 * **잠금 사유가 반품 수량 칸에 붙는 이유**: 선택 열은 체크박스 하나 폭(56px)이라 문장이 들어갈
 * 자리가 없다. 사유는 넓은 칸에 한 번만 그리고, **선택칸과 수량칸이 함께**
 * `aria-describedby`로 그것을 가리킨다 — 같은 문장을 두 번 그리면 화면이 같은 말을 되풀이한다.
 *
 * **판정을 여기서 만들지 않는다**(완료 조건 C31). 고를 수 있는가·골라졌는가·오류가 무엇인가는
 * 전부 `return-selection.ts`가 낸 줄에 실려 온다. 표가 다시 판정하면 표시와 저장 판정이 갈리고,
 * **되돌릴 수 없는 쓰기**에서 그 어긋남은 잘못된 반품 전표로 남는다.
 */
export const buildGrLineColumns = ({
  itemLookup,
  uomLookup,
  lotLookup,
  locationLookup,
  reasonIdPrefix,
  onToggleSelect,
  onChangeQty,
}: GrLineColumnsInput): Column<ReturnLineRow>[] => {
  const reasonIdOf = (row: ReturnLineRow): string => `${reasonIdPrefix}-${String(row.ordinal)}`;
  const uomNameOf = (row: ReturnLineRow): string =>
    describeReference(toReference(uomLookup, row.line.uomId));

  return [
    {
      key: 'select',
      header: t.lineTable.select,
      width: '56px',
      /*
       * **디자인 시스템 `Table`의 `selectable`을 쓰지 않는다**(계획 §5.5). 그 prop은 행마다
       * 고를 수 있는지를 받지 않아 **전 행에 체크박스를 그리고**, 「전체 선택」이 고를 수 없는
       * 줄까지 집는다. 사유를 붙일 자리도 없다.
       */
      render: (row) => {
        const blocked = row.select.kind === 'blocked';

        return (
          <Checkbox
            aria-label={t.lineTable.selectLabel(row.ordinal)}
            aria-describedby={blocked ? reasonIdOf(row) : undefined}
            checked={row.isSelected}
            disabled={blocked}
            onChange={() => {
              onToggleSelect(row.line.goodsReceiptLineId);
            }}
          />
        );
      },
    },
    {
      key: 'item',
      header: t.lineTable.item,
      render: (row) => describeReference(toReference(itemLookup, row.line.itemId)),
    },
    {
      key: 'lot',
      header: t.lineTable.lot,
      width: '168px',
      /*
       * **보류 표식은 이름 옆에 글자로 붙는다**(색에만 기대지 않는다). 반품해도 보류가
       * 유지된다는 사실을 사용자가 이 자리에서 읽는다 — **막지는 않는다.** 보류된 LOT을
       * 되돌려 보내는 것이 이 화면의 주 용도이며, 그래서 `line-select.ts`도 보류를 보지 않는다.
       */
      render: (row) => (
        <>
          {describeReference(toReference(lotLookup, row.line.lotId))}
          {isLotHeld(lotLookup, row.line.lotId) && (
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
      render: (row) =>
        describeReference(toReference(locationLookup, row.line.destinationLocationId)),
    },
    {
      key: 'receiptQty',
      header: t.lineTable.receiptQty,
      align: 'end',
      width: '104px',
      render: (row) => t.lineTable.receiptQtyPair(row.line.receiptQty, uomNameOf(row)),
    },
    {
      key: 'onHandQty',
      header: t.lineTable.onHandQty,
      align: 'end',
      width: '120px',
      /*
       * **모르는 것을 아는 척하지 않는다**(승인 13-6). 못 구한 자리에 `0`이나 「—」를 내면
       * 사용자가 그것을 사실로 읽는다 — 「확인하지 못함」은 값이 아니라 **화면의 한계**를
       * 말하는 글자다. 그 줄을 막지 않는다는 사실은 표 아래 안내가 함께 밝힌다.
       */
      render: (row) => describeOnHand(row.onHand, uomNameOf(row)),
    },
    {
      key: 'returnQty',
      header: t.lineTable.returnQty,
      width: '136px',
      /*
       * **표 안의 입력칸.** 보이는 라벨을 둘 자리가 없어 `aria-label`로 준다(배치 규범 3의
       * 이탈 조건). 이름에 **표시 순번**을 넣는다 — 「반품 수량」이 줄마다 되풀이되면 어느 줄인지
       * 알 수 없다. 내부 번호를 넣지 않는 것은 그것이 화면 밖으로 새는 또 하나의 경로여서다.
       */
      render: (row) => {
        const blocked = row.select.kind === 'blocked';

        return (
          <div className="field-cell">
            <TextField
              size="sm"
              fullWidth
              inputMode="decimal"
              aria-label={t.lineTable.returnQtyLabel(row.ordinal)}
              aria-describedby={blocked ? reasonIdOf(row) : undefined}
              value={row.qtyText}
              disabled={blocked}
              error={row.error}
              onChange={(event) => {
                onChangeQty(row.line.goodsReceiptLineId, event.target.value);
              }}
            />
            {row.select.kind === 'blocked' && (
              <span id={reasonIdOf(row)} className="field-note">
                {row.select.reason}
              </span>
            )}
          </div>
        );
      },
    },
  ];
};

export interface GrLineTableProps extends Omit<GrLineColumnsInput, 'reasonIdPrefix'> {
  rows: ReturnLineRow[];
  /** 잔액 조회가 **하나라도** 실패했는가. 줄마다의 사정은 그 줄의 보유 수량 칸이 말한다. */
  hasBalanceError: boolean;
  hasBalanceTruncated: boolean;
  onRetryReferences: () => void;
  onRetryBalances: () => void;
}

/**
 * 고른 입고 전표의 라인 표 — **무엇을 얼마나 되돌려 보낼지 정하는 자리다.**
 *
 * **라인을 따로 부르지 않는다** — 상세 응답이 헤더와 함께 준다. 라인 목록에 쪽 정보가 없어
 * 전건이 오므로 이 표에는 **잘림 판정도 쪽 이동도 없다**(보유 수량 쪽 잘림은 다른 조회의 것이다).
 *
 * **불러오는 중 갈래를 두지 않는다.** 상세를 기다리는 동안에는 이 구획 자체가 그려지지
 * 않으므로(화면이 골격을 낸다) 여기에 두면 닿을 수 없는 가지가 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const GrLineTable = ({
  rows,
  itemLookup,
  uomLookup,
  lotLookup,
  locationLookup,
  hasBalanceError,
  hasBalanceTruncated,
  onToggleSelect,
  onChangeQty,
  onRetryReferences,
  onRetryBalances,
}: GrLineTableProps) => {
  const reasonIdPrefix = useId();
  const columns = buildGrLineColumns({
    itemLookup,
    uomLookup,
    lotLookup,
    locationLookup,
    reasonIdPrefix,
    onToggleSelect,
    onChangeQty,
  });

  /**
   * **판정은 한 곳에서 온다**(완료 조건 C31). 이 표가 세는 것이 아니라, 줄에 실린 「골라졌다」를
   * 그대로 세는 함수를 부른다 — 뒤따르는 회차의 「반품 처리」 버튼도 같은 함수를 본다.
   */
  const selection = describeReturnSelection(rows);

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
  const hasHeldLot = rows.some((row) => isLotHeld(lotLookup, row.line.lotId));

  /*
   * **상한을 못 구한 줄이 실제로 있을 때만** 「막지 않는다」를 말한다. 늘 세워 두면 전부
   * 확인된 화면에서도 사용자가 상한이 없는 줄 안다.
   */
  const hasUnknownOnHand = rows.some((row) => row.onHand.kind === 'unknown');

  const emptySlot = (): ReactNode => (
    <EmptyState
      size="sm"
      live
      title={t.empty.noLinesTitle}
      description={t.empty.noLinesDescription}
    />
  );

  /** 고른 줄 수와 합계. **보낼 줄에서 나온다** — 화면이 따로 세면 확인한 것과 나가는 것이 갈린다. */
  const summary = (): string => {
    if (selection.count === 0) return t.selection.none;
    if (selection.totalQty === null) return t.selection.summaryMixedUom(selection.count);

    return t.selection.summary(
      selection.count,
      selection.totalQty,
      describeReference(toReference(uomLookup, selection.totalUomId)),
    );
  };

  return (
    <>
      <p className="field-note">{t.notes.returnQtyEmptyStart}</p>

      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          /*
           * **줄에 매인 입력칸이 생겨 이 값이 관측되는 자리가 됐다.** 미지정이면 인덱스가
           * React key가 되어, 앞 줄이 사라질 때 **치고 있던 칸의 DOM 노드가 대신 지워진다** —
           * 포커스와 캐럿이 말없이 다른 줄의 칸으로 옮겨 간다.
           *
           * **여기의 `String()`은 화면에 나오지 않는다** — React key로만 쓰이며 셀 텍스트가 되지 않는다.
           */
          getRowId={(row) => String(row.line.goodsReceiptLineId)}
          empty={emptySlot()}
        />
      </div>

      {/* 무엇이 나갈지 표 바로 아래에서 읽힌다 — 확인 창에서 처음 보게 하지 않는다. */}
      <p className="field-note">{summary()}</p>

      {selection.ready.kind === 'blocked' && (
        <p className="field-note">{selection.ready.reason}</p>
      )}

      {hasHeldLot && <p className="field-note">{t.notes.lotHold}</p>}

      {hasUnknownOnHand && <p className="field-note">{t.reasons.onHandUnknownNote}</p>}

      {hasBalanceTruncated && <p className="field-note">{t.reasons.balancesTruncated}</p>}

      {hasTruncatedReference && <p className="field-note">{t.reasons.lineReferencesTruncated}</p>}

      {hasBalanceError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.balancesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryBalances}>
            {messages.common.retry}
          </Button>
        </div>
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
