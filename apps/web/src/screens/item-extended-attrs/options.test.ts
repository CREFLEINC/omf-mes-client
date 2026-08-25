import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { LookupSource } from '../../patterns/lookup-display';
import { ensureOption, lookupLabel, selectableOptions } from './options';
import type { LookupEntry, SelectOption } from './types';

const entries: LookupEntry[] = [
  { value: '7001', label: 'SYN-UOM-01 · 합성 단위 A', isActive: true },
  { value: '7002', label: 'SYN-UOM-02 · 합성 단위 B', isActive: false },
];

const source = (
  lookupEntries: LookupEntry[] = entries,
  state: 'ready' | 'loading' | 'failed' = 'ready',
): LookupSource<LookupEntry> => ({
  entries: lookupEntries,
  isError: state === 'failed',
  isLoading: state === 'loading',
});

describe('ensureOption', () => {
  const options: SelectOption[] = [
    { value: 'FIFO', label: 'FIFO' },
    { value: 'FEFO', label: 'FEFO' },
  ];

  it('이미 있는 값이면 목록을 그대로 둔다', () => {
    expect(ensureOption(options, 'FIFO')).toBe(options);
  });

  /* 빼면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다. */
  it('목록에 없는 현재 값을 덧붙인다', () => {
    expect(ensureOption(options, 'SYN-POLICY-X')).toEqual([
      ...options,
      { value: 'SYN-POLICY-X', label: 'SYN-POLICY-X' },
    ]);
  });

  it('값이 없으면 아무것도 덧붙이지 않는다', () => {
    expect(ensureOption(options, '')).toBe(options);
  });
});

describe('selectableOptions', () => {
  it('사용 중인 것만 고를 수 있다', () => {
    expect(selectableOptions(source(), '').map((option) => option.value)).toEqual(['7001']);
  });

  /* 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다. */
  it('지금 고른 값이 미사용이면 표식을 붙여 남긴다', () => {
    const options = selectableOptions(source(), '7002');

    expect(options.map((option) => option.value)).toEqual(['7001', '7002']);
    expect(options[1]?.label).toBe('SYN-UOM-02 · 합성 단위 B (미사용)');
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

  /*
   * **「아직 못 받았다」와 「목록에 없다」는 다른 사실이다.**
   * 같은 문구로 내면 사용자가 잘못 담긴 자료로 읽고 원본 시스템을 확인하러 간다.
   */
  it('목록을 받는 중이면 「알 수 없음」이 아니라 불러오는 중이다', () => {
    expect(lookupLabel([], 7001, true)).toBe(messages.common.reference.loading);
  });

  it('값이 없으면 목록을 받는 중이어도 미지정 표기다 — 오지 않을 이름을 기다리게 하지 않는다', () => {
    expect(lookupLabel([], null, true)).toBe('—');
  });

  /* 다 받은 뒤에도 없으면 그때는 정말 「알 수 없음」이다. */
  it('다 받았는데 없으면 「알 수 없음」이다', () => {
    expect(lookupLabel([], 7001, false)).toBe('알 수 없음');
  });

  it('조회가 실패하면 실패 문구를 내고 번호를 숨긴다', () => {
    expect(lookupLabel([], 7001, false, true)).toBe(messages.common.reference.failed);
  });
});
