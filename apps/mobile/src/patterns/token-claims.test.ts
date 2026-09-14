import { describe, expect, it } from 'vitest';

import { readTerminalClaims, readTerminalIdFromToken } from './token-claims';

const tokenWith = (payload: unknown): string => {
  const body = btoa(JSON.stringify(payload))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

  return `header.${body}.signature`;
};

/*
 * ⭐ **토큰이 싣고 오는 것은 단말 «번호» 하나뿐이다**(`sub`).
 *
 * 종전에는 `terminalCode` 와 `plantId` 가 토큰에 들어 있다고 보고 둘이 없으면 등록 QR 이
 * 아니라고 판정했다. 실제 토큰에는 그 둘이 없어 **모든 등록 QR 이 걸러졌고**, 화면은 읽은
 * 것을 조용히 버린 채 스캔 대기에 머물렀다 — 현장에서는 「카메라는 열렸는데 인식이 안 된다」로
 * 보인다(#1103). 이름·공장은 이 번호로 서버에 물어본다(P-CO-01 이 같은 길을 쓴다).
 */
describe('단말 토큰에서 단말 번호 읽기', () => {
  it('sub 가 단말 번호다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: 1001 }))).toBe(1001);
  });

  it('sub 가 글자로 와도 번호로 읽는다 — 서버가 문자열로 싣기도 한다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: '1001' }))).toBe(1001);
  });

  /* 실서버 토큰에는 이 둘이 없다. 있다고 요구하면 등록이 통째로 막힌다. */
  it('terminalCode·plantId 가 없어도 읽는다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: 1001, iss: 'omf-mes' }))).toBe(1001);
  });

  it('채움 문자 없는 본문도 읽는다 — 실제 토큰에는 붙지 않는다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: 42, iat: 1757000000 }))).toBe(42);
  });

  /*
   * ⚠ int64 를 온전히 담지 못해 큰 번호는 조용히 반올림된다. 그 번호로 조회하면 **옆 단말의
   * 정보**를 받아 그것으로 등록된다.
   */
  it('안전 정수 밖이면 읽지 않는다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: '9007199254740993' }))).toBeNull();
  });

  it('0 이하는 단말 번호가 아니다', () => {
    expect(readTerminalIdFromToken(tokenWith({ sub: 0 }))).toBeNull();
    expect(readTerminalIdFromToken(tokenWith({ sub: -1 }))).toBeNull();
  });

  it('sub 가 없으면 읽지 않는다', () => {
    expect(readTerminalIdFromToken(tokenWith({ terminalCode: 'SYN-TERM-01' }))).toBeNull();
  });

  it('토큰이 아닌 QR은 오류가 아니라 null이다', () => {
    expect(readTerminalIdFromToken('https://example.test/anything')).toBeNull();
  });

  it('세 도막이 아니면 읽지 않는다', () => {
    expect(readTerminalIdFromToken('header.body')).toBeNull();
  });

  it('본문이 깨져 있으면 읽지 않는다', () => {
    expect(readTerminalIdFromToken('header.@@@.signature')).toBeNull();
  });
});

/*
 * 등록 끝에 단말 코드를 보여 사람이 관리자 안내와 대조한다(M-CO-01 §5-2). 기계가 틀린 QR 을
 * 잡을 방법이 없어 사람이 잡는 자리다.
 *
 * ⚠ 계약이 토큰 클레임을 아직 정의하지 않는다. 그래서 값이 없을 수 있고, 없다고 등록을 막지
 * 않는다 - 막으면 대조라는 «편의»를 위해 등록이라는 «필수»를 잃는다.
 */
describe('단말 토큰에서 보여 줄 값 읽기', () => {
  it('코드와 공장을 읽는다', () => {
    expect(
      readTerminalClaims(tokenWith({ sub: 7, terminalCode: 'SYN-PDA-01', plantId: 3 })),
    ).toEqual({ terminalId: 7, terminalCode: 'SYN-PDA-01', plantId: 3 });
  });

  it('코드가 없어도 번호는 읽는다', () => {
    expect(readTerminalClaims(tokenWith({ sub: 7, plantId: 3 }))).toEqual({
      terminalId: 7,
      terminalCode: null,
      plantId: 3,
    });
  });

  it('공장이 없어도 번호는 읽는다', () => {
    expect(readTerminalClaims(tokenWith({ sub: 7 }))).toEqual({
      terminalId: 7,
      terminalCode: null,
      plantId: null,
    });
  });

  /* 번호가 없으면 어디로 물어볼지도 모른다. 그때만 등록 QR 이 아니라고 본다. */
  it('번호가 없으면 아무것도 내지 않는다', () => {
    expect(readTerminalClaims(tokenWith({ terminalCode: 'SYN-PDA-01' }))).toBeNull();
  });

  it('토큰이 아니면 아무것도 내지 않는다', () => {
    expect(readTerminalClaims('그냥 문자열')).toBeNull();
  });
});
