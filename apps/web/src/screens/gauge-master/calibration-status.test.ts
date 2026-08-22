import { describe, expect, it } from 'vitest';

import { judgeCalibration } from './calibration-status';

const make = (overrides: Partial<Parameters<typeof judgeCalibration>[0]> = {}) => ({
  calibrationRequired: true,
  lastCalibrationDate: '2026-01-10',
  calibrationDueDate: '2026-08-25',
  ...overrides,
});

describe('judgeCalibration', () => {
  /*
   * ⛔ 「대상 아님」은 «정상»이다 — 채워야 할 것이 아니다.
   * 대상이 아니면 검교정일이 있든 없든 그 사실이 먼저다.
   */
  it('대상이 아니면 날짜를 보지 않는다', () => {
    expect(judgeCalibration(make({ calibrationRequired: false }), '2026-08-22')).toEqual({
      status: 'notRequired',
      days: null,
    });
    expect(
      judgeCalibration(
        make({ calibrationRequired: false, lastCalibrationDate: null, calibrationDueDate: null }),
        '2026-08-22',
      ).status,
    ).toBe('notRequired');
  });

  /*
   * ⛔ 「아직 안 함」과 「대상 아님」은 다른 것이다 — 앞은 채워야 할 것이고 뒤는 정상이다.
   * 판정이 둘을 같은 값으로 내면 화면이 그것을 같은 모양으로 그릴 수밖에 없다.
   */
  it.each([null, undefined, ''])('대상인데 검교정일이 %s 면 「아직 안 함」이다', (last) => {
    const judged = judgeCalibration(make({ lastCalibrationDate: last }), '2026-08-22');

    expect(judged.status).toBe('never');
    expect(judged.status).not.toBe('notRequired');
  });

  it('예정일이 오늘보다 뒤면 유효이고 남은 날을 함께 낸다', () => {
    expect(judgeCalibration(make({ calibrationDueDate: '2026-08-25' }), '2026-08-22')).toEqual({
      status: 'valid',
      days: 3,
    });
  });

  /* 같은 날은 아직 유효하다 — 하루를 잘못 세면 멀쩡한 계측기가 게이트에 막힌다. */
  it('예정일이 오늘과 같으면 아직 유효하다', () => {
    expect(judgeCalibration(make({ calibrationDueDate: '2026-08-22' }), '2026-08-22')).toEqual({
      status: 'valid',
      days: 0,
    });
  });

  it('예정일이 오늘보다 앞이면 만료이고 지난 날을 함께 낸다', () => {
    expect(judgeCalibration(make({ calibrationDueDate: '2026-08-19' }), '2026-08-22')).toEqual({
      status: 'expired',
      days: 3,
    });
  });

  /* ⛔ 음수를 쓰지 않는다 — 「-3일 남음」이 아니라 「3일 경과」로 말한다. */
  it('만료의 날수는 양수다', () => {
    expect(judgeCalibration(make({ calibrationDueDate: '2026-01-01' }), '2026-08-22').days).toBe(
      233,
    );
  });

  /*
   * ⚠ 한 적은 있는데 예정일이 없으면 **유효한지 모르는** 것이다.
   * 모르는 것을 정상으로 그리면 게이트의 근거가 조용히 썩는다(G-9).
   */
  it.each([null, undefined, '', '알 수 없는 날짜'])(
    '검교정은 했는데 예정일이 %s 면 정상으로 그리지 않는다',
    (due) => {
      const judged = judgeCalibration(make({ calibrationDueDate: due }), '2026-08-22');

      expect(judged.status).not.toBe('valid');
      expect(judged.status).toBe('never');
    },
  );

  /*
   * ⭐ **오늘을 인자로 받는다.** 함수 안에서 읽으면 시험이 날짜에 흔들리고, 자정을 넘기는
   * 순간 같은 입력이 다른 답을 낸다.
   */
  it('같은 입력에 오늘만 달라지면 판정이 뒤집힌다', () => {
    const gauge = make({ calibrationDueDate: '2026-08-22' });

    expect(judgeCalibration(gauge, '2026-08-22').status).toBe('valid');
    expect(judgeCalibration(gauge, '2026-08-23').status).toBe('expired');
  });

  /* 날짜만 견준다 — 시각이 섞이면 같은 날이 만료로 뒤집힌다. */
  it('해를 넘겨도 날수를 바르게 센다', () => {
    expect(judgeCalibration(make({ calibrationDueDate: '2027-01-01' }), '2026-12-31').days).toBe(1);
  });
});
