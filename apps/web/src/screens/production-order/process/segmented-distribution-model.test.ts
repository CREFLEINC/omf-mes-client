import { describe, expect, it } from 'vitest';
import {
  expandSegment,
  previewSegments,
  type DistributionSegment,
  type DistributionTarget,
} from './segmented-distribution-model';
const targets: DistributionTarget[] = [
  {
    id: 'A',
    label: '오더 A / 품목 A',
    unit: 'EA',
    pending: 120,
    lines: [
      { id: 1, code: 'L1', name: '라인 1' },
      { id: 2, code: 'L2', name: '라인 2' },
    ],
  },
  {
    id: 'B',
    label: '오더 B / 품목 B',
    unit: 'KG',
    pending: 20.5,
    lines: [{ id: 2, code: 'L2', name: '라인 2' }],
  },
];
const segment = (patch: Partial<DistributionSegment> = {}): DistributionSegment => ({
  id: '1',
  owner: 'A',
  start: '2026-11-02',
  end: '2026-11-04',
  lineId: '1',
  mode: 'equal',
  quantity: '10',
  daily: {},
  ...patch,
});
describe('오더별 다중 구간 분배', () => {
  it('정수 균등 배분은 나머지를 앞 날짜에 배정하며 총수량을 보존한다', () =>
    expect(expandSegment(segment()).map((row) => row.quantity)).toEqual(['4', '3', '3']));
  it('소수 수량은 입력 자릿수로 배분한다', () =>
    expect(expandSegment(segment({ quantity: '1.0' })).map((row) => row.quantity)).toEqual([
      '1',
      '0',
      '0',
    ]));
  it('서로 다른 오더의 기간·라인·날짜별 수량과 단위를 독립적으로 처리한다', () => {
    const result = previewSegments(
      targets,
      [
        segment({ quantity: '100' }),
        segment({
          id: '2',
          owner: 'A',
          lineId: '2',
          start: '2026-11-05',
          end: '2026-11-06',
          mode: 'daily',
          daily: { '2026-11-05': '5', '2026-11-06': '15' },
        }),
        segment({
          id: '3',
          owner: 'B',
          lineId: '2',
          start: '2026-11-03',
          end: '2026-11-03',
          quantity: '20.5',
        }),
      ],
      [],
    );
    expect(result.orders.map((order) => [order.added, order.pending])).toEqual([
      [120, 0],
      [20.5, 0],
    ]);
    expect(result.drafts.find((row) => row.owner === 'B')).toMatchObject({
      planDate: '2026-11-03',
      plannedLineId: '2',
      plannedQty: '20.5',
    });
    expect(result.totals.map((row) => row.unit)).toContain('KG');
  });
  it('오더별 구간 합계가 편성 대기를 넘으면 전체 미리보기를 거부한다', () =>
    expect(() =>
      previewSegments(
        targets,
        [segment({ quantity: '100' }), segment({ id: '2', quantity: '21' })],
        [],
      ),
    ).toThrow('초과'));
  it('동일 오더·날짜·라인은 한 행으로 합산하고 기존 편성과 중복되는 셀을 알린다', () => {
    const result = previewSegments(
      targets,
      [
        segment({ end: '2026-11-02', quantity: '10' }),
        segment({ id: '2', end: '2026-11-02', quantity: '20' }),
      ],
      [{ owner: 'A', planDate: '2026-11-02', plannedLineId: '1', plannedQty: '5' }],
    );
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.plannedQty).toBe('30');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.totals[0]).toMatchObject({ existing: 5, added: 30 });
  });
  it('적용한 조건은 재실행으로 중복 추가하지 않는다', () =>
    expect(() => previewSegments(targets, [segment({ applied: true })], [])).toThrow('새 구간'));
  it.each([
    { lineId: '404' },
    { owner: '404' },
    { start: '2026-02-30' },
    { quantity: '-1' },
    { quantity: '1.0000001' },
    { mode: 'daily' as const, daily: { '2026-11-02': 'bad' } },
  ])('잘못된 조건을 거부한다: %j', (patch) =>
    expect(() => previewSegments(targets, [segment(patch)], [])).toThrow(),
  );
  it('직접 입력은 현재 기간의 날짜만 합산하며 0인 날짜는 생성하지 않는다', () => {
    const result = previewSegments(
      targets,
      [
        segment({
          mode: 'daily',
          daily: { '2026-11-02': '1', '2026-11-03': '0', '2026-11-04': '2', '2026-11-05': '1000' },
        }),
      ],
      [],
    );
    expect(result.drafts.map((row) => row.plannedQty)).toEqual(['1', '2']);
    expect(result.orders[0]?.added).toBe(3);
  });
  it('단위 소수 자릿수로 균등 배분하고 허용되지 않은 소수 입력을 거부한다', () => {
    expect(expandSegment(segment({ quantity: '1' }), 1).map((row) => row.quantity)).toEqual([
      '0.4',
      '0.3',
      '0.3',
    ]);
    expect(() => expandSegment(segment({ quantity: '1.5' }), 0)).toThrow('소수 0자리');
  });
  it('새 구간끼리 겹치는 셀은 합산하고 확인 메시지를 제공한다', () => {
    const result = previewSegments(
      targets,
      [segment({ end: '2026-11-02' }), segment({ id: '2', end: '2026-11-02' })],
      [],
    );
    expect(result.drafts).toHaveLength(1);
    expect(result.warnings.join('')).toContain('합산');
  });
});
