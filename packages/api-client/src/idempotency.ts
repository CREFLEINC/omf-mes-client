/**
 * 멱등 키를 만든다 — **평문 HTTP 로 서비스되는 배포본에서도 만들어진다.**
 *
 * ⛔ **`crypto.randomUUID()` 를 그대로 부르지 않는다.** 그 함수는 **보안 컨텍스트
 * (HTTPS · localhost)에만 있다.** 이 제품의 현장 서버는 LAN IP 와 평문 HTTP 포트로 서비스되므로
 * (`README.md` 「아직 안 된 것 — 리버스 프록시·TLS」) 브라우저에서 그 자리가 **비어 있다.**
 *
 * 실측(`http://192.168.1.72:3180`, 배포본 `web-v0.1.2`):
 *
 * ```
 * isSecureContext        false
 * crypto.randomUUID      undefined
 * crypto.getRandomValues function      ← 이쪽은 평문에서도 있다
 * ```
 *
 * ⚠ **없는 함수를 부르면 그 자리에서 동기적으로 던진다.** 키를 요청 인자 자리에서 만드는
 * 관례(요청마다 새 키 — `queries.ts`)와 겹치면 **요청을 보내기도 전에** 예외가 되어, 되먹임이
 * 달린 자리에 닿지 못한다. 화면에는 오류도 요청도 남지 않는다 — 눌렀는데 아무 일도 일어나지
 * 않는 화면이 된다(#1034 에서 로그인이 실제로 그랬다).
 *
 * 그래서 **있으면 그것을 쓰고, 없으면 직접 짓는다.** `getRandomValues` 는 보안 컨텍스트를
 * 요구하지 않으며 같은 암호학적 난수원을 쓴다 — 대체본이 약한 난수로 내려앉지 않는다.
 *
 * ⛔ **`Math.random()` 으로 물러서지 않는다.** 멱등 키가 겹치면 서버가 서로 다른 쓰기를 같은
 * 시도로 보고 **두 번째를 조용히 삼킨다.** 값이 비면 예외로 드러나지만 겹치는 값은 드러나지 않는다.
 */

/** RFC 4122 v4 의 자리 표기 8-4-4-4-12 를 **16진 글자 수**로 끊는 자리. */
const UUID_GROUP_ENDS = [8, 12, 16, 20] as const;

const VERSION_BYTE = 6;
const VARIANT_BYTE = 8;

/**
 * 무작위 16바이트를 v4 UUID 문자열로 옮긴다.
 *
 * 두 바이트에 규격이 정한 표식을 박는다 — 판(version 4)과 변종(variant 10xx)이다. 서버가
 * 형식을 검사할 때 이 표식이 없으면 **키가 거절되고**, 그것은 화면에서 400 으로만 보인다.
 */
const toUuidV4 = (bytes: Uint8Array): string => {
  /* 비트 연산은 규격이 그렇게 정의돼 있어서다 — 판은 상위 4비트, 변종은 상위 2비트에 박힌다. */
  bytes[VERSION_BYTE] = ((bytes[VERSION_BYTE] ?? 0) & 0x0f) | 0x40;
  bytes[VARIANT_BYTE] = ((bytes[VARIANT_BYTE] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  let start = 0;
  const groups: string[] = [];

  for (const end of UUID_GROUP_ENDS) {
    groups.push(hex.slice(start, end));
    start = end;
  }
  groups.push(hex.slice(start));

  return groups.join('-');
};

/**
 * 요청 하나가 쓸 멱등 키.
 *
 * ⭐ **부를 때마다 새 값이다.** 같은 시도의 재시도가 같은 키를 써야 하는 자리에서는 **부르는
 * 쪽이 값을 붙들어 둔다** — 이 함수는 붙들지 않는다.
 */
export const createIdempotencyKey = (): string => {
  /*
   * 있으면 그것을 쓴다 — 플랫폼 구현이 이 파일의 대체본보다 낫다. `typeof` 로 보는 이유는
   * 없을 때 **속성 접근만으로는 던지지 않기** 때문이다(값이 `undefined` 일 뿐이다).
   */
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return toUuidV4(bytes);
};
