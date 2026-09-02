import { describe, expect, it } from 'vitest';

import {
  dueAxisLabel,
  formatCount,
  formatRatio,
  isOverLimit,
  toMoldView,
  toProgressValue,
  type MoldView,
} from './types';

const view = (overrides: Partial<MoldView> = {}): MoldView => ({
  moldId: 8101,
  moldCode: 'SYN-MLD-01',
  moldName: '합성 금형 가',
  currentShotCount: 12000,
  guaranteedShotCount: 10000,
  availableShotCount: -2000,
  shotUsageRatio: 120,
  nextPmDate: '2026-09-01',
  pmDue: true,
  pmDueAxisCode: 'SHOT',
  ...overrides,
});

describe('toMoldView', () => {
  /** ⛔ 적정타수가 없으면 초과율·사용 가능이 「낼 수 없다」다 — 0이 아니다. */
  it('오지 않은 칸을 0이 아니라 null로 눕힌다', () => {
    const converted = toMoldView({
      moldId: 8101,
      plantId: 1,
      moldCode: 'SYN-MLD-01',
      moldName: '합성 금형 가',
      toolTypeCode: 'SYN-TYPE',
      cavityCount: 1,
      currentShotCount: 5000,
      statusCode: 'IN_SERVICE',
      isActive: true,
      pmTriggerTypeCode: 'SHOT',
      pmDue: false,
    });

    expect(converted).toMatchObject({
      guaranteedShotCount: null,
      availableShotCount: null,
      shotUsageRatio: null,
      nextPmDate: null,
      pmDueAxisCode: null,
    });
  });
});

describe('formatRatio · formatCount', () => {
  it('천 단위를 끊는다', () => {
    expect(formatCount(12000)).toBe('12,000');
  });

  it('소수 첫째 자리까지 내고 끝자리 0은 뗀다', () => {
    expect(formatRatio(120)).toBe('120');
    expect(formatRatio(87.25)).toBe('87.3');
  });
});

describe('isOverLimit · toProgressValue', () => {
  it('100을 넘으면 초과다', () => {
    expect(isOverLimit(120)).toBe(true);
    expect(isOverLimit(100)).toBe(false);
  });

  /** ⭐ `null`은 초과가 아니라 **모름**이다. 초과로 읽으면 멀쩡한 툴이 붉게 선다. */
  it('모르는 값은 초과가 아니다', () => {
    expect(isOverLimit(null)).toBe(false);
  });

  /** ⭐ 막대가 칸 밖으로 자라면 다른 줄과 견줄 수 없다 — 100에서 멈춘다. */
  it('진행 표시는 100에서 멈춘다', () => {
    expect(toProgressValue(250)).toBe(100);
    expect(toProgressValue(87.5)).toBe(87.5);
  });

  it('음수는 0으로 눕힌다', () => {
    expect(toProgressValue(-5)).toBe(0);
  });

  it('모르는 값은 0이다 — 막대를 그리지 않는 쪽은 화면이 정한다', () => {
    expect(toProgressValue(null)).toBe(0);
  });
});

describe('dueAxisLabel', () => {
  it('도래하지 않았으면 그렇게 말한다', () => {
    expect(dueAxisLabel(view({ pmDue: false, pmDueAxisCode: null }))).toBe('도래하지 않음');
  });

  /** ⭐ 둘 다 쓰는 툴이 있어 화면이 추측하면 틀린 사유를 적는다 — 서버가 밝힌 축을 그대로 쓴다. */
  it('서버가 밝힌 축을 그대로 옮긴다', () => {
    expect(dueAxisLabel(view({ pmDueAxisCode: 'SHOT' }))).toBe('타발수 도달');
    expect(dueAxisLabel(view({ pmDueAxisCode: 'DATE' }))).toBe('날짜 도달');
  });

  it('도래했는데 축이 오지 않으면 지어내지 않는다', () => {
    expect(dueAxisLabel(view({ pmDueAxisCode: null }))).toBe('—');
  });
});
