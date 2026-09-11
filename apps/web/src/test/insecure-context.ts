import { vi } from 'vitest';

/**
 * 평문 HTTP 배포본을 흉내 낸다 — `crypto.randomUUID` 만 지운다(#1034 · #1066).
 *
 * ⭐ **`getRandomValues` 는 남긴다.** 브라우저가 실제로 그렇다(실측: `isSecureContext: false`
 * 에서 `randomUUID` 는 `undefined`, `getRandomValues` 는 함수). 둘 다 지우면 시험이 재는 것이
 * 현실과 달라진다.
 *
 * ⚠ **되돌리는 것은 부르는 쪽 몫이다** — `afterEach` 에서 `vi.restoreAllMocks()` 를 부른다.
 * 지우기 전에 감시를 먼저 거는 것은 그 복원이 원래 함수를 되찾게 하려는 것이다.
 */
export const withoutRandomUuid = (): void => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(
    undefined as unknown as ReturnType<Crypto['randomUUID']>,
  );
  Reflect.set(crypto, 'randomUUID', undefined);
};
