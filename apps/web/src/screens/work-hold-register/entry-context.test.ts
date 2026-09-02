import { describe, expect, it } from 'vitest';

import { parseWorkerNo, parseWorkOrderId } from './entry-context';

describe('진입 컨텍스트 읽기', () => {
  it('양의 정수만 작업지시로 읽는다', () => {
    expect(parseWorkOrderId('4013')).toBe(4013);
  });

  it.each(['', ' ', '0', '-3', '1.5', 'abc', '4013a'])('%o 는 작업지시가 아니다', (raw) => {
    expect(parseWorkOrderId(raw)).toBeNull();
  });

  it('없으면 null 이다 — 없는 값을 지어내지 않는다', () => {
    expect(parseWorkOrderId(null)).toBeNull();
    expect(parseWorkerNo(null)).toBeNull();
  });

  it('사번의 앞뒤 공백은 턴다', () => {
    expect(parseWorkerNo('  20260901 ')).toBe('20260901');
    expect(parseWorkerNo('   ')).toBeNull();
  });
});
