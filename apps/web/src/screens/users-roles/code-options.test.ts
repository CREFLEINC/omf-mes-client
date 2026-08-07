import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { ensureOption, lookupLabel, pendingCodeOptions, selectableOptions } from './code-options';
import type { LookupEntry } from './types';

const entries: LookupEntry[] = [
  { value: '1001', label: 'SYN-DEPT-01 · 합성 부서 A', isActive: true },
  { value: '1002', label: 'SYN-DEPT-02 · 합성 부서 B', isActive: false },
];

describe('ensureOption', () => {
  it('목록에 없는 값은 코드 그대로 덧붙인다 — 빼면 선택칸이 비어 보여 값이 사라진 줄 안다', () => {
    expect(ensureOption([{ value: 'A', label: '가' }], 'B')).toEqual([
      { value: 'A', label: '가' },
      { value: 'B', label: 'B' },
    ]);
  });

  it('이미 있는 값이면 그대로 둔다', () => {
    const options = [{ value: 'A', label: '가' }];

    expect(ensureOption(options, 'A')).toBe(options);
  });

  it('빈 값은 덧붙이지 않는다 — 「고르지 않음」은 값이 아니다', () => {
    const options = [{ value: 'A', label: '가' }];

    expect(ensureOption(options, '')).toBe(options);
  });
});

describe('selectableOptions', () => {
  it('기본은 사용 중인 것만 낸다', () => {
    expect(selectableOptions(entries, '').map((option) => option.value)).toEqual(['1001']);
  });

  it('지금 고른 값이 미사용이면 남기고 표식을 붙인다 — 빼면 값이 사라진 줄 안다', () => {
    const options = selectableOptions(entries, '1002');

    expect(options.map((option) => option.value)).toEqual(['1001', '1002']);
    expect(options[1]?.label).toContain(messages.usersRoles.values.inactiveSuffix.trim());
  });

  it('고른 값이 목록에 아예 없으면 코드 그대로 남는다', () => {
    const options = selectableOptions(entries, '9999');

    expect(options.at(-1)).toEqual({ value: '9999', label: '9999' });
  });
});

describe('lookupLabel', () => {
  it('번호를 사람이 읽는 이름으로 옮긴다', () => {
    expect(lookupLabel(entries, 1001)).toBe('SYN-DEPT-01 · 합성 부서 A');
  });

  it('값이 없으면 미지정 표기다', () => {
    expect(lookupLabel(entries, null)).toBe(messages.usersRoles.values.empty);
    expect(lookupLabel(entries, undefined)).toBe(messages.usersRoles.values.empty);
  });

  /** 내부 식별자라 사용자가 쓸 수 없는 값이고, 그것을 보이면 자료로 읽힌다. */
  it('목록에 없으면 번호를 화면에 내지 않는다', () => {
    expect(lookupLabel(entries, 9999)).toBe(messages.usersRoles.values.unknown);
    expect(lookupLabel(entries, 9999)).not.toContain('9999');
  });
});

describe('pendingCodeOptions', () => {
  /**
   * 값 목록이 확정되지 않은 코드의 선택지. **값을 지어내지 않는다** —
   * 자리표시 하나뿐이고, 서버가 준 값이 있으면 그것만 덧붙인다(계획 결정 16).
   */
  it('고른 값이 없으면 자리표시 하나뿐이다', () => {
    expect(pendingCodeOptions('')).toEqual([
      { value: '', label: messages.pendingCode.placeholder },
    ]);
  });

  it('서버가 준 값은 코드 그대로 남는다 — 선택지에 없다고 지우지 않는다', () => {
    const options = pendingCodeOptions('SYN-STATUS-A');

    expect(options).toEqual([
      { value: '', label: messages.pendingCode.placeholder },
      { value: 'SYN-STATUS-A', label: 'SYN-STATUS-A' },
    ]);
  });

  it('어떤 상태 코드값도 미리 적어 두지 않는다', () => {
    expect(pendingCodeOptions('').map((option) => option.value)).toEqual(['']);
  });
});
