import { describe, expect, it } from 'vitest';

import { readTerminalClaims } from './token-claims';

const tokenWith = (payload: unknown): string => {
  const body = btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_');
  return `header.${body}.signature`;
};

describe('단말 토큰의 클레임 읽기', () => {
  it('단말 코드와 공장을 읽는다', () => {
    const token = tokenWith({ terminalCode: 'SYN-TERM-01', plantId: 7, tokenVersion: 3 });

    expect(readTerminalClaims(token)).toEqual({ terminalCode: 'SYN-TERM-01', plantId: 7 });
  });

  it('토큰이 아닌 QR은 오류가 아니라 null이다', () => {
    expect(readTerminalClaims('https://example.test/anything')).toBeNull();
  });

  it('세 도막이 아니면 읽지 않는다', () => {
    expect(readTerminalClaims('header.body')).toBeNull();
  });

  /* 두 도막인데 뒤 도막이 읽히면 토큰이 아닌 값을 토큰으로 두게 된다. */
  it('도막이 모자라면 내용이 읽히더라도 읽지 않는다', () => {
    const body = btoa(JSON.stringify({ terminalCode: 'SYN-TERM-01', plantId: 7 }));

    expect(readTerminalClaims(`header.${body}`)).toBeNull();
  });

  it('본문이 깨져 있으면 읽지 않는다', () => {
    expect(readTerminalClaims('header.@@@.signature')).toBeNull();
  });

  it('단말 코드가 없으면 읽지 않는다', () => {
    expect(readTerminalClaims(tokenWith({ plantId: 7 }))).toBeNull();
  });

  it('공장이 없으면 읽지 않는다', () => {
    expect(readTerminalClaims(tokenWith({ terminalCode: 'SYN-TERM-01' }))).toBeNull();
  });

  it('공장이 숫자가 아니면 읽지 않는다', () => {
    expect(readTerminalClaims(tokenWith({ terminalCode: 'SYN-TERM-01', plantId: '7' }))).toBeNull();
  });

  it('빈 단말 코드는 값이 아니다', () => {
    expect(readTerminalClaims(tokenWith({ terminalCode: '', plantId: 7 }))).toBeNull();
  });
});
