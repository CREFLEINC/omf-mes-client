import type { components } from '@omf-mes/api-client';

import type { RuleView } from './types';

/**
 * 규칙 하나가 견줄 **현재 적재량**을 재고 잔액에서 찾는 자리.
 *
 * 용량이 숫자 하나로 떠 있으면 크고 작음을 판단할 수 없다 — 지금 얼마나 차 있는지가 옆에
 * 있어야 그 수가 뜻을 얻는다. 그 「지금」은 이 화면의 계약(기준정보)이 아니라 **자재창고
 * 계약의 재고 잔액**에서 온다.
 *
 * ## 대상을 규칙마다 두지 않고 (품목·위치)마다 둔다
 *
 * 같은 품목·위치의 규칙이 둘이면 두 응답이 같은 사실을 말한다 — 요청을 둘로 두면 화면이
 * 같은 것을 두 번 묻고, 두 응답이 어긋나는 순간 어느 쪽을 믿을지가 순서에 달린다
 * (전례 `stock-adjust`의 「위치당 요청 하나」 · `disposal-issue`의 「품목당 요청 하나」).
 *
 * ## 「없다」와 「모른다」를 끝까지 가른다
 *
 * 잔액 줄이 0건인 것은 **확인한 결과**이고, 미도착·실패·잘림은 **확인하지 못한 것**이다.
 * 둘을 뭉치면 확인하지 못한 자리에 「적재 없음」이 서고, 운영자는 그 위치가 비어 있다고 읽는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type InventoryBalance = components['schemas']['InventoryBalance'];

/**
 * 잔액 줄 하나의 화면 표현.
 *
 * **`availableQty`를 두지 않는다.** 가용 수량은 보유에서 예약·피킹·보류를 뺀 값인데, 예약된
 * 재고도 그 위치를 물리적으로 차지하고 있다 — 가용으로 재면 **꽉 찬 위치가 비어 보인다.**
 * 타입에 자리조차 두지 않아 잘못 집을 경로를 없앤다.
 */
export interface BalanceView {
  /** 이 줄이 묶인 축. 축이 섞인 응답을 더하면 같은 재고를 두 번 센다. */
  groupBy: InventoryBalance['groupBy'];
  itemId: number;
  /** 축이 위치가 아니면 비어 온다. 계약의 세 상태(없음·`null`·값)를 두 상태로 줄인다. */
  locationId: number | null;
  /** 소유 구분. **어떤 축에서도 합치지 않는다**(공유계약 L-7). */
  ownershipTypeCode: string;
  onHandQty: number;
  uomId: number;
}

export const toBalanceView = (balance: InventoryBalance): BalanceView => ({
  groupBy: balance.groupBy,
  itemId: balance.itemId,
  locationId: balance.locationId ?? null,
  ownershipTypeCode: balance.ownershipTypeCode,
  onHandQty: balance.onHandQty,
  uomId: balance.uomId,
});

/**
 * 잔액을 부를 축 하나. **위치를 비운 것은 「창고 전체」라는 확정된 값이다** —
 * 위치가 있는 대상과 같은 것으로 읽으면 창고 전체 규칙이 한 위치의 잔액만 보게 된다.
 */
export interface BalanceTarget {
  itemId: number;
  locationId: number | null;
}

/** 위치를 비운 대상이 늘 앞에 서게 한다. 차례가 흔들리면 조회 목록이 흔들려 요청이 다시 난다. */
const orderOf = (target: BalanceTarget): number => target.locationId ?? -1;

/**
 * 보이는 규칙들이 필요로 하는 잔액 대상.
 *
 * **차례를 못 박는다.** 이 배열이 그대로 조회 목록이 되므로 순서가 렌더마다 달라지면 같은
 * 조회가 자리를 옮기고, 그때마다 훅이 조회를 새로 세운다.
 */
export const toBalanceTargets = (rules: readonly RuleView[]): BalanceTarget[] => {
  const seen = new Map<string, BalanceTarget>();

  for (const rule of rules) {
    const target: BalanceTarget = { itemId: rule.itemId, locationId: rule.locationId };

    seen.set(`${String(target.itemId)}|${String(target.locationId)}`, target);
  }

  return [...seen.values()].sort(
    (left, right) => left.itemId - right.itemId || orderOf(left) - orderOf(right),
  );
};

/** 대상 하나의 조회 상태. **대상마다 갈라 든다** — 한 대상의 실패가 다른 대상을 끌고 가면 안 된다. */
export interface TargetBalance extends BalanceTarget {
  rows: readonly BalanceView[];
  isLoading: boolean;
  isError: boolean;
  /** 받은 것이 전부가 아니다. 잘린 목록으로 합을 내면 실제보다 적은 수가 분자가 된다. */
  truncated: boolean;
}

export interface BalanceSource {
  targets: readonly TargetBalance[];
  /** 하나라도 실패했는가 — 복구 손잡이가 쓴다. */
  isError: boolean;
  /** 하나라도 잘렸는가. */
  truncated: boolean;
  refetch: () => void;
}

/** 왜 적재량을 확인하지 못했는가. **갈래마다 문구가 다르다** — 사용자가 할 조치가 다르다. */
export type BalanceUnknownReason = 'failed' | 'truncated' | 'axisMixed';

/**
 * 규칙 하나의 잔액 상태. **세 갈래다** — 확인함 · 아직 오지 않음 · 확인하지 못함.
 * 확인하지 못한 것을 빈 목록으로 읽으면 화면이 「적재 없음」이라는 확정된 사실을 지어낸다.
 */
export type RuleBalance =
  | { kind: 'known'; rows: readonly BalanceView[] }
  | { kind: 'loading' }
  | { kind: 'unknown'; reason: BalanceUnknownReason };

/**
 * 규칙 하나의 잔액을 찾는다.
 *
 * 순서가 뜻을 정한다 — **실패 · 미도착 · 잘림이 「줄이 없음」보다 앞선다.** 못 받았거나 덜 받은
 * 목록으로 「그 자리에 재고가 없다」를 판정하면, 화면이 확인한 적 없는 것을 사실로 말하게 된다.
 *
 * **축이 섞인 응답은 세지 않는다.** 계약은 줄마다 묶인 축을 적어 내리는데, 위치 축의 줄과
 * 품목 축의 줄이 함께 오면 품목 축 줄이 위치 축 줄들의 합이라 **같은 재고를 두 번 센다.**
 * 축이 하나로 모이면 그 축이 무엇이든 센다 — 조건은 요청이 이미 좁혔다.
 */
export const findRuleBalance = (source: BalanceSource, rule: RuleView): RuleBalance => {
  const target = source.targets.find(
    (candidate) => candidate.itemId === rule.itemId && candidate.locationId === rule.locationId,
  );

  /* 대상이 아직 만들어지지도 않았다 — 「없다」가 아니라 「아직」이다. */
  if (target === undefined) return { kind: 'loading' };
  if (target.isError) return { kind: 'unknown', reason: 'failed' };
  if (target.isLoading) return { kind: 'loading' };
  if (target.truncated) return { kind: 'unknown', reason: 'truncated' };

  const axes = new Set(target.rows.map((row) => row.groupBy));

  if (axes.size > 1) return { kind: 'unknown', reason: 'axisMixed' };

  return { kind: 'known', rows: target.rows };
};
