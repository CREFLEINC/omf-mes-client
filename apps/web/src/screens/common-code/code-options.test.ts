import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { LookupSource } from '../../patterns/lookup-display';
import { ensureOption, lookupLabel, selectableOptions } from './code-options';
import type { LookupEntry } from './types';

const entry = (value: string, label: string, isActive = true): LookupEntry => ({
  value,
  label,
  isActive,
});

const source = (
  entries: LookupEntry[],
  state: 'ready' | 'loading' | 'failed' = 'ready',
): LookupSource<LookupEntry> => ({
  entries,
  isError: state === 'failed',
  isLoading: state === 'loading',
});

describe('ensureOption', () => {
  /* 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다. */
  it('고른 값이 목록에 없으면 값 그대로 덧붙인다', () => {
    expect(ensureOption([{ value: '1001', label: '제조사업부' }], '2002')).toEqual([
      { value: '1001', label: '제조사업부' },
      { value: '2002', label: '2002' },
    ]);
  });

  it('이미 있으면 그대로 둔다', () => {
    const options = [{ value: '1001', label: '제조사업부' }];

    expect(ensureOption(options, '1001')).toBe(options);
  });

  it('고른 값이 없으면 그대로 둔다', () => {
    const options = [{ value: '1001', label: '제조사업부' }];

    expect(ensureOption(options, '')).toBe(options);
  });
});

describe('selectableOptions', () => {
  it('사용 중인 것만 선택지가 된다', () => {
    const entries = [entry('1001', '합성 부서 A'), entry('1002', '합성 부서 B', false)];

    expect(selectableOptions(source(entries), '').map((option) => option.value)).toEqual(['1001']);
  });

  /* 지금 고른 값이 미사용이어도 남긴다 — 빼면 선택칸이 비어 보인다. */
  it('지금 고른 미사용 값은 남기고 표식을 붙인다', () => {
    const entries = [entry('1001', '합성 부서 A'), entry('1002', '합성 부서 B', false)];
    const options = selectableOptions(source(entries), '1002');

    expect(options.map((option) => option.value)).toEqual(['1001', '1002']);
    expect(options[1]?.label).toBe('합성 부서 B (미사용)');
  });

  it.each([
    ['ready', messages.common.reference.unknown],
    ['loading', messages.common.reference.loading],
    ['failed', messages.common.reference.failed],
  ] as const)('%s 상태의 미확인 FK는 값만 보존하고 번호를 라벨로 내지 않는다', (state, label) => {
    const options = selectableOptions(source([], state), '9999');

    expect(options).toEqual([{ value: '9999', label }]);
    expect(options[0]?.label).not.toContain('9999');
  });
});

describe('lookupLabel', () => {
  it('번호를 이름으로 옮긴다', () => {
    expect(lookupLabel(source([entry('1001', '제조사업부')]), 1001)).toBe('제조사업부');
  });

  /* 번호를 화면에 내지 않는다 — 사용자가 쓸 수 없는 값이다. */
  it('목록에 없으면 「알 수 없음」이고 번호를 내지 않는다', () => {
    expect(lookupLabel(source([entry('1001', '제조사업부')]), 9999)).toBe('알 수 없음');
  });

  it('값이 없으면 미지정 표기다', () => {
    expect(lookupLabel(source([entry('1001', '제조사업부')]), null)).toBe('—');
  });

  it('목록을 받는 중과 실패를 미확인과 구분한다', () => {
    expect(lookupLabel(source([], 'loading'), 9999)).toBe(messages.common.reference.loading);
    expect(lookupLabel(source([], 'failed'), 9999)).toBe(messages.common.reference.failed);
  });
});
