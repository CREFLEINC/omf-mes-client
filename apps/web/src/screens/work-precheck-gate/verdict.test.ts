import { describe, expect, it } from 'vitest';

import { decide, type PrecheckTarget } from './verdict';

const passed = (inspectionId: number): PrecheckTarget => ({
  inspectionTypeCode: 'DAILY',
  windowFrom: '2026-09-04',
  latest: {
    inspectionId,
    inspectedAt: '2026-09-04T08:00:00+09:00',
    overallResultCode: 'PASS',
    workerNo: '3391',
  },
});

const failed = (inspectionId: number): PrecheckTarget => ({
  ...passed(inspectionId),
  latest: { ...passed(inspectionId).latest!, overallResultCode: 'FAIL' },
});

const missing: PrecheckTarget = {
  inspectionTypeCode: 'MONTHLY',
  windowFrom: '2026-09-01',
  latest: null,
};

describe('decide', () => {
  it('주기 내 이력이 전부 합격이면 통과이고 게이트가 뜨지 않는다', () => {
    const verdict = decide({ controlLevel: 'BLOCK', isEmergency: false, targets: [passed(11)] });

    expect(verdict.decisionCode).toBe('PASSED');
    expect(verdict.isGateShown).toBe(false);
    expect(verdict.canProceed).toBe(true);
    expect(verdict.basisInspectionId).toBe(11);
  });

  it('점검 대상이 아니면 통과다', () => {
    const verdict = decide({ controlLevel: 'BLOCK', isEmergency: false, targets: [] });

    expect(verdict.decisionCode).toBe('PASSED');
    expect(verdict.basisInspectionId).toBeNull();
  });

  it('NG 는 통제 수준이 미적용이어도 차단한다', () => {
    const verdict = decide({ controlLevel: 'OFF', isEmergency: false, targets: [failed(21)] });

    expect(verdict.decisionCode).toBe('BLOCKED');
    expect(verdict.reason).toBe('failed');
    expect(verdict.canProceed).toBe(false);
    /* 무엇을 보고 막았는지 남긴다. */
    expect(verdict.basisInspectionId).toBe(21);
  });

  it('NG 는 긴급 작업지시여도 우회할 수 없다', () => {
    const verdict = decide({ controlLevel: 'BLOCK', isEmergency: true, targets: [failed(21)] });

    expect(verdict.canOverride).toBe(false);
  });

  it('이력이 없고 통제 수준이 차단이면 막는다', () => {
    const verdict = decide({ controlLevel: 'BLOCK', isEmergency: false, targets: [missing] });

    expect(verdict.decisionCode).toBe('BLOCKED');
    expect(verdict.reason).toBe('missing');
    expect(verdict.canProceed).toBe(false);
    expect(verdict.canOverride).toBe(false);
    /* ⚠ 근거로 삼은 점검이 없다 — 0 으로 채우지 않는다. */
    expect(verdict.basisInspectionId).toBeNull();
  });

  it('이력이 없고 긴급 작업지시면 우회가 열린다', () => {
    const verdict = decide({ controlLevel: 'BLOCK', isEmergency: true, targets: [missing] });

    expect(verdict.canOverride).toBe(true);
  });

  it('이력이 없고 통제 수준이 경고면 진행할 수 있다', () => {
    const verdict = decide({ controlLevel: 'WARN', isEmergency: false, targets: [missing] });

    expect(verdict.decisionCode).toBe('WARNED');
    expect(verdict.isGateShown).toBe(true);
    expect(verdict.canProceed).toBe(true);
  });

  it('이력이 없고 통제 수준이 미적용이면 통과다', () => {
    const verdict = decide({ controlLevel: 'OFF', isEmergency: false, targets: [missing] });

    expect(verdict.decisionCode).toBe('PASSED');
    expect(verdict.isGateShown).toBe(false);
  });

  it('한 유형이라도 NG 면 다른 유형이 합격이어도 차단한다', () => {
    const verdict = decide({
      controlLevel: 'OFF',
      isEmergency: true,
      targets: [passed(11), failed(21)],
    });

    expect(verdict.decisionCode).toBe('BLOCKED');
    expect(verdict.reason).toBe('failed');
  });

  it('이력 없음과 합격이 섞이면 이력 없음으로 판정한다', () => {
    const verdict = decide({
      controlLevel: 'WARN',
      isEmergency: false,
      targets: [passed(11), missing],
    });

    expect(verdict.decisionCode).toBe('WARNED');
    expect(verdict.reason).toBe('missing');
  });
});
