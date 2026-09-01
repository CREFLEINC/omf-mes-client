import { describe, expect, it } from 'vitest';

import { CARD_ROUTES, cardPathOf, type CardRouteTable } from './card-routes';

const axes = (search: string): URLSearchParams => new URLSearchParams(search);

describe('CARD_ROUTES', () => {
  /**
   * 자리표시가 비어 있는 것이 지금 맞다 — 계약이 지표 코드를 값 목록 없이 두었고 예시조차
   * 싣지 않았다. 이 감지기는 「코드를 지어 채웠는가」를 묻는다.
   */
  it('지표 코드가 확정되기 전까지 비어 있다', () => {
    expect(Object.keys(CARD_ROUTES)).toEqual([]);
  });
});

describe('cardPathOf', () => {
  const routes: CardRouteTable = { SAMPLE_METRIC: '/equipment/sample' };

  it('표에 없는 코드는 null이다 — 없음을 값으로 낸다', () => {
    expect(cardPathOf('SAMPLE_UNKNOWN', axes(''), routes)).toBeNull();
  });

  /** 빈 코드로 표를 뒤지면 표에 실수로 들어간 빈 열쇠가 아무 카드나 열게 된다. */
  it('빈 코드는 표를 뒤지지 않는다', () => {
    expect(cardPathOf('', axes(''), { '': '/somewhere' })).toBeNull();
  });

  it('줄이 생기면 그것만으로 열기가 산다', () => {
    expect(cardPathOf('SAMPLE_METRIC', axes(''), routes)).toBe('/equipment/sample');
  });

  it('기준 축을 주소에 실어 넘긴다', () => {
    expect(cardPathOf('SAMPLE_METRIC', axes('baseDate=2026-08-24'), routes)).toBe(
      '/equipment/sample?baseDate=2026-08-24',
    );
  });
});
