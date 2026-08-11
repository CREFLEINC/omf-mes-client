import { describe, expect, it } from 'vitest';

import { blindCountLineResponse, countLineResponse } from './fixtures';
import { parseCountedQty } from './line-draft';
import { toCountLineView } from './types';
import { isReasonRequired, isVarianceStale } from './variance-rule';

const SYSTEM_QTY = 100;

const view = (overrides: Parameters<typeof countLineResponse>[0] = {}) =>
  toCountLineView(countLineResponse({ systemQty: SYSTEM_QTY, ...overrides }));

const required = (raw: string, systemQty: number | null = SYSTEM_QTY): boolean =>
  isReasonRequired({ systemQty, qty: parseCountedQty(raw) });

describe('isReasonRequired — 차이 사유의 조건부 필수', () => {
  /*
   * **완료 조건 C38** — 계약은 「차이가 0이 아니면 필수」라 적었고 착수 이슈 §6은 「차이 수량을
   * 화면에서 다시 계산하지 마세요」라 적었다. 둘을 함께 만족시키는 형태는 **「친 실물 수량 ≠
   * 장부 수량」 비교 한 줄**뿐이다 — 뺄셈을 하지 않으므로 화면이 차이 수량을 만들지 않는다.
   */
  it('친 실물 수량이 장부와 다르면 필수다', () => {
    expect(required('98')).toBe(true);
    expect(required('101')).toBe(true);
  });

  it('친 실물 수량이 장부와 같으면 필수가 아니다', () => {
    expect(required(String(SYSTEM_QTY))).toBe(false);
  });

  /** 0도 정상 값이라 **장부가 0이면 차이가 없다** — 0을 「비었다」로 뭉개면 여기서 어긋난다. */
  it('장부가 0이고 실물도 0이면 필수가 아니다', () => {
    expect(required('0', 0)).toBe(false);
    expect(required('1', 0)).toBe(true);
  });

  /*
   * 아직 치지 않았거나 잘못 친 줄에는 **견줄 값이 없다.** 필수로 세우면 「수량도 안 넣었는데
   * 사유부터 고르라」는 안내가 되고, 사용자가 무엇을 먼저 해야 하는지 잃는다.
   */
  it.each(['', '   ', 'abc', '-1'])('수량이 「%s」면 판정하지 않는다', (raw) => {
    expect(required(raw)).toBe(false);
  });

  /*
   * **완료 조건 C39 · 어긋남 5** — 블라인드에서는 장부 수량이 내려오지 않아(계약 설명)
   * 견줄 값이 없다. 없는 값을 0으로 보고 판정하면 **전 줄이 차이 있는 줄이 되어** 차이 사유가
   * 늘 필수가 되고, 코드 목록이 확정되지 않은 지금은 블라인드 실사의 저장이 통째로 막힌다.
   */
  it('블라인드에서는 장부가 없어 판정하지 않는다', () => {
    expect(required('98', null)).toBe(false);
    expect(required('0', null)).toBe(false);
  });

  /** 계약이 필수라고 말해도 런타임에 없을 수 있는 값을 그대로 넘겨도 같은 결론이다(결정 4). */
  it('블라인드 응답을 옮긴 줄은 장부가 `null`이라 판정하지 않는다', () => {
    const blind = toCountLineView(blindCountLineResponse());

    expect(blind.systemQty).toBeNull();
    expect(isReasonRequired({ systemQty: blind.systemQty, qty: parseCountedQty('98') })).toBe(
      false,
    );
  });
});

describe('isVarianceStale — 차이 칸이 낡았는가', () => {
  /*
   * **완료 조건 C41** — 저장하지 않은 실물 수량 옆에 낡은 차이를 그대로 두지 않는다.
   * 화면이 차이를 **다시 계산하지 않으면서도** 낡음을 숨기지 않는 유일한 형태다.
   */
  it('친 값이 저장된 실물 수량과 다르면 낡았다', () => {
    const line = view({ countedQty: 98 });

    expect(isVarianceStale({ savedQty: line.countedQty, qty: parseCountedQty('50') })).toBe(true);
  });

  it('친 값이 저장된 값과 같으면 낡지 않았다', () => {
    const line = view({ countedQty: 98 });

    expect(isVarianceStale({ savedQty: line.countedQty, qty: parseCountedQty('98') })).toBe(false);
  });

  /*
   * **아직 치지 않았으면 낡지 않았다.** 빈 칸에도 표식을 붙이면 위치를 여는 순간 전 줄에
   * 「저장하면 다시 계산됩니다」가 서서, 정작 값을 고친 줄이 눈에 띄지 않는다.
   */
  it.each(['', 'abc'])('수량이 「%s」면 낡지 않았다', (raw) => {
    expect(isVarianceStale({ savedQty: 98, qty: parseCountedQty(raw) })).toBe(false);
  });
});
