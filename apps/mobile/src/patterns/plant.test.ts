import { describe, expect, it, vi } from 'vitest';

import { currentPlantId } from './plant';

const { token } = vi.hoisted(() => ({ token: { value: null as string | null } }));

vi.mock('./device-token', () => ({
  currentDeviceToken: () => token.value,
}));

const jwtWith = (claims: Record<string, unknown>): string =>
  `head.${btoa(JSON.stringify(claims))}.sig`;

describe('단말이 선 공장', () => {
  it('토큰의 공장을 낸다', () => {
    token.value = jwtWith({ terminalCode: 'SYN-TERM-01', plantId: 7 });

    expect(currentPlantId()).toBe(7);
  });

  /* 모르는 것을 0 이나 1 로 채우면 다른 공장의 재고가 는다. */
  it('토큰이 없으면 지어내지 않는다', () => {
    token.value = null;

    expect(currentPlantId()).toBeNull();
  });

  it('공장이 없는 토큰이면 지어내지 않는다', () => {
    token.value = jwtWith({ terminalCode: 'SYN-TERM-01' });

    expect(currentPlantId()).toBeNull();
  });

  it('토큰 모양이 아니면 지어내지 않는다', () => {
    token.value = 'not-a-token';

    expect(currentPlantId()).toBeNull();
  });
});
