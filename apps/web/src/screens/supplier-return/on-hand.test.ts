import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { goodsReceiptLine } from './fixtures';
import {
  checkQtyLimit,
  describeOnHand,
  toOnHand,
  type BalanceSource,
  type ItemBalance,
} from './on-hand';
import type { BalanceView } from './types';

const t = messages.supplierReturn;

const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';

const itemBalance = (overrides: Partial<ItemBalance> = {}): ItemBalance => ({
  itemId: 9301,
  entries: [],
  isLoading: false,
  isError: false,
  truncated: false,
  ...overrides,
});

const balanceSource = (items: ItemBalance[]): BalanceSource => ({
  items,
  isError: items.some((item) => item.isError),
  truncated: items.some((item) => item.truncated),
});

const entry = (overrides: Partial<BalanceView> = {}): BalanceView => ({
  lotId: 9601,
  onHandQty: 80,
  uomId: 9501,
  ...overrides,
});

/** 이 파일이 재는 라인은 늘 품목 9301 · LOT 9601 · 단위 9501이다. */
const line = goodsReceiptLine();

describe('toOnHand — 창고+LOT 합계를 상한으로 만든다', () => {
  it('그 LOT의 줄 하나를 찾으면 그 수량이 상한이다', () => {
    expect(toOnHand(balanceSource([itemBalance({ entries: [entry()] })]), line)).toEqual({
      kind: 'known',
      qty: 80,
      uomId: 9501,
    });
  });

  /**
   * **같은 LOT이 여러 줄로 온다.** 계약이 「소유 구분은 어떤 축에서도 합치지 않는다」고 적어
   * 한 LOT이 소유·품질·재고 상태별로 갈려 내려온다 — 더하지 않으면 상한이 실제보다 좁아
   * **정당한 반품이 막힌다.**
   */
  it('같은 LOT의 여러 줄을 더한다', () => {
    const source = balanceSource([
      itemBalance({ entries: [entry({ onHandQty: 80 }), entry({ onHandQty: 40 })] }),
    ]);

    expect(toOnHand(source, line)).toEqual({ kind: 'known', qty: 120, uomId: 9501 });
  });

  it('다른 LOT의 줄은 더하지 않는다', () => {
    const source = balanceSource([
      itemBalance({ entries: [entry({ onHandQty: 80 }), entry({ lotId: 9602, onHandQty: 40 })] }),
    ]);

    expect(toOnHand(source, line)).toEqual({ kind: 'known', qty: 80, uomId: 9501 });
  });

  /**
   * **`includeZero=true`가 만드는 갈래다**(감지기 M26). 0인 줄이 실제로 오면 「0이라 없다」와
   * 「잘려서 없다」가 갈린다 — 끄면 둘이 뭉개져 0인 LOT이 「확인하지 못함」이 되고,
   * 화면이 막지 않으므로 **없는 자재를 반품할 수 있게 된다.**
   */
  it('보유가 0인 줄도 확인한 값으로 읽는다', () => {
    const source = balanceSource([itemBalance({ entries: [entry({ onHandQty: 0 })] })]);

    expect(toOnHand(source, line)).toEqual({ kind: 'known', qty: 0, uomId: 9501 });
  });

  /** 계약이 「음수 허용 품목에서는 음수가 올 수 있다」고 적었다 — 0으로 삼키지 않는다. */
  it('보유가 음수여도 그대로 읽는다', () => {
    const source = balanceSource([itemBalance({ entries: [entry({ onHandQty: -5 })] })]);

    expect(toOnHand(source, line)).toEqual({ kind: 'known', qty: -5, uomId: 9501 });
  });

  /**
   * **M23** — 못 구한 것을 `0`이나 `Infinity`로 읽으면 정당한 반품을 막거나 무제한이 된다.
   * 「확인하지 못함」은 셋째 갈래다.
   */
  it('그 LOT의 줄이 없으면 확인하지 못함으로 낸다', () => {
    const source = balanceSource([itemBalance({ entries: [entry({ lotId: 9602 })] })]);

    expect(toOnHand(source, line)).toEqual({ kind: 'unknown', reason: 'notFound' });
  });

  it('그 품목의 잔액이 한 줄도 없으면 확인하지 못함으로 낸다', () => {
    expect(toOnHand(balanceSource([itemBalance()]), line)).toEqual({
      kind: 'unknown',
      reason: 'notFound',
    });
  });

  /**
   * **잘린 목록으로 합계를 내지 않는다.** 못 받은 줄이 같은 LOT의 것일 수 있어 합계가 실제보다
   * 적다 — 그 값을 상한으로 쓰면 **화면이 정당한 반품을 막는다.** 찾았더라도 미확인이다.
   */
  it('목록이 잘렸으면 그 LOT을 찾았어도 확인하지 못함으로 낸다', () => {
    const source = balanceSource([itemBalance({ entries: [entry()], truncated: true })]);

    expect(toOnHand(source, line)).toEqual({ kind: 'unknown', reason: 'truncated' });
  });

  /**
   * **잘림이 「목록에 없음」보다 앞선다.** 잘린 목록에서 못 찾은 것을 「그 LOT이 없다」로
   * 판정하면 **못 받은 것을 없는 것으로 뭉개는** 것이다(#47) — 받은 쪽에 그 LOT이 없는 것은
   * 잘린 뒤쪽에 있다는 뜻일 수 있다. 앞 잣대는 「찾은」 갈래라 이 순서를 지나가지 않는다.
   */
  it('잘렸고 받은 목록에 그 LOT이 없어도 잘림으로 낸다', () => {
    const source = balanceSource([
      itemBalance({ entries: [entry({ lotId: 9602 })], truncated: true }),
    ]);

    expect(toOnHand(source, line)).toEqual({ kind: 'unknown', reason: 'truncated' });
  });

  /**
   * **실패를 「목록에 없음」으로 말하지 않는다**(#47의 갈래). 못 받은 것과 0인 것은 사용자가
   * 할 판단이 다르다 — 실패는 다시 시도로 풀리고 0은 풀리지 않는다.
   */
  it('조회에 실패했으면 그 사유로 낸다', () => {
    const source = balanceSource([itemBalance({ isError: true })]);

    expect(toOnHand(source, line)).toEqual({ kind: 'unknown', reason: 'failed' });
  });

  it('아직 오지 않았으면 불러오는 중으로 낸다', () => {
    const source = balanceSource([itemBalance({ isLoading: true })]);

    expect(toOnHand(source, line)).toEqual({ kind: 'loading' });
  });

  /** 그 품목의 조회가 아직 만들어지지도 않았다 — 「없다」가 아니라 「아직」이다. */
  it('그 품목의 조회 자체가 없으면 불러오는 중으로 낸다', () => {
    expect(toOnHand(balanceSource([]), line)).toEqual({ kind: 'loading' });
  });

  /** 실패·미도착이 「목록에 없음」보다 앞선다 — 빈 목록을 근거로 없다고 판정하지 않는다. */
  it('실패가 목록에 없음보다 앞선다', () => {
    const source = balanceSource([itemBalance({ isError: true, entries: [] })]);

    expect(toOnHand(source, line)).toEqual({ kind: 'unknown', reason: 'failed' });
  });

  /**
   * **단위가 다르면 견주지 않는다.** 100 개와 5 상자를 비교하는 셈이고, 화면에는 단위를
   * 옮기는 수단이 없다 — 모르는 것을 아는 척하지 않는다.
   */
  it('단위가 라인과 다르면 확인하지 못함으로 낸다', () => {
    const source = balanceSource([itemBalance({ entries: [entry({ uomId: 9599 })] })]);

    expect(toOnHand(source, line)).toEqual({ kind: 'unknown', reason: 'uomMismatch' });
  });

  it('여러 줄 중 하나만 단위가 달라도 확인하지 못함으로 낸다', () => {
    const source = balanceSource([
      itemBalance({ entries: [entry(), entry({ uomId: 9599, onHandQty: 40 })] }),
    ]);

    expect(toOnHand(source, line)).toEqual({ kind: 'unknown', reason: 'uomMismatch' });
  });

  /** 품목이 여럿이면 그 라인의 품목 것만 본다 — 섞으면 다른 품목의 잔액이 상한이 된다. */
  it('다른 품목의 잔액을 쓰지 않는다', () => {
    const source = balanceSource([
      itemBalance({ itemId: 9302, entries: [entry({ onHandQty: 999 })] }),
      itemBalance({ itemId: 9301, entries: [entry({ onHandQty: 80 })] }),
    ]);

    expect(toOnHand(source, line)).toEqual({ kind: 'known', qty: 80, uomId: 9501 });
  });

  /** 한 품목이 실패해도 다른 품목의 상한은 그대로 확인된다 — 실패가 번지지 않는다. */
  it('다른 품목의 실패가 이 줄의 상한을 지우지 않는다', () => {
    const source = balanceSource([
      itemBalance({ itemId: 9302, isError: true }),
      itemBalance({ itemId: 9301, entries: [entry()] }),
    ]);

    expect(toOnHand(source, line)).toEqual({ kind: 'known', qty: 80, uomId: 9501 });
  });
});

describe('checkQtyLimit — 확인한 줄에서만 막는다', () => {
  /** **M24** — 상한 비교를 없애면 보유보다 많은 수량이 그대로 나간다. */
  it('상한을 넘으면 사유와 함께 막는다', () => {
    expect(checkQtyLimit(81, { kind: 'known', qty: 80, uomId: 9501 })).toEqual({
      kind: 'over',
      message: t.errors.qtyOverOnHand(80),
    });
  });

  it('상한과 같은 값은 막지 않는다', () => {
    expect(checkQtyLimit(80, { kind: 'known', qty: 80, uomId: 9501 })).toEqual({ kind: 'within' });
  });

  it('상한보다 적으면 막지 않는다', () => {
    expect(checkQtyLimit(79.5, { kind: 'known', qty: 80, uomId: 9501 })).toEqual({
      kind: 'within',
    });
  });

  /** 보유가 0이면 어떤 양수도 넘는다 — `includeZero`가 만든 이 갈래가 실제로 막아야 한다. */
  it('보유가 0이면 어떤 수량도 막는다', () => {
    expect(checkQtyLimit(0.1, { kind: 'known', qty: 0, uomId: 9501 })).toEqual({
      kind: 'over',
      message: t.errors.qtyOverOnHand(0),
    });
  });

  /**
   * **승인 13-6** — 상한을 확인하지 못했다고 막지 않는다. 막으면 LOT이 많은 창고에서 정당한
   * 반품이 영영 불가능해진다. 최종 판정은 서버가 하고, 초과분은 되돌릴 수 있는 실패다.
   */
  const eachUnmeasured: [string, Parameters<typeof checkQtyLimit>[1]][] = [
    ['목록에 없음', { kind: 'unknown', reason: 'notFound' }],
    ['잘림', { kind: 'unknown', reason: 'truncated' }],
    ['실패', { kind: 'unknown', reason: 'failed' }],
    ['단위 어긋남', { kind: 'unknown', reason: 'uomMismatch' }],
    ['아직 오지 않음', { kind: 'loading' }],
  ];

  it.each(eachUnmeasured)('%s이면 막지 않는다', (_name, onHand) => {
    expect(checkQtyLimit(999999, onHand)).toEqual({ kind: 'unmeasured' });
  });
});

describe('describeOnHand — 세 갈래를 서로 다른 글자로 낸다', () => {
  it('확인한 값에는 수량과 단위를 함께 낸다', () => {
    expect(describeOnHand({ kind: 'known', qty: 120, uomId: 9501 }, UOM_LABEL)).toBe(
      t.lineTable.onHandQtyPair(120, UOM_LABEL),
    );
  });

  it('아직 오지 않았으면 불러오는 중이라고 낸다', () => {
    expect(describeOnHand({ kind: 'loading' }, UOM_LABEL)).toBe(t.values.onHandLoading);
  });

  it('확인하지 못했으면 그렇게 낸다', () => {
    expect(describeOnHand({ kind: 'unknown', reason: 'notFound' }, UOM_LABEL)).toBe(
      t.values.onHandUnknown,
    );
  });

  /**
   * **이름 참조의 「알 수 없음」을 돌려쓰지 않는다.** 그 문구는 *값이 잘못됐다*는 신호로 이
   * 화면이 이미 정의해 두었는데, 상한을 못 구한 것은 값이 잘못된 것이 아니다.
   */
  it('이름 참조의 문구와 글자가 다르다', () => {
    expect(t.values.onHandUnknown).not.toBe(t.values.unknown);
    expect(t.values.onHandLoading).not.toBe(t.values.referenceLoading);
  });
});
