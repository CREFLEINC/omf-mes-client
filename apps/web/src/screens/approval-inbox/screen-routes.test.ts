import { describe, expect, it } from 'vitest';

import { SCREEN_ROUTES, screenPathOf } from './screen-routes';

describe('화면 ID 매핑표', () => {
  it('지금은 비어 있다 — 그것이 이 회차의 사실이다', () => {
    expect(Object.keys(SCREEN_ROUTES)).toHaveLength(0);
  });

  it('표에 없는 화면 ID는 경로가 없다', () => {
    expect(screenPathOf('W-99-99', SCREEN_ROUTES)).toBeNull();
  });

  it('표에 줄이 생기면 그 경로가 나온다 — 자리표시가 죽은 가지가 아니다', () => {
    /* 전환 감지기: 매핑표를 채우는 것만으로 열기가 살아나야 한다(계획 M28). */
    expect(screenPathOf('W-99-99', { 'W-99-99': '/synthetic/target' })).toBe('/synthetic/target');
  });

  it('빈 화면 ID는 표를 뒤지지 않는다 — 빈 열쇠에 값이 실린 표도 통하지 않는다', () => {
    expect(screenPathOf('', { '': '/synthetic/empty-key' })).toBeNull();
  });
});
