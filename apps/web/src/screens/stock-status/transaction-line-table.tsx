import { Button, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { TransactionLineView } from './types';

const t = messages.stockStatus;

/**
 * 열 폭 예산. **모든 열이 폭을 지정한다** — 디자인 시스템 `Table`은 `table-layout: fixed`라
 * 폭을 지정하지 않은 열이 남는 폭의 잔여분을 받아 선언과 실렌더가 어긋난다(브라우저 확인 F-B2).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 품목 | **200px** | 이 표의 축 열이다. 「코드 · 이름」이 한 줄에 들어가야 훑을 수 있다 |
 * | LOT | 144px | 잔액 표와 같다 — `LOT-2026-000045` 15자 + 셀 여백 |
 * | 수량 | 96px | 여섯 자리 수 + 우측 정렬 여백 |
 * | 단위 | 96px | 단위 코드만 낸다 |
 * | 출발·도착 창고·위치 | 각 **200px** | 넷 다 「코드 · 이름」이라 축 열과 같은 폭이 든다 |
 *
 * 합은 **1,336px**이다. `.wide-table` 하한(928px)을 넘으므로 각 열이 선언한 폭 그대로
 * 렌더되고, 모자란 폭은 디자인 시스템의 `overflow-x` 상자가 가로 스크롤로 처리한다.
 * 이동 전후를 한 줄에서 견주는 것이 이 표의 목적이라 넷을 줄여 짓누를 수 없다.
 */
const WIDTH = {
  item: '200px',
  lot: '144px',
  qty: '96px',
  uom: '96px',
  place: '200px',
} as const;

export interface TransactionLineTableProps {
  lines: TransactionLineView[];
  /**
   * 조건 줄에서 고른 창고. **위치 이름을 풀 수 있는 범위**다 —
   * 계약이 위치 목록을 창고별로만 내려 주므로 다른 창고의 위치는 이 화면이 이름을 모른다.
   */
  scopeWarehouseId: number;
  itemLookup: ReferenceSource;
  lotLookup: ReferenceSource;
  warehouseLookup: ReferenceSource;
  locationLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  /** 이 표가 이름을 내는 참조 다섯의 복구. 위 구획의 참조는 그쪽이 소유한다. */
  onRetryReferences: () => void;
}

/**
 * 거래 라인 표의 열 구성. **부품 밖으로 내보내 열 폭과 열 구성을 값으로 검사한다.**
 *
 * `scopeWarehouseId`를 받는 이유가 이 표의 요점 하나다 — 아래 `placeColumns` 주석을 보라.
 */
export const buildLineColumns = ({
  scopeWarehouseId,
  itemLookup,
  lotLookup,
  warehouseLookup,
  locationLookup,
  uomLookup,
}: Omit<
  TransactionLineTableProps,
  'lines' | 'onRetryReferences'
>): Column<TransactionLineView>[] => {
  /**
   * 위치 이름. **풀 수 없는 이유를 갈라 적는다.**
   *
   * 이 화면의 위치 목록은 조건 줄에서 고른 **한 창고**의 것뿐이다(계약이 `warehouseId`를
   * 필수로 요구한다). 그런데 수불 이력은 **고른 LOT**의 것이라 다른 창고를 오간 라인이 온다 —
   * 그 라인의 위치를 `toReference`에 그냥 넘기면 「알 수 없음」이 되고, 그 낱말은 이 저장소에서
   * *값이 잘못됐다*는 뜻이라 정반대로 읽힌다(#47).
   *
   * 그래서 **창고로 먼저 가른다**: 다른 창고의 위치면 그 사실을 적고, 같은 창고인데 목록에
   * 없을 때만 「알 수 없음」이다. `null`이 뜻을 갖는 자리를 갈라내는 것(계획 결정 10)과
   * 같은 갈래의 규칙이다.
   */
  const placeName = (locationId: number | null, warehouseId: number | null): ReactNode => {
    if (locationId === null) return t.values.empty;

    /* 창고를 모르면 범위를 판정할 수 없다 — 지어내지 않고 목록에 물어본다. */
    if (warehouseId !== null && warehouseId !== scopeWarehouseId) {
      return t.history.lines.otherWarehouseLocation;
    }

    return describeReference(toReference(locationLookup, locationId));
  };

  const warehouseName = (warehouseId: number | null): ReactNode =>
    warehouseId === null
      ? t.values.empty
      : describeReference(toReference(warehouseLookup, warehouseId));

  return [
    {
      key: 'item',
      header: t.history.lines.item,
      width: WIDTH.item,
      render: (line) => describeReference(toReference(itemLookup, line.itemId)),
    },
    {
      key: 'lot',
      header: t.history.lines.lot,
      width: WIDTH.lot,
      /*
       * **`null`이 확정된 뜻을 갖는 자리다**(계획 결정 10) — LOT을 관리하지 않는 품목의
       * 라인은 비는 것이 정상이라 「(LOT 무관)」으로 적는다. 잔액 표와 같은 표기다.
       */
      render: (line) =>
        line.lotId === null
          ? t.values.noLot
          : describeReference(toReference(lotLookup, line.lotId)),
    },
    {
      key: 'qty',
      header: t.history.lines.qty,
      width: WIDTH.qty,
      /* 수량은 우측 정렬한다 — 자릿수가 맞아야 크기를 눈으로 견줄 수 있다. */
      align: 'end',
      /* 서버가 준 값을 그대로 그린다. 부호를 바꾸거나 절댓값을 취하지 않는다. */
      render: (line) => line.qty,
    },
    {
      key: 'uom',
      header: t.history.lines.uom,
      width: WIDTH.uom,
      render: (line) => describeReference(toReference(uomLookup, line.uomId)),
    },
    /*
     * **이동 전후를 한 줄에서 견준다.** 입고 라인에는 출발지가, 출고 라인에는 도착지가
     * 없는 것이 정상이라 대시로 둔다 — 어느 쪽이 비었는지가 곧 거래의 방향이다.
     */
    {
      key: 'fromWarehouse',
      header: t.history.lines.fromWarehouse,
      width: WIDTH.place,
      render: (line) => warehouseName(line.fromWarehouseId),
    },
    {
      key: 'fromLocation',
      header: t.history.lines.fromLocation,
      width: WIDTH.place,
      render: (line) => placeName(line.fromLocationId, line.fromWarehouseId),
    },
    {
      key: 'toWarehouse',
      header: t.history.lines.toWarehouse,
      width: WIDTH.place,
      render: (line) => warehouseName(line.toWarehouseId),
    },
    {
      key: 'toLocation',
      header: t.history.lines.toLocation,
      width: WIDTH.place,
      render: (line) => placeName(line.toLocationId, line.toWarehouseId),
    },
  ];
};

/**
 * 고른 거래의 라인 — **수량이 여기서만 나온다.**
 *
 * 계약의 수불 이력 목록은 헤더라 수량·품목·창고를 담지 않는다. 목록에 수량 열을 만들면
 * 어딘가에서 더해 지어내야 하고, 라인마다 단위가 달라 그 합은 틀린 값이다
 * (잔액 목록에 요약 카드를 만들지 않는 것과 같은 근거 — 계획 결정 7).
 *
 * **조회만 한다.** 계약이 이 원장에 쓰기를 제공하지 않는다 — 취소도 행을 지우지 않고
 * 역처리 행을 더하며, 그것은 전표 화면의 일이다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const TransactionLineTable = ({
  lines,
  onRetryReferences,
  ...deps
}: TransactionLineTableProps) => {
  /* 이 표가 이름을 내는 참조 다섯 중 **하나라도** 실패하면 안내와 복구 수단을 낸다. */
  const hasReferenceError =
    deps.itemLookup.isError ||
    deps.lotLookup.isError ||
    deps.warehouseLookup.isError ||
    deps.locationLookup.isError ||
    deps.uomLookup.isError;

  return (
    <>
      <div className="wide-table">
        <Table
          density="compact"
          caption={t.history.lines.title}
          columns={buildLineColumns(deps)}
          rows={lines}
          /* **이 문자열은 화면에 나오지 않는다** — React key로만 쓰인다(#44). */
          getRowId={(line) => String(line.inventoryTransactionLineId)}
          /*
           * **빈 상태를 만드는 자리는 하나다** — 표를 늘 그리고 `empty` 슬롯이 0건을 맡는다.
           * 바깥에서 `length === 0`을 먼저 가르면 그 슬롯이 도달 불가한 죽은 가지가 된다.
           */
          empty={<EmptyState size="sm" title={t.history.lines.emptyTitle} />}
        />
      </div>

      {/*
       * **위치 이름을 풀 수 있는 범위를 밝힌다.** 밝히지 않으면 「(다른 창고의 위치)」가
       * 자료 누락으로 읽힌다 — 이 화면이 그 창고의 위치 목록을 받지 않았을 뿐이다.
       */}
      <p className="field-note">{t.history.lines.scopeNote}</p>

      {hasReferenceError && (
        <div className="field-cell">
          <span className="field-note">{t.history.lines.referencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
