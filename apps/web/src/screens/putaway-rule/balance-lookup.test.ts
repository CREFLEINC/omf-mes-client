import { describe, expect, it } from 'vitest';

import {
  findRuleBalance,
  toBalanceTargets,
  toBalanceView,
  type BalanceSource,
  type TargetBalance,
} from './balance-lookup';
import { RULE_WAREHOUSE_WIDE, RULE_WITH_LOCATION, balanceRow, ruleViewFixtures } from './fixtures';

const targetOf = (overrides: Partial<TargetBalance> = {}): TargetBalance => ({
  itemId: RULE_WITH_LOCATION.itemId,
  locationId: RULE_WITH_LOCATION.locationId,
  rows: [toBalanceView(balanceRow())],
  isLoading: false,
  isError: false,
  truncated: false,
  ...overrides,
});

const sourceOf = (targets: TargetBalance[]): BalanceSource => ({
  targets,
  isError: targets.some((target) => target.isError),
  truncated: targets.some((target) => target.truncated),
  refetch: () => undefined,
});

describe('toBalanceTargets', () => {
  /**
   * **줄마다 부르지 않는다.** 같은 (품목·위치)의 규칙이 둘이면 요청도 둘이 되는데,
   * 두 응답이 같은 사실을 말하므로 하나면 족하다(전례 `stock-adjust`의 위치당 요청 하나).
   */
  it('같은 품목·위치는 한 대상으로 접는다', () => {
    expect(
      toBalanceTargets([RULE_WITH_LOCATION, { ...RULE_WITH_LOCATION, putawayRuleId: 9005 }]),
    ).toEqual([{ itemId: 9101, locationId: 9301 }]);
  });

  /**
   * **위치를 비운 창고 전체 규칙은 다른 대상이다.** 그 창고의 그 품목 **전체**가 대상이라
   * 위치를 좁힌 조회와 답이 다르다 — 접으면 창고 전체 규칙이 한 위치의 잔액만 보게 된다.
   */
  it('위치를 비운 규칙은 위치가 있는 규칙과 다른 대상이다', () => {
    const targets = toBalanceTargets([
      { ...RULE_WITH_LOCATION, itemId: 9101, locationId: 9301 },
      { ...RULE_WAREHOUSE_WIDE, itemId: 9101, locationId: null },
    ]);

    expect(targets).toEqual([
      { itemId: 9101, locationId: null },
      { itemId: 9101, locationId: 9301 },
    ]);
  });

  /** 차례가 렌더마다 흔들리면 조회 목록이 흔들려 같은 요청이 다시 나간다. */
  it('차례가 규칙의 순서와 무관하게 정해진다', () => {
    const rules = ruleViewFixtures;

    expect(toBalanceTargets(rules)).toEqual(toBalanceTargets([...rules].reverse()));
  });

  it('규칙이 없으면 대상도 없다', () => {
    expect(toBalanceTargets([])).toEqual([]);
  });
});

describe('toBalanceView', () => {
  /**
   * **보유 수량을 쓰고 가용 수량을 쓰지 않는다.** 예약·피킹·보류된 재고도 그 자리를
   * 물리적으로 차지하고 있다 — 가용으로 재면 꽉 찬 위치가 비어 보인다.
   */
  it('보유 수량을 그대로 옮긴다', () => {
    expect(toBalanceView(balanceRow({ onHandQty: 320, availableQty: 10 }))).toMatchObject({
      onHandQty: 320,
    });
  });

  /** 계약의 세 상태(없음·`null`·값)를 화면의 두 상태로 줄인다 — 읽는 자리마다 갈리지 않게. */
  it('위치가 오지 않은 줄과 비어 온 줄을 같게 읽는다', () => {
    const absent = toBalanceView({ ...balanceRow(), locationId: undefined });
    const nulled = toBalanceView(balanceRow({ locationId: null }));

    expect(absent.locationId).toBeNull();
    expect(nulled.locationId).toBeNull();
  });
});

describe('findRuleBalance — 판정 순서', () => {
  /**
   * 대상이 아직 만들어지지도 않았다 — **「없다」가 아니라 「아직」이다.**
   * 없음으로 읽으면 조회가 서기 전 한 프레임 동안 「적재 없음」이 화면에 선다.
   */
  it('대상이 없으면 미도착이다', () => {
    expect(findRuleBalance(sourceOf([]), RULE_WITH_LOCATION)).toEqual({ kind: 'loading' });
  });

  /** **실패가 미도착보다 앞선다** — 실패한 조회를 「불러오는 중」으로 두면 영원히 기다리게 된다. */
  it('실패가 미도착보다 앞선다', () => {
    expect(
      findRuleBalance(sourceOf([targetOf({ isError: true, isLoading: true })]), RULE_WITH_LOCATION),
    ).toEqual({ kind: 'unknown', reason: 'failed' });
  });

  it('미도착은 그대로 미도착이다', () => {
    expect(
      findRuleBalance(sourceOf([targetOf({ isLoading: true, rows: [] })]), RULE_WITH_LOCATION),
    ).toEqual({ kind: 'loading' });
  });

  /** 잘린 목록으로 합을 내면 실제보다 적은 수가 사용률의 분자가 된다 — 세지 않는다. */
  it('잘린 목록은 확인하지 못한 것이다', () => {
    expect(findRuleBalance(sourceOf([targetOf({ truncated: true })]), RULE_WITH_LOCATION)).toEqual({
      kind: 'unknown',
      reason: 'truncated',
    });
  });

  /**
   * 요청은 위치 축으로 묶었는데 응답에 다른 축의 줄이 섞여 오면 **같은 재고를 두 번 센다** —
   * 축이 하나로 모이지 않으면 셈하지 않는다.
   */
  it('묶은 축이 섞여 오면 세지 않는다', () => {
    const rows = [toBalanceView(balanceRow()), toBalanceView(balanceRow({ groupBy: 'ITEM' }))];

    expect(findRuleBalance(sourceOf([targetOf({ rows })]), RULE_WITH_LOCATION)).toEqual({
      kind: 'unknown',
      reason: 'axisMixed',
    });
  });

  /** 축이 하나면 요청한 축과 달라도 셀 수 있다 — 조건은 요청이 이미 좁혔다. */
  it('축이 하나로 모이면 그 축이 무엇이든 센다', () => {
    const rows = [toBalanceView(balanceRow({ groupBy: 'ITEM' }))];

    expect(findRuleBalance(sourceOf([targetOf({ rows })]), RULE_WITH_LOCATION)).toEqual({
      kind: 'known',
      rows,
    });
  });

  it('정상이면 그 대상의 줄을 낸다', () => {
    const rows = [toBalanceView(balanceRow())];

    expect(findRuleBalance(sourceOf([targetOf({ rows })]), RULE_WITH_LOCATION)).toEqual({
      kind: 'known',
      rows,
    });
  });

  /** 줄이 0건인 것도 확정된 답이다 — 조회가 성공했고 그 조건의 잔액이 없다. */
  it('줄이 0건이어도 확정된 답이다', () => {
    expect(findRuleBalance(sourceOf([targetOf({ rows: [] })]), RULE_WITH_LOCATION)).toEqual({
      kind: 'known',
      rows: [],
    });
  });
});

describe('findRuleBalance — 대상 맞추기', () => {
  /** 위치가 다른 규칙이 남의 대상을 읽으면 다른 자리의 잔액이 이 규칙의 사용률이 된다. */
  it('위치가 다르면 그 대상을 읽지 않는다', () => {
    const source = sourceOf([targetOf({ locationId: 9302 })]);

    expect(findRuleBalance(source, RULE_WITH_LOCATION)).toEqual({ kind: 'loading' });
  });

  /**
   * **창고 전체 규칙과 위치 규칙을 섞지 않는다.** 위치를 비운 것은 값이 없는 것이 아니라
   * 「창고 전체」라는 확정된 뜻이라, 위치가 있는 대상과 같은 것으로 읽으면 안 된다.
   */
  it('위치를 비운 규칙은 위치가 있는 대상을 읽지 않는다', () => {
    const source = sourceOf([targetOf({ itemId: 9102, locationId: 9301 })]);

    expect(findRuleBalance(source, RULE_WAREHOUSE_WIDE)).toEqual({ kind: 'loading' });
  });

  it('위치를 비운 규칙은 위치를 비운 대상을 읽는다', () => {
    const rows = [toBalanceView(balanceRow({ itemId: 9102, uomId: 9402 }))];
    const source = sourceOf([targetOf({ itemId: 9102, locationId: null, rows })]);

    expect(findRuleBalance(source, RULE_WAREHOUSE_WIDE)).toEqual({ kind: 'known', rows });
  });
});
