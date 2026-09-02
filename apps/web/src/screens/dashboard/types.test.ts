import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { formatAsOf, formatFigure, toChartMax, toDashboardView } from './types';

/**
 * 「틀려도 조용한 것」만 감지기를 붙인다 — 화면은 멀쩡히 서 있는데 값만 틀리는 계산이다.
 * 렌더 배선·문구·목록 표시는 브라우저 육안 확인으로 갈음한다(마감 국면 검증 배분).
 */

describe('formatFigure', () => {
  it('천 단위를 끊는다', () => {
    expect(formatFigure(12480)).toBe('12,480');
    expect(formatFigure(1234567)).toBe('1,234,567');
    expect(formatFigure(999)).toBe('999');
  });

  it('소수 첫째 자리까지만 낸다', () => {
    expect(formatFigure(97.24)).toBe('97.2');
    expect(formatFigure(97.25)).toBe('97.3');
  });

  it('끝자리가 0이면 소수점을 떼고 정수로 낸다 — 잰 정밀도를 잘못 말하지 않는다', () => {
    expect(formatFigure(12479.96)).toBe('12,480');
    expect(formatFigure(88)).toBe('88');
  });

  it('음수의 부호를 자리 구분보다 앞에 둔다', () => {
    expect(formatFigure(-12480)).toBe('-12,480');
    expect(formatFigure(-0.8)).toBe('-0.8');
  });

  it('0은 0이다', () => {
    expect(formatFigure(0)).toBe('0');
  });
});

describe('formatAsOf', () => {
  it('서버가 준 벽시계를 옮기지 않고 자른다 — 보는 사람의 시간대로 바꾸지 않는다', () => {
    expect(formatAsOf('2026-08-24T09:12:00+09:00')).toBe('2026-08-24 09:12');
  });

  it('시간대 표기가 달라도 같은 자리를 자른다', () => {
    expect(formatAsOf('2026-08-24T09:12:00Z')).toBe('2026-08-24 09:12');
  });

  it('알아볼 수 없는 값은 null이다 — 그럴듯하게 잘라 내면 틀린 시각이 조용히 선다', () => {
    expect(formatAsOf('2026-08-24')).toBeNull();
    expect(formatAsOf('')).toBeNull();
    expect(formatAsOf(undefined)).toBeNull();
    expect(formatAsOf(null)).toBeNull();
  });
});

describe('toChartMax', () => {
  const points = [
    { label: '08-10', value: 2400 },
    { label: '08-11', value: 2850 },
  ];

  /**
   * ⭐ 브라우저 확인이 잡은 자리 — 차트는 상한을 주지 않으면 데이터 최대값을 상한으로 잡아,
   * 목표선이 그림 밖으로 나가 **그어지지 않는다.** 「목표선이 없는 그래프」로 보이고, 하필
   * 목표를 못 채운 날일수록 그렇게 된다.
   */
  it('목표가 실적보다 높으면 눈금을 목표까지 넓힌다', () => {
    expect(toChartMax(points, 3000)).toBe(3000);
  });

  it('목표가 실적 안쪽이면 차트의 자동 계산에 맡긴다', () => {
    expect(toChartMax(points, 2000)).toBeUndefined();
    expect(toChartMax(points, 2850)).toBeUndefined();
  });

  it('목표가 없으면 넓히지 않는다', () => {
    expect(toChartMax(points, null)).toBeUndefined();
  });

  it('점이 없으면 넓히지 않는다 — 그릴 것이 없다', () => {
    expect(toChartMax([], 3000)).toBeUndefined();
  });
});

type DashboardSummary = components['schemas']['DashboardSummary'];

const summary = (overrides: Partial<DashboardSummary> = {}): DashboardSummary => ({
  baseDate: '2026-08-24',
  cards: [],
  asOf: '2026-08-24T09:12:00+09:00',
  ...overrides,
});

describe('toDashboardView', () => {
  it('추이가 오지 않으면 null이다 — 빈 그래프로 그리면 「생산이 0이었다」로 읽힌다', () => {
    expect(toDashboardView(summary()).trend).toBeNull();
  });

  it('추이가 점 없이 오면 빈 배열이다 — 「오지 않았다」와 다른 사실이다', () => {
    const view = toDashboardView(
      summary({ trend: { points: [], asOf: '2026-08-24T09:12:00+09:00' } }),
    );

    expect(view.trend?.points).toEqual([]);
  });

  it('목표가 없으면 null이다 — 0으로 채우면 바닥에 목표선이 그어진다', () => {
    const view = toDashboardView(
      summary({
        trend: {
          points: [{ label: '08-24', value: 10 }],
          asOf: '2026-08-24T09:12:00+09:00',
        },
      }),
    );

    expect(view.trend?.targetValue).toBeNull();
  });

  it('카드의 빈 칸을 0이 아니라 null로 눕힌다', () => {
    const view = toDashboardView(
      summary({
        cards: [
          { cardCode: 'SAMPLE_A', label: '합성 지표 가', value: 12, valueStatusCode: 'AVAILABLE' },
        ],
      }),
    );

    expect(view.cards[0]).toMatchObject({
      unit: null,
      deltaRatio: null,
      note: null,
      excludedCount: null,
    });
  });

  it('알람이 오지 않으면 빈 배열이다 — 구획이 없는 것이 아니라 건이 없는 것이다', () => {
    expect(toDashboardView(summary()).alerts).toEqual([]);
  });
});
