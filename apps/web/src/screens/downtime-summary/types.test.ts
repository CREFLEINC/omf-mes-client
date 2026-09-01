import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import {
  formatCount,
  formatDecimal,
  formatDuration,
  formatMoment,
  toDistributionRows,
  toSummaryView,
} from './types';

describe('formatCount', () => {
  it('천 단위를 끊는다', () => {
    expect(formatCount(105600)).toBe('105,600');
    expect(formatCount(999)).toBe('999');
  });

  it('소수는 정수로 접는다 — 분·건수는 소수로 세지 않는다', () => {
    expect(formatCount(74.6)).toBe('75');
  });
});

describe('formatDecimal', () => {
  it('소수 첫째 자리까지 낸다', () => {
    expect(formatDecimal(92.74)).toBe('92.7');
    expect(formatDecimal(92.75)).toBe('92.8');
  });

  it('끝자리가 0이면 소수점을 뗀다 — 「40.0%」는 잰 정밀도를 잘못 말한다', () => {
    expect(formatDecimal(40)).toBe('40');
    expect(formatDecimal(40.04)).toBe('40');
  });
});

describe('formatDuration', () => {
  it('분을 시간과 분으로 읽어 준다', () => {
    expect(formatDuration(7680)).toBe('128시간');
    expect(formatDuration(125)).toBe('2시간 5분');
  });

  /** 「0시간 32분」은 시간 칸이 있다는 오해를 준다. */
  it('한 시간이 안 되면 시간 부분을 만들지 않는다', () => {
    expect(formatDuration(32)).toBe('32분');
    expect(formatDuration(0)).toBe('0분');
  });
});

describe('formatMoment', () => {
  it('서버가 준 벽시계를 옮기지 않고 자른다', () => {
    expect(formatMoment('2026-08-18T09:40:00+07:00')).toBe('2026-08-18 09:40');
  });

  it('알아볼 수 없으면 원문을 그대로 낸다 — 감추면 되짚을 단서가 사라진다', () => {
    expect(formatMoment('SYN-UNKNOWN')).toBe('SYN-UNKNOWN');
  });
});

type DowntimeSummary = components['schemas']['DowntimeSummary'];

const summary = (overrides: Partial<DowntimeSummary> = {}): DowntimeSummary => ({
  operatingMinutes: 1000,
  actualDowntimeMinutes: 100,
  openIntervalCount: 0,
  overlappingIntervalCount: 0,
  ...overrides,
});

describe('toDistributionRows', () => {
  /**
   * ⭐ 서버는 요청한 묶음 축의 배열 **하나만** 채운다. 셋을 합치면 직전 탭의 줄이 남아
   * 새 탭에 섞이고, 사용자는 사유 탭에서 설비 이름을 보게 된다.
   */
  it('지금 탭의 배열만 읽는다', () => {
    const source = summary({
      byReason: [{ reasonCode: 'SAMPLE_R', count: 1, totalMinutes: 10 }],
      byEquipment: [{ equipmentId: 8101, equipmentCode: 'SYN-EQ-01', count: 2, totalMinutes: 20 }],
    });

    expect(toDistributionRows(source, 'REASON')).toHaveLength(1);
    expect(toDistributionRows(source, 'REASON')[0]?.label).toBe('SAMPLE_R');
    expect(toDistributionRows(source, 'EQUIPMENT')[0]?.label).toBe('SYN-EQ-01');
  });

  it('배열이 오지 않으면 빈 표다 — 다른 탭의 줄로 채우지 않는다', () => {
    expect(toDistributionRows(summary(), 'PERIOD')).toEqual([]);
  });

  it('사유 이름이 없으면 코드를 그대로 보인다 — 「이름 없음」은 전할 단서를 지운다', () => {
    const rows = toDistributionRows(
      summary({
        byReason: [{ reasonCode: 'SAMPLE_R', reasonName: '', count: 1, totalMinutes: 10 }],
      }),
      'REASON',
    );

    expect(rows[0]?.label).toBe('SAMPLE_R');
  });

  it('설비 이름이 있으면 코드와 함께 보인다', () => {
    const rows = toDistributionRows(
      summary({
        byEquipment: [
          {
            equipmentId: 8101,
            equipmentCode: 'SYN-EQ-01',
            equipmentName: '합성 설비 가',
            count: 1,
            totalMinutes: 10,
          },
        ],
      }),
      'EQUIPMENT',
    );

    expect(rows[0]?.label).toBe('SYN-EQ-01 · 합성 설비 가');
  });

  it('추이 칸에는 평균·비중이 없다 — 만들어 내지 않는다', () => {
    const rows = toDistributionRows(
      summary({ byPeriod: [{ periodStart: '2026-08-01', count: 9, totalMinutes: 640 }] }),
      'PERIOD',
    );

    expect(rows[0]).toMatchObject({ averageMinutes: null, sharePercent: null });
  });
});

describe('toSummaryView', () => {
  /** ⛔ 조업 시간이 0이면 0%가 아니라 「낼 수 없다」다. 0%는 「하루 종일 섰다」로 읽힌다. */
  it('가동률이 오지 않으면 null이다 — 0으로 채우지 않는다', () => {
    expect(toSummaryView(summary(), 'REASON').availabilityPercent).toBeNull();
  });

  it('경미 정지 임계를 지어내지 않는다 — 오지 않으면 null이다', () => {
    expect(toSummaryView(summary(), 'REASON').minorStopThresholdMinutes).toBeNull();
  });

  it('응답이 준 임계를 그대로 나른다', () => {
    expect(
      toSummaryView(summary({ minorStopThresholdMinutes: 3 }), 'REASON').minorStopThresholdMinutes,
    ).toBe(3);
  });

  it('계획 비가동이 오지 않으면 null이다 — 이 조회가 만드는 값이 아니다', () => {
    expect(toSummaryView(summary(), 'REASON').plannedDowntimeMinutes).toBeNull();
  });

  it('빠진 구간·겹친 구간 건수는 필수라 그대로 실린다', () => {
    const view = toSummaryView(
      summary({ openIntervalCount: 3, overlappingIntervalCount: 2 }),
      'REASON',
    );

    expect(view).toMatchObject({ openIntervalCount: 3, overlappingIntervalCount: 2 });
  });
});
