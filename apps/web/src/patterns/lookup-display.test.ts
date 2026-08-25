import { describe, expect, it } from 'vitest';

import {
  lookupDisplayLabel,
  type LookupSource,
  selectableLookupOptions,
  toLookupDisplayState,
} from './lookup-display';

const source = (
  entries: LookupSource['entries'] = [],
  state: 'ready' | 'loading' | 'failed' = 'ready',
): LookupSource => ({
  entries,
  isError: state === 'failed',
  isLoading: state === 'loading',
});

const active = { value: '7001', label: '합성 단위', isActive: true };
const inactive = { value: '7002', label: '과거 단위', isActive: false };

describe('lookup 표시 상태', () => {
  it('값 없음·이름 확인·목록 미발견을 서로 가른다', () => {
    expect(toLookupDisplayState(source([active]), null)).toEqual({ kind: 'empty' });
    expect(toLookupDisplayState(source([active]), 7001)).toEqual({
      kind: 'named',
      label: '합성 단위',
    });
    expect(toLookupDisplayState(source([active]), 9999)).toEqual({ kind: 'unknown' });
  });

  it('조회 실패와 로딩을 미발견보다 먼저 판정한다', () => {
    expect(toLookupDisplayState(source([], 'failed'), 7001)).toEqual({ kind: 'failed' });
    expect(toLookupDisplayState(source([], 'loading'), 7001)).toEqual({ kind: 'loading' });
    expect(lookupDisplayLabel(source([], 'failed'), 7001)).toBe('이름을 불러오지 못했습니다');
    expect(lookupDisplayLabel(source([], 'loading'), 7001)).toBe('이름 불러오는 중');
  });
});

describe('lookup 선택지', () => {
  it('사용 중 선택지와 현재 선택한 미사용 값을 이름으로 유지한다', () => {
    expect(selectableLookupOptions(source([active, inactive]), '7002')).toEqual([
      { value: '7001', label: '합성 단위' },
      { value: '7002', label: '과거 단위 (미사용)' },
    ]);
  });

  it.each([
    ['ready', '알 수 없음'],
    ['loading', '이름 불러오는 중'],
    ['failed', '이름을 불러오지 못했습니다'],
  ] as const)('%s 상태의 미확인 FK는 값을 보존하되 번호를 라벨로 내지 않는다', (state, label) => {
    const options = selectableLookupOptions(source([], state), '9999');

    expect(options).toEqual([{ value: '9999', label }]);
    expect(options[0]?.label).not.toContain('9999');
  });

  it('선택 값이 없으면 fallback 선택지를 만들지 않는다', () => {
    expect(selectableLookupOptions(source([], 'loading'), '')).toEqual([]);
  });
});
