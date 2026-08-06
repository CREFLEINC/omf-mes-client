import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER_STATUS_CODES,
  distinctValues,
  toCodeOptions,
  withCurrentValue,
} from './filter-options';
import { messageRow } from './fixtures';

const rows = [
  messageRow({ statusCode: 'FAILED', interfaceCode: 'IF-SAMPLE-B' }),
  messageRow({ statusCode: 'PENDING', interfaceCode: 'IF-SAMPLE-A' }),
  messageRow({ statusCode: 'FAILED', interfaceCode: 'IF-SAMPLE-A' }),
  messageRow({ statusCode: '', interfaceCode: 'IF-SAMPLE-A' }),
];

describe('distinctValues', () => {
  it('중복을 접고 오름차순으로 낸다', () => {
    expect(distinctValues(rows, (row) => row.interfaceCode)).toEqual([
      'IF-SAMPLE-A',
      'IF-SAMPLE-B',
    ]);
  });

  it('빈 값은 선택지가 되지 않는다 — 고를 수 없는 항목이 생긴다', () => {
    expect(distinctValues(rows, (row) => row.statusCode)).toEqual(['FAILED', 'PENDING']);
  });

  it('행이 없으면 빈 목록이다', () => {
    expect(distinctValues([], (row) => row.statusCode)).toEqual([]);
  });
});

describe('withCurrentValue', () => {
  it('지금 고른 값이 목록에 없으면 맨 앞에 남긴다 — 없으면 해제할 방법이 사라진다', () => {
    expect(withCurrentValue(['A', 'B'], 'Z')).toEqual(['Z', 'A', 'B']);
  });

  it('이미 목록에 있으면 두 번 넣지 않는다', () => {
    expect(withCurrentValue(['A', 'B'], 'B')).toEqual(['A', 'B']);
  });

  it('고른 값이 없으면 목록 그대로다', () => {
    expect(withCurrentValue(['A', 'B'], '')).toEqual(['A', 'B']);
  });
});

describe('toCodeOptions', () => {
  it('자리표시 상수와 조회 결과와 고른 값을 한 목록으로 합친다', () => {
    expect(toCodeOptions(['DEFINED'], rows, (row) => row.statusCode, 'GONE')).toEqual([
      'GONE',
      'DEFINED',
      'FAILED',
      'PENDING',
    ]);
  });

  it('자리표시 상수는 아직 비어 있다 — 값이 확정되면 이 배열만 채운다', () => {
    expect(PLACEHOLDER_STATUS_CODES).toEqual([]);
  });

  it('자리표시와 조회 결과가 겹쳐도 한 번만 나온다', () => {
    expect(toCodeOptions(['FAILED'], rows, (row) => row.statusCode, '')).toEqual([
      'FAILED',
      'PENDING',
    ]);
  });
});
