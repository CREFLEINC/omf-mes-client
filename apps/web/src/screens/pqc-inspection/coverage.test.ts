import { describe, expect, it } from 'vitest';

import {
  EMPTY_COVERAGE_DRAFT,
  fillCoverage,
  isCoverageOutOfOrder,
  toCoverageBody,
  toCoverageDraft,
} from './coverage';

const NINE = '2026-08-27T09:00:00+09:00';
const ELEVEN = '2026-08-27T11:00:00+09:00';

describe('toCoverageDraft', () => {
  it('저장된 구간을 그대로 옮긴다', () => {
    expect(toCoverageDraft(NINE, ELEVEN)).toEqual({ from: NINE, to: ELEVEN });
  });

  it('없는 값은 빈 칸이다 — 지어내지 않는다', () => {
    expect(toCoverageDraft(null, null)).toEqual(EMPTY_COVERAGE_DRAFT);
  });
});

describe('fillCoverage — 자동으로 채우되 덮지 않는다', () => {
  it('빈 칸을 검사 시각으로 채운다', () => {
    expect(fillCoverage(EMPTY_COVERAGE_DRAFT, NINE)).toEqual({ from: NINE, to: NINE });
  });

  it('이미 값이 있으면 덮지 않는다 — 고친 값이 재조회로 사라지지 않는다', () => {
    expect(fillCoverage({ from: NINE, to: ELEVEN }, '2026-08-27T15:00:00+09:00')).toEqual({
      from: NINE,
      to: ELEVEN,
    });
  });

  it('한쪽만 비어 있으면 그쪽만 채운다', () => {
    expect(fillCoverage({ from: NINE, to: '' }, ELEVEN)).toEqual({ from: NINE, to: ELEVEN });
  });
});

describe('isCoverageOutOfOrder — 뒤집힘을 말하되 고치지 않는다', () => {
  it('종료가 시작보다 앞서면 뒤집힘이다', () => {
    expect(isCoverageOutOfOrder({ from: ELEVEN, to: NINE })).toBe(true);
  });

  it('같은 시각은 뒤집힘이 아니다 — 한 순간을 대표하는 검사가 있다', () => {
    expect(isCoverageOutOfOrder({ from: NINE, to: NINE })).toBe(false);
  });

  it('바른 차례는 뒤집힘이 아니다', () => {
    expect(isCoverageOutOfOrder({ from: NINE, to: ELEVEN })).toBe(false);
  });

  it('한쪽이 비어 있으면 아직 판정하지 않는다', () => {
    expect(isCoverageOutOfOrder({ from: NINE, to: '' })).toBe(false);
    expect(isCoverageOutOfOrder({ from: '', to: NINE })).toBe(false);
  });

  it('offset 이 다르면 판정하지 않는다 — 견줄 수 없는 것을 견주면 틀린 경고가 뜬다', () => {
    expect(
      isCoverageOutOfOrder({ from: '2026-08-27T11:00:00+09:00', to: '2026-08-27T09:00:00Z' }),
    ).toBe(false);
  });

  it('판정이 값을 바꾸지 않는다 — 조용히 뒤집어 고치지 않는다', () => {
    const draft = { from: ELEVEN, to: NINE };

    isCoverageOutOfOrder(draft);

    expect(draft).toEqual({ from: ELEVEN, to: NINE });
  });
});

describe('toCoverageBody — 빈 칸은 키 자체를 싣지 않는다', () => {
  it('둘 다 있으면 둘 다 싣는다', () => {
    expect(toCoverageBody({ from: NINE, to: ELEVEN })).toEqual({
      coverageFromAt: NINE,
      coverageToAt: ELEVEN,
    });
  });

  it('빈 칸은 키가 없다 — 빈 문자열을 보내면 서버가 형식 오류로 되돌린다', () => {
    expect(toCoverageBody(EMPTY_COVERAGE_DRAFT)).toEqual({});
    expect(Object.keys(toCoverageBody({ from: NINE, to: '' }))).toEqual(['coverageFromAt']);
  });
});
