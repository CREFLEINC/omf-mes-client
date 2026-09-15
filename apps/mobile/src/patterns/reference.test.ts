import { describe, expect, it } from 'vitest';

import { referenceFromQuery, referenceLabel } from './reference';

interface Lot {
  lotNo: string;
}

const asQuery = <T>(state: { isError?: boolean; isPending?: boolean; data?: Map<number, T> }) => ({
  isError: state.isError ?? false,
  isPending: state.isPending ?? false,
  data: state.data,
});

describe('한 번에 받는 조회의 표기', () => {
  const lots = new Map([[8201, { lotNo: 'FG-2026-000311' }]]);

  it('받았으면 그 값을 보인다', () => {
    const resolve = referenceFromQuery(asQuery({ data: lots }), (lot) => lot.lotNo);

    expect(referenceLabel(resolve(8201))).toBe('FG-2026-000311');
  });

  /*
   * 대리키를 끼우면 사람이 읽을 수 없는 숫자가 값인 척한다 - 라벨에 찍힌 34자리와 견줄 수
   * 없는데 견줄 것처럼 보인다.
   */
  it('못 받았으면 못 받았다고 말한다', () => {
    const resolve = referenceFromQuery(asQuery<Lot>({ isError: true }), (lot) => lot.lotNo);

    expect(referenceLabel(resolve(8201))).toBe('이름을 불러오지 못했습니다');
  });

  /* 아직 오는 중인 것을 없다고 말하면 정상 값이 잘못된 값으로 보인다. */
  it('받는 중이면 받는 중이라고 말한다', () => {
    const resolve = referenceFromQuery(asQuery<Lot>({ isPending: true }), (lot) => lot.lotNo);

    expect(referenceLabel(resolve(8201))).toBe('이름 불러오는 중');
  });

  /* 다 받았는데 그 안에 없는 것은 서버에 없는 것이다. 받는 중과 가른다. */
  it('받았는데 그 안에 없으면 없다고 말한다', () => {
    const resolve = referenceFromQuery(asQuery({ data: lots }), (lot) => lot.lotNo);

    expect(referenceLabel(resolve(9999))).toBe('알 수 없음');
  });

  /* 값이 없는 칸과 못 찾은 칸은 다르다. 빈 칸에 못 찾았다고 적으면 비어 있는 것이 잘못으로 읽힌다. */
  it('번호가 없으면 빈 값으로 둔다', () => {
    const resolve = referenceFromQuery(asQuery({ data: lots }), (lot) => lot.lotNo);

    expect(referenceLabel(resolve(null))).toBe('—');
  });
});
