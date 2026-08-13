import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { checkQtyLimit, describeOnHand, toOnHand, type BalanceSource } from './on-hand';
import { toBalanceView, type BalanceResponse, type BalanceView, type ReceiptLineView } from './types';

const t = messages.disposalIssue;

const ITEM = 9301;
const LOT = 9601;
const OTHER_LOT = 9602;
const UOM = 9801;
const OTHER_UOM = 9802;

const line = (overrides: Partial<ReceiptLineView> = {}): ReceiptLineView => ({
  goodsReceiptLineId: 9401,
  itemId: ITEM,
  lotId: LOT,
  receiptQty: 100,
  uomId: UOM,
  destinationLocationId: 9901,
  ...overrides,
});

const balance = (overrides: Partial<BalanceView> = {}): BalanceView => ({
  groupBy: 'LOT',
  lotId: LOT,
  onHandQty: 40,
  uomId: UOM,
  ...overrides,
});

const source = (overrides: Partial<BalanceSource['items'][number]> = {}): BalanceSource => {
  const item = {
    itemId: ITEM,
    entries: [balance()] as readonly BalanceView[],
    isLoading: false,
    isError: false,
    truncated: false,
    ...overrides,
  };

  return {
    items: [item],
    isError: item.isError,
    truncated: item.truncated,
  };
};

describe('toOnHand — 세 갈래', () => {
  it('그 LOT의 잔액을 찾으면 확인함이다', () => {
    expect(toOnHand(source(), line())).toEqual({ kind: 'known', qty: 40, uomId: UOM });
  });

  /** 같은 LOT의 줄이 여럿이면 **합친다** — 위치 축이 접혀 한 LOT이 여러 줄로 올 수 있다. */
  it('같은 LOT의 줄이 여럿이면 합친다', () => {
    const withTwo = source({
      entries: [balance({ onHandQty: 40 }), balance({ onHandQty: 2.5 })],
    });

    expect(toOnHand(withTwo, line())).toEqual({ kind: 'known', qty: 42.5, uomId: UOM });
  });

  /** 그 품목의 조회가 아직 만들어지지도 않았다 — 「없다」가 아니라 「아직」이다. */
  it('그 품목의 조회가 없으면 불러오는 중이다', () => {
    expect(toOnHand({ items: [], isError: false, truncated: false }, line())).toEqual({
      kind: 'loading',
    });
  });

  it('그 품목의 조회가 진행 중이면 불러오는 중이다', () => {
    expect(toOnHand(source({ isLoading: true, entries: [] }), line())).toEqual({ kind: 'loading' });
  });

  /**
   * **순서가 뜻을 정한다 — 실패·미도착·잘림이 「목록에 없음」보다 앞선다.** 못 받았거나 덜
   * 받은 목록으로 「그 LOT이 없다」를 판정하면 정상 잔액이 있는 줄에 잘못된 판정이 붙는다.
   */
  it('실패는 미확인이고, 그 사유가 목록에 없음보다 앞선다', () => {
    expect(toOnHand(source({ isError: true, entries: [] }), line())).toEqual({
      kind: 'unknown',
      reason: 'failed',
    });
  });

  it('잘린 목록은 미확인이다 — 합계가 실제보다 적을 수 있다', () => {
    expect(toOnHand(source({ truncated: true }), line())).toEqual({
      kind: 'unknown',
      reason: 'truncated',
    });
  });

  it('그 LOT의 줄이 없으면 미확인이다', () => {
    expect(toOnHand(source({ entries: [balance({ lotId: OTHER_LOT })] }), line())).toEqual({
      kind: 'unknown',
      reason: 'notFound',
    });
  });

  /**
   * **단위가 다르면 견주지 않는다.** 화면에는 단위를 옮기는 수단이 없으므로, 다른 단위의
   * 수량을 상한으로 쓰면 100과 5를 비교하는 셈이 된다.
   */
  it('단위가 다르면 미확인이다', () => {
    expect(toOnHand(source({ entries: [balance({ uomId: OTHER_UOM })] }), line())).toEqual({
      kind: 'unknown',
      reason: 'uomMismatch',
    });
  });

  /**
   * **잔액이 0인 LOT은 확인한 0이다**(`includeZero=true`가 그것을 데려온다). 「0이라 없다」와
   * 「잘려서 없다」를 가르지 못하면 화면은 0인 줄을 **확인하지 못한 줄**로 읽어 막지 않는다 —
   * 없는 자재를 폐기하게 된다.
   */
  it('보유가 0인 LOT은 미확인이 아니라 0으로 확인한 것이다', () => {
    expect(toOnHand(source({ entries: [balance({ onHandQty: 0 })] }), line())).toEqual({
      kind: 'known',
      qty: 0,
      uomId: UOM,
    });
  });

  /**
   * **축이 LOT이 아닌 줄은 상한이 되지 않는다**(목 실측 — 응답의 `groupBy`가 요청과 다를 수
   * 있다). 축이 `ITEM`인 줄은 **그 품목의 전 LOT을 합친 값**이라 한 LOT의 상한으로 쓰면
   * 상한이 실제보다 몇 배 느슨해진다.
   */
  it('축이 LOT이 아닌 줄은 상한으로 쓰지 않는다', () => {
    const itemAxis = source({
      entries: [{ groupBy: 'ITEM', lotId: LOT, onHandQty: 9999, uomId: UOM }],
    });

    expect(toOnHand(itemAxis, line())).toEqual({ kind: 'unknown', reason: 'notFound' });
  });

  /** 같은 품목이 여럿 실려 있어도 **그 품목의 것만** 본다. */
  it('다른 품목의 잔액을 섞지 않는다', () => {
    const twoItems: BalanceSource = {
      items: [
        { itemId: 9302, entries: [balance({ onHandQty: 999 })], isLoading: false, isError: false, truncated: false },
        { itemId: ITEM, entries: [balance({ onHandQty: 40 })], isLoading: false, isError: false, truncated: false },
      ],
      isError: false,
      truncated: false,
    };

    expect(toOnHand(twoItems, line())).toEqual({ kind: 'known', qty: 40, uomId: UOM });
  });
});

/**
 * **가용 수량을 상한으로 쓰지 않는다**(계획 결정 4 · 완료 조건 C23 · 감지기 M22).
 *
 * `availableQty`는 보유에서 예약·피킹·**보류**를 뺀 값인데, 폐기 대상은 바로 그 보류·차단된
 * 재고일 가능성이 크다 — 상한으로 쓰면 **폐기해야 할 것을 화면이 막는다.**
 *
 * 두 값이 **다른** 응답으로 잰다. 같은 값이면 어느 쪽을 쓰든 통과해 감지기가 없는 것과 같다.
 */
describe('상한은 보유 수량이다', () => {
  const response: BalanceResponse = {
    groupBy: 'LOT',
    itemId: ITEM,
    lotId: LOT,
    warehouseId: 9701,
    ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
    onHandQty: 100,
    reservedQty: 20,
    pickedQty: 5,
    blockedQty: 30,
    availableQty: 45,
    uomId: UOM,
  } as BalanceResponse;

  it('보유 100·가용 45인 응답에서 상한이 100이다', () => {
    const withResponse = source({ entries: [toBalanceView(response)] });

    expect(toOnHand(withResponse, line())).toEqual({ kind: 'known', qty: 100, uomId: UOM });
  });

  it('가용 수량인 45는 상한을 넘지 않은 것으로 판정된다', () => {
    const onHand = toOnHand(source({ entries: [toBalanceView(response)] }), line());

    expect(checkQtyLimit(46, onHand)).toEqual({ kind: 'within' });
    expect(checkQtyLimit(100, onHand)).toEqual({ kind: 'within' });
  });
});

describe('checkQtyLimit', () => {
  const known = toOnHand(source(), line());

  it('상한 정확히는 통과한다', () => {
    expect(checkQtyLimit(40, known)).toEqual({ kind: 'within' });
  });

  it('상한을 아주 조금만 넘어도 막는다', () => {
    expect(checkQtyLimit(40.001, known)).toEqual({
      kind: 'over',
      message: t.errors.qtyOverOnHand(40),
    });
  });

  /**
   * **확인하지 못한 줄은 막지 않는다**(계획 결정 4). 상한은 보조 정보이고 최종 판정은 서버가
   * 한다 — 잔액 조회가 실패했다고 폐기 업무 전체를 세우면 정당한 폐기가 영영 불가능해진다.
   *
   * **「막지 않는다」와 「재지 못했다」를 가른다** — 둘을 뭉치면 상한을 못 구한 줄이
   * 「통과했다」로 읽혀, 화면이 확인한 적 없는 것을 확인한 척하게 된다.
   */
  it.each([
    ['불러오는 중', { kind: 'loading' as const }],
    ['미확인', { kind: 'unknown' as const, reason: 'failed' as const }],
  ])('%s인 줄은 재지 못한 것으로 낸다', (_name, onHand) => {
    expect(checkQtyLimit(9999, onHand)).toEqual({ kind: 'unmeasured' });
  });

  /** 보유가 0으로 **확인된** 줄은 무엇을 쳐도 막힌다 — 재지 못한 것과 갈리는 자리다. */
  it('보유가 0으로 확인된 줄은 막는다', () => {
    const zero = toOnHand(source({ entries: [balance({ onHandQty: 0 })] }), line());

    expect(checkQtyLimit(1, zero)).toEqual({ kind: 'over', message: t.errors.qtyOverOnHand(0) });
  });
});

describe('describeOnHand', () => {
  /** 세 갈래의 문구가 서로 달라야 뜻이 구분된다. **못 구한 자리에 `0`이나 「—」를 내지 않는다.** */
  it('세 갈래가 서로 다른 글자를 낸다', () => {
    expect(describeOnHand({ kind: 'known', qty: 40, uomId: UOM }, 'SAMPLE-UOM-EA')).toBe(
      t.lineTable.onHandQtyPair(40, 'SAMPLE-UOM-EA'),
    );
    expect(describeOnHand({ kind: 'loading' }, 'SAMPLE-UOM-EA')).toBe(t.values.onHandLoading);
    expect(describeOnHand({ kind: 'unknown', reason: 'notFound' }, 'SAMPLE-UOM-EA')).toBe(
      t.values.onHandUnknown,
    );
  });

  /**
   * 네 미확인 사유가 **한 문구**로 나온다 — 사용자가 할 조치가 같기 때문이다(그대로 보내면
   * 서버가 판정한다). 갈래를 타입에 남기는 것은 표 아래 안내가 **왜 그런지**를 가르기 위해서다.
   */
  it.each(['failed', 'truncated', 'notFound', 'uomMismatch'] as const)(
    '미확인 사유 %s는 같은 글자를 낸다',
    (reason) => {
      expect(describeOnHand({ kind: 'unknown', reason }, 'SAMPLE-UOM-EA')).toBe(
        t.values.onHandUnknown,
      );
    },
  );

  /** 「확인하지 못함」은 이름 참조의 「알 수 없음」과 **다른 글자**여야 한다 — 뜻이 다르다. */
  it('이름 참조의 「알 수 없음」을 돌려쓰지 않는다', () => {
    expect(t.values.onHandUnknown).not.toBe(t.values.unknown);
  });
});
