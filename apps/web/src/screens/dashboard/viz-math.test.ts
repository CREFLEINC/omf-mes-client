import { describe, expect, it } from 'vitest';

import { toLineSegments, toParetoRows, toRateDomain, toShareRows } from './viz-math';

const entries = [
  { key: 'a', label: 'A', value: 50 },
  { key: 'b', label: 'B', value: 30 },
  { key: 'c', label: 'C', value: 15 },
  { key: 'd', label: 'D', value: 5 },
];

describe('그림 계산', () => {
  it('순위 막대 — 받은 순서를 지키고 비중과 1위 대비 길이를 낸다', () => {
    const rows = toShareRows(entries);

    expect(rows.map((row) => row.key)).toEqual(['a', 'b', 'c', 'd']);
    expect(rows.map((row) => row.share)).toEqual([50, 30, 15, 5]);
    expect(rows[1]?.length).toBe(60);
  });

  it('합이 0이면 비중 · 길이 모두 0 — 나눗셈으로 NaN 을 그리지 않는다', () => {
    expect(toShareRows([{ key: 'a', label: 'A', value: 0 }])[0]).toMatchObject({
      share: 0,
      length: 0,
    });
  });

  it('파레토 — 누적 비율과, 누적 80%에 닿는 줄까지를 핵심으로 표시한다', () => {
    const rows = toParetoRows(entries);

    expect(rows.map((row) => row.cumulative)).toEqual([50, 80, 95, 100]);
    expect(rows.map((row) => row.vital)).toEqual([true, true, false, false]);
  });

  it('파레토 — 80%를 넘기는 첫 줄도 핵심에 든다', () => {
    const rows = toParetoRows([
      { key: 'a', label: 'A', value: 70 },
      { key: 'b', label: 'B', value: 20 },
      { key: 'c', label: 'C', value: 10 },
    ]);

    expect(rows.map((row) => row.vital)).toEqual([true, true, false]);
  });

  it('꺾은선 — 값이 없는 날에서 선을 끊는다', () => {
    const segments = toLineSegments([
      { label: '1', value: 95 },
      { label: '2', value: 96 },
      { label: '3', value: null },
      { label: '4', value: 97 },
    ]);

    expect(segments).toEqual([
      [
        { index: 0, value: 95 },
        { index: 1, value: 96 },
      ],
      [{ index: 3, value: 97 }],
    ]);
  });

  it('합격률 축 — 값 둘레로 좁히되 0~100 을 넘지 않고, 값이 없으면 0~100', () => {
    expect(toRateDomain([null, null])).toEqual({ min: 0, max: 100 });
    const domain = toRateDomain([95, 99, null]);
    expect(domain.min).toBeLessThan(95);
    expect(domain.max).toBeLessThanOrEqual(100);
  });
});
