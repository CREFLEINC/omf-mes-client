import { describe, expect, it } from 'vitest';

import { judgeQuantity, unissuedGoodQty } from './issue-quantity';

describe('unissuedGoodQty — 미발행 양품', () => {
  it('양품 누계에서 이미 발번된 건수를 뺀다', () => {
    expect(unissuedGoodQty({ goodQty: 480, issuedCount: 200 })).toBe(280);
  });

  it('양품 누계를 모르면 «모른다» — 0으로 치지 않는다', () => {
    expect(unissuedGoodQty({ goodQty: null, issuedCount: 0 })).toBeNull();
  });

  it('발번 건수를 모르면 «모른다»', () => {
    expect(unissuedGoodQty({ goodQty: 480, issuedCount: null })).toBeNull();
  });

  it('발번이 양품을 앞질러도 음수를 내지 않는다 — 「-3장 발행」을 그릴 수 없다', () => {
    expect(unissuedGoodQty({ goodQty: 10, issuedCount: 13 })).toBe(0);
  });
});

describe('judgeQuantity — 발행 수량 판정', () => {
  it('미발행 양품 이내의 정수를 통과시킨다', () => {
    expect(judgeQuantity('280', 280)).toEqual({ ok: true, quantity: 280 });
  });

  it('빈 칸은 사유가 「입력하세요」다 — 아직 틀린 것이 아니다', () => {
    expect(judgeQuantity('   ', 280)).toEqual({ ok: false, reason: 'empty' });
  });

  it('숫자가 아니면 막는다 — 손 입력·붙여넣기가 키패드를 지나쳐 온다', () => {
    expect(judgeQuantity('12a', 280)).toEqual({ ok: false, reason: 'notANumber' });
  });

  it('0은 발행할 것이 없다', () => {
    expect(judgeQuantity('0', 280)).toEqual({ ok: false, reason: 'notPositive' });
  });

  it('미발행 양품을 넘으면 막는다', () => {
    expect(judgeQuantity('281', 280)).toEqual({ ok: false, reason: 'exceedsUnissued' });
  });

  it('경계값 — 미발행 양품과 같은 수는 통과한다', () => {
    expect(judgeQuantity('280', 280)).toEqual({ ok: true, quantity: 280 });
  });

  it('상한 1000을 넘으면 «미발행 양품»이 아니라 «상한»으로 말한다 — 고칠 방법이 다르다', () => {
    expect(judgeQuantity('1001', 5000)).toEqual({ ok: false, reason: 'exceedsLimit' });
  });

  it('경계값 — 1000은 통과한다', () => {
    expect(judgeQuantity('1000', 5000)).toEqual({ ok: true, quantity: 1000 });
  });

  it('미발행 양품을 모르면 발행을 열지 않는다 — 상한 없이 대량 발번을 보내지 않는다', () => {
    expect(judgeQuantity('10', null)).toEqual({ ok: false, reason: 'unknownUnissued' });
  });

  it('미발행이 0이면 어떤 수도 통과하지 못한다', () => {
    expect(judgeQuantity('1', 0)).toEqual({ ok: false, reason: 'exceedsUnissued' });
  });
});
