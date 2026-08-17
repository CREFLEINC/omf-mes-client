import { describe, expect, it } from 'vitest';

import { poRegisterKeys } from './queries';

/**
 * 캐시 키의 모양. **앞머리가 갈려 있어야** 한쪽을 다시 불러도 다른 쪽이 함께 무효화되지 않는다.
 */

describe('poRegisterKeys', () => {
  it('넘어온 전표와 만들어진 발주는 서로 다른 앞머리를 쓴다', () => {
    expect(poRegisterKeys.sourceReceipt(9101)).toEqual(['po-register', 'source-receipt', 9101]);
    expect(poRegisterKeys.detail(9801)).toEqual(['po-register', 'purchase-order', 9801]);
  });

  it('맥락이 없는 상태도 자기 키를 갖는다 — 키가 없으면 조회 상태를 가릴 수 없다', () => {
    expect(poRegisterKeys.sourceReceipt(null)).toEqual(['po-register', 'source-receipt', null]);
  });
});
