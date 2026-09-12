import { describe, expect, it } from 'vitest';

import { readTerminalIdFromToken } from './pop-registration';

/**
 * 후보 토큰에서 **조회 주소를 만들 번호만** 읽는 자리를 잰다(공유계약 F-4).
 *
 * ⭐ **여기서 틀리면 남의 단말로 등록된다.** 이 값은 서명 검증을 거치지 않은 값이고, 그것으로
 * 만든 주소가 곧 「누구에게 물어볼 것인가」다 — 반올림된 번호는 **옆 단말의 200 응답**을
 * 받아 오고, 화면은 그것을 정상 등록으로 읽는다.
 */

/** `sub` 를 담은 토큰 하나를 만든다. 서명은 검증하지 않으므로 자리만 채운다. */
const tokenWith = (payload: Record<string, unknown>): string =>
  `header.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.signature`;

describe('readTerminalIdFromToken', () => {
  it('sub 가 단말 번호다 — 정수로 읽는다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: 1001, kind: 'terminal' }))).toBe(1001);
  });

  it('문자열로 온 sub 도 번호로 읽는다 — 계약은 정수이고 발급기 구현이 갈릴 수 있다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: '1001' }))).toBe(1001);
  });

  it('⛔ 안전 정수 밖이면 거부한다 — 반올림된 번호는 다른 단말을 가리킨다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: '9007199254740993' }))).toBeNull();
  });

  it('⛔ 0 과 음수는 어떤 단말도 가리키지 않는다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: 0 }))).toBeNull();
    expect(readTerminalIdFromToken(tokenWith({ sub: -1 }))).toBeNull();
  });

  it('⛔ 단말 «코드»(문자열)를 번호로 추측하지 않는다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: 'POP-01' }))).toBeNull();
  });

  it('토큰 모양이 아니면 null 이다 — 붙여넣기 실수를 등록 시도로 만들지 않는다', () => {
    expect(readTerminalIdFromToken('그냥-문자열')).toBeNull();
    expect(readTerminalIdFromToken('')).toBeNull();
    expect(readTerminalIdFromToken('header..signature')).toBeNull();
  });

  it('sub 가 없으면 null 이다', () => {
    expect(readTerminalIdFromToken(tokenWith({ kind: 'terminal' }))).toBeNull();
  });
});
