import { describe, expect, it } from 'vitest';

import { byRecentFirst, toCalibrationView, type CalibrationView } from './types';

const view = (overrides: Partial<CalibrationView> = {}): CalibrationView => ({
  calibrationId: 9001,
  equipmentId: 8101,
  equipmentCode: 'SYN-GAUGE-01',
  historyTypeCode: 'CALIBRATION',
  performedOn: '2026-08-11',
  resultCode: 'PASS',
  certificateNo: null,
  agencyTypeCode: null,
  agencyName: null,
  nextDueOn: null,
  toleranceNote: null,
  performedByUserId: null,
  remarks: null,
  ...overrides,
});

describe('toCalibrationView', () => {
  it('오지 않은 칸을 0이나 빈 글자가 아니라 null로 눕힌다', () => {
    const converted = toCalibrationView({
      calibrationId: 9001,
      equipmentId: 8101,
      equipmentCode: 'SYN-GAUGE-01',
      historyTypeCode: 'CALIBRATION',
      performedOn: '2026-08-11',
      resultCode: 'PASS',
      recordedByUserId: 8201,
      blocksUse: false,
    });

    expect(converted).toMatchObject({
      certificateNo: null,
      agencyName: null,
      nextDueOn: null,
      remarks: null,
    });
  });
});

describe('byRecentFirst', () => {
  it('실시일 내림차순으로 세운다', () => {
    const rows = byRecentFirst([
      view({ calibrationId: 1, performedOn: '2026-08-01' }),
      view({ calibrationId: 2, performedOn: '2026-08-11' }),
    ]);

    expect(rows.map((row) => row.calibrationId)).toEqual([2, 1]);
  });

  /**
   * ⭐ 잘못 적은 이력은 **정정 이력을 덧붙여** 바로잡는다. 같은 날 나중에 넣은 것이 아래에
   * 묻히면 덧붙인 뜻이 사라진다 — 읽는 사람이 먼저 만나는 것이 옛 값이 된다.
   */
  it('같은 날이면 나중에 넣은 것이 위다', () => {
    const rows = byRecentFirst([
      view({ calibrationId: 10, performedOn: '2026-08-11' }),
      view({ calibrationId: 11, performedOn: '2026-08-11' }),
    ]);

    expect(rows.map((row) => row.calibrationId)).toEqual([11, 10]);
  });

  it('원본 배열을 제자리에서 바꾸지 않는다 — 캐시가 준 차례가 다른 소비처에서 흔들린다', () => {
    const source = [
      view({ calibrationId: 1, performedOn: '2026-08-01' }),
      view({ calibrationId: 2, performedOn: '2026-08-11' }),
    ];

    byRecentFirst(source);

    expect(source.map((row) => row.calibrationId)).toEqual([1, 2]);
  });
});
