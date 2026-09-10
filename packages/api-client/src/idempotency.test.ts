import { afterEach, describe, expect, it, vi } from 'vitest';

import { createIdempotencyKey } from './idempotency';

/** RFC 4122 v4 — 판(4)과 변종(8·9·a·b) 자리까지 함께 본다. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * 평문 HTTP 배포본을 흉내 낸다 — `crypto.randomUUID` 만 지운다.
 *
 * ⭐ **`getRandomValues` 는 남긴다.** 브라우저가 실제로 그렇다(실측: `isSecureContext: false`
 * 에서 `randomUUID` 는 `undefined`, `getRandomValues` 는 함수). 둘 다 지우면 시험이 재는 것이
 * 현실과 달라진다.
 */
const withoutRandomUuid = (): void => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(
    undefined as unknown as ReturnType<Crypto['randomUUID']>,
  );
  Reflect.set(crypto, 'randomUUID', undefined);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createIdempotencyKey', () => {
  it('보안 컨텍스트에서는 플랫폼 구현을 그대로 쓴다', () => {
    const platform = vi.spyOn(crypto, 'randomUUID');

    expect(createIdempotencyKey()).toMatch(UUID_V4);
    expect(platform).toHaveBeenCalledTimes(1);
  });

  /**
   * ⭐ **이 시험이 #1034의 감지기다.**
   *
   * 평문 HTTP 로 서비스되는 배포본에는 `crypto.randomUUID` 가 없다. 앞 회차는 그것을 직접
   * 불렀고, 없는 함수를 부른 자리가 **동기적으로 던져** 요청도 오류 되먹임도 없이 화면이
   * 침묵했다. 여기서 던지면 그 결함이 되돌아온 것이다.
   */
  it('crypto.randomUUID가 없어도 던지지 않고 v4 UUID를 낸다', () => {
    withoutRandomUuid();

    expect(crypto.randomUUID).toBeUndefined();
    expect(createIdempotencyKey()).toMatch(UUID_V4);
  });

  /**
   * ⛔ **키가 겹치면 서버가 서로 다른 쓰기를 같은 시도로 보고 두 번째를 조용히 삼킨다.**
   * 값이 비면 예외로 드러나지만 겹치는 값은 드러나지 않는다 — 그래서 여기서 잰다.
   */
  it('대체 경로도 부를 때마다 다른 값을 낸다', () => {
    withoutRandomUuid();

    const keys = new Set(Array.from({ length: 500 }, () => createIdempotencyKey()));

    expect(keys.size).toBe(500);
  });

  /**
   * 대체 경로가 **암호학적 난수원을 쓴다**는 것을 잰다. `Math.random()` 으로 내려앉으면
   * 이 감지기가 울린다 — 그 사실은 값의 모양만 봐서는 드러나지 않는다.
   */
  it('평문 컨텍스트 흉내가 시험 사이에 되돌아간다', () => {
    expect(typeof crypto.randomUUID).toBe('function');
  });

  it('대체 경로가 crypto.getRandomValues에서 값을 얻는다', () => {
    withoutRandomUuid();

    const source = vi.spyOn(crypto, 'getRandomValues');

    createIdempotencyKey();

    expect(source).toHaveBeenCalledTimes(1);
    expect(source.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
  });
});
