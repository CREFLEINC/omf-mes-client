/**
 * 창고 위치 코드(`locationPrefix`, omf-all-around#292) — 그 창고의 모든 위치 코드 앞에 붙는다(`K7PM-Z01-R001`).
 * 모든 창고에서 하나뿐이고 저장한 뒤에는 바꿀 수 없다.
 *
 * 창고 추가는 서버와 같은 글자로 무작위 4자를 미리 지어 채운다 — 헷갈리는 글자(I · L · O · 0 · 1)는 뺀다.
 * 사람은 대문자 · 숫자 2~6자로 고칠 수 있다. 다른 창고가 쓰는지는 서버가 가린다(400 `UNIQUE_VIOLATION`).
 */
export const LOCATION_PREFIX_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GENERATED_LENGTH = 4;
export const LOCATION_PREFIX_MAX_LENGTH = 6;
const LOCATION_PREFIX_PATTERN = /^[A-Z0-9]{2,6}$/u;

export const isValidLocationPrefix = (value: string): boolean =>
  LOCATION_PREFIX_PATTERN.test(value);

/* 한 바이트(0~255) 가운데 글자 수의 배수까지만 써야 앞 글자로 치우치지 않는다. */
const UNBIASED_LIMIT =
  Math.floor(256 / LOCATION_PREFIX_ALPHABET.length) * LOCATION_PREFIX_ALPHABET.length;

/**
 * 무작위 창고 위치 코드 4자. `crypto.getRandomValues` 는 평문 HTTP 배포본에도 있다(`randomUUID` 와 다르다, #1066).
 */
export const generateLocationPrefix = (): string => {
  let code = '';
  while (code.length < GENERATED_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(GENERATED_LENGTH * 2));
    for (const byte of bytes) {
      if (code.length === GENERATED_LENGTH) break;
      if (byte < UNBIASED_LIMIT)
        code += LOCATION_PREFIX_ALPHABET[byte % LOCATION_PREFIX_ALPHABET.length];
    }
  }
  return code;
};
