import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { QtyRead } from './validation';

/**
 * 장부 수량 — **출처가 갈래마다 다르다**(D-6).
 *
 * | 갈래 | 장부 | 조회 |
 * | --- | --- | --- |
 * | 실사 차이에서 | 실사 라인이 이미 들고 온 값 | **추가 요청이 없다** |
 * | 직접 등록 | 재고 잔액 | 위치를 고른 시점에 **위치당 1회** |
 *
 * **라인마다 요청하지 않는다.** 위치 단위로 한 번 받아 (품목·LOT)로 국소 대조한다 —
 * 줄마다 부르면 세 줄짜리 조정에 요청이 셋 나가고, 같은 위치의 줄이 늘수록 그대로 는다.
 *
 * **위치는 요청 조건이 정한다.** 계약이 「`groupBy`로 접은 축은 비워서 내린다」고 적었으므로
 * 응답의 `locationId`를 대조에 쓰면 접힌 응답에서 한 줄도 맞지 않는다 — 그래서 이 파일의
 * 대조 축은 (품목 · LOT) 둘뿐이고, 위치는 **어느 요청의 응답인가**로 이미 갈려 있다.
 *
 * **못 찾으면 0으로 메우지 않는다.** 0은 「장부에 없다」가 아니라 「장부에 0이 있다」는 뜻이라,
 * 메우면 차이 계산이 거짓이 되고 사용자가 확인하지 않은 실물이 화면에 선다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type InventoryBalanceResponse = components['schemas']['InventoryBalance'];

const t = messages.stockAdjust;

/**
 * 한 위치의 잔액 한 줄 — **화면이 대조에 쓰는 것만 담는다.**
 *
 * 위치를 담지 않는 것이 요점이다(위 주석). 담아 두면 접힌 응답의 `null`을 대조하려다
 * 「장부를 못 찾았다」가 늘 참이 된다.
 */
export interface BalanceRow {
  itemId: number;
  lotId: number | null;
  onHandQty: number;
}

export const toBalanceRow = (data: InventoryBalanceResponse): BalanceRow => ({
  itemId: data.itemId,
  lotId: data.lotId ?? null,
  onHandQty: data.onHandQty,
});

/**
 * 장부를 풀 때 필요한 것 전부. **넷을 함께 들고 있어야 다섯 갈래를 가를 수 있다** —
 * 묻지 않음 · 아직 오지 않음 · 실패 · 목록에 없음 · 정상.
 */
export interface BalanceSource {
  rows: readonly BalanceRow[];
  /** 이 위치를 실제로 물었는가. 위치를 고르기 전에는 거짓이다 */
  isAsked: boolean;
  isLoading: boolean;
  isError: boolean;
}

/**
 * 장부 수량 하나의 상태.
 *
 * **다섯 갈래를 타입으로 가른다.** 하나로 뭉개면 응답이 오기 전의 줄이 「장부에 없음」으로
 * 보이고, 그 표기는 *그 재고가 없다*는 뜻이라 사용자가 반대로 읽는다.
 */
export type BookQtyState =
  | { kind: 'known'; qty: number }
  | { kind: 'notAsked' }
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notFound' };

/**
 * 잔액에서 이 줄의 장부를 찾는다.
 *
 * 순서가 뜻을 정한다 — **묻지 않음 · 실패 · 미도착이 「목록에 없음」보다 앞선다.** 아직 묻지
 * 않았거나 못 받은 것을 「장부에 그런 줄이 없다」로 판정하면 정상 재고에 없다는 표를 붙이는 셈이다.
 *
 * **LOT까지 함께 맞춘다.** 품목만 맞추면 다른 LOT의 잔액이 이 줄의 장부로 서고, 그 값으로
 * 계산한 실물이 사용자가 확인하지 않은 수가 된다.
 */
export const toBookQty = (
  source: BalanceSource,
  itemId: number | null,
  lotId: number | null,
): BookQtyState => {
  if (!source.isAsked) return { kind: 'notAsked' };
  if (source.isError) return { kind: 'failed' };
  if (source.isLoading) return { kind: 'loading' };
  if (itemId === null) return { kind: 'notAsked' };

  const row = source.rows.find(
    (candidate) => candidate.itemId === itemId && candidate.lotId === lotId,
  );

  return row === undefined ? { kind: 'notFound' } : { kind: 'known', qty: row.onHandQty };
};

/**
 * 수량 하나의 표기. **단위를 수량에 붙인다** — 단위 열을 따로 두면 폭이 100px 넘게 들고,
 * 정작 필요한 순간(수량을 읽을 때)에는 눈이 표를 가로질러야 한다.
 *
 * 단위를 아직 고르지 않은 줄에서는 수만 낸다 — 「알 수 없음」을 단위 자리에 붙이면
 * 수량이 잘못된 것처럼 읽힌다.
 *
 * **이 슬라이스의 수량 표기가 전부 이 한 자리를 지난다** — 조정 대상 표의 장부·실물과
 * 처리 이력 상세의 차이가 같은 규칙으로 보여야 두 탭을 오가는 사용자가 같은 값을 두 모양으로
 * 만나지 않는다.
 */
export const describeQty = (qty: number, uomName: string): string =>
  t.lineTable.qtyWithUom(String(qty), uomName).trim();

/**
 * 장부 상태를 표의 글자로 옮긴다. **수를 지어내지 않는다.**
 *
 * 「묻지 않음」과 「목록에 없음」은 둘 다 빈 값 표식(`—`)으로 낸다 — 표 안에서는 자리를 아끼고,
 * 무엇이 일어났는지는 표 아래 안내가 맡는다. 조회 중과 실패는 사용자가 기다릴지 다시 부를지를
 * 가리는 값이라 글자로 갈라 둔다.
 */
export const describeBookQty = (state: BookQtyState, uomName: string): string => {
  switch (state.kind) {
    case 'known':
      return describeQty(state.qty, uomName);
    case 'loading':
      return t.bookQty.loading;
    case 'failed':
      return t.bookQty.failed;
    case 'notAsked':
    case 'notFound':
      return t.values.empty;
  }
};

/**
 * 실물 수량 — **파생이다**(D-5 · 조심 ③).
 *
 * 입력칸으로 두면 그것이 곧 결과 수량 입력이 되어 이 화면이 덮어쓰기 화면으로 읽힌다.
 * 그래서 이 타입에는 **고칠 수 있는 상태가 없다** — 알거나 모르거나 둘뿐이다.
 */
export type ActualQtyState = { kind: 'known'; qty: number } | { kind: 'unknown' };

/**
 * 장부에 차이를 더해 실물을 낸다.
 *
 * **장부를 모르면 실물도 모른다.** 장부를 0으로 삼아 계산하면 「차이만큼이 곧 실물」이 되어,
 * 확인한 적 없는 수가 확인된 값처럼 선다. 차이를 아직 치지 않았거나 수로 읽히지 않을 때도 같다.
 */
export const deriveActualQty = (book: BookQtyState, diff: QtyRead): ActualQtyState =>
  book.kind === 'known' && diff.kind === 'qty'
    ? { kind: 'known', qty: book.qty + diff.value }
    : { kind: 'unknown' };

/**
 * 실물 상태를 표의 글자로 옮긴다.
 *
 * **모르는 것은 빈 값 표식으로 낸다.** 「0」으로 내면 사용자가 확인하지 않은 수를 확인된 값으로
 * 읽고, 그대로 조정을 올린다.
 */
export const describeActualQty = (state: ActualQtyState, uomName: string): string =>
  state.kind === 'known' ? describeQty(state.qty, uomName) : t.values.empty;
