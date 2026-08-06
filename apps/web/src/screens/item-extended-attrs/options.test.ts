import { describe, expect, it } from 'vitest';

import { lookupLabel } from './options';
import type { LookupEntry } from './types';

const entries: LookupEntry[] = [
  { value: '7001', label: 'SYN-UOM-01 · 합성 단위 A', isActive: true },
  { value: '7002', label: 'SYN-UOM-02 · 합성 단위 B', isActive: false },
];

describe('lookupLabel', () => {
  it('번호를 이름으로 옮긴다', () => {
    expect(lookupLabel(entries, 7001)).toBe('SYN-UOM-01 · 합성 단위 A');
  });

  it('미사용 값도 이름으로 옮긴다 — 지난 자료를 읽을 수 있어야 한다', () => {
    expect(lookupLabel(entries, 7002)).toBe('SYN-UOM-02 · 합성 단위 B');
  });

  /*
   * 내부 식별자라 사용자가 쓸 수 없는 값이고, 보이면 자료로 읽힌다.
   * 번호를 대신 내는 뮤테이션이 여기서 잡힌다.
   */
  it('목록에 없는 번호는 「알 수 없음」이고 번호를 내지 않는다', () => {
    expect(lookupLabel(entries, 9999)).toBe('알 수 없음');
  });

  it('값이 없으면 미지정 표기다', () => {
    expect(lookupLabel(entries, null)).toBe('—');
    expect(lookupLabel(entries, undefined)).toBe('—');
  });
});
