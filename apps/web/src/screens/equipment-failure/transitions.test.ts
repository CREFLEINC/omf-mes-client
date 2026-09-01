import { describe, expect, it } from 'vitest';

import {
  completeLockReason,
  openDowntimeWarning,
  saveLockReason,
  startHandlingLockReason,
} from './transitions';
import { DONE_STATUS, HANDLING_STATUS, RECEIVED_STATUS, type BreakdownDetailView } from './types';

const detail = (overrides: Partial<BreakdownDetailView> = {}): BreakdownDetailView => ({
  breakdownId: 9001,
  breakdownNo: 'SYN-BD-0001',
  equipmentId: 8101,
  equipmentCode: 'SYN-EQ-01',
  symptom: '합성 증상',
  occurrenceStateCode: 'STOPPED',
  stoppedAt: null,
  reportedAt: '2026-08-18T09:40:00+09:00',
  reporterWorkerNo: 'SYN-W-01',
  statusCode: RECEIVED_STATUS,
  handling: { causeCode: null, handlingNote: null, handledAt: null, maintenanceOrderId: null },
  linkedDowntimeCount: 0,
  linkedDowntimeMinutes: 0,
  openLinkedDowntimeCount: 0,
  attachmentCount: 0,
  ...overrides,
});

describe('startHandlingLockReason', () => {
  it('접수 상태에서만 열린다', () => {
    expect(startHandlingLockReason(detail())).toBeNull();
  });

  /** 처리중·완료에서 다시 누를 수 있게 두면 서버가 거부하는데, 화면에는 「눌렀는데 아무 일도 없다」로 보인다. */
  it('처리중·완료에서는 막는다', () => {
    expect(startHandlingLockReason(detail({ statusCode: HANDLING_STATUS }))).not.toBeNull();
    expect(startHandlingLockReason(detail({ statusCode: DONE_STATUS }))).not.toBeNull();
  });

  it('고른 건이 없으면 막는다', () => {
    expect(startHandlingLockReason(null)).not.toBeNull();
  });
});

describe('completeLockReason', () => {
  /**
   * ⚠ 원인 코드 목록이 비어 있는 것이 **지금의 사실**이라 완료는 늘 막힌다. 그 사유가
   * 「원인 코드를 고르세요」이면 사용자가 고를 것이 없는 칸을 보게 되어 풀 수 없다.
   */
  it('원인 코드 목록이 없으면 그 사실이 첫 사유다', () => {
    expect(completeLockReason(detail(), 'SYN_CAUSE', '합성 처리 내역')).toBe(
      '원인 코드 목록이 아직 등록되지 않아 완료할 수 없습니다. 값이 등록되면 열립니다.',
    );
  });

  it('이미 완료된 건은 코드 목록보다 먼저 막힌다', () => {
    expect(completeLockReason(detail({ statusCode: DONE_STATUS }), '', '')).toBe(
      '이미 완료된 고장입니다.',
    );
  });

  it('고른 건이 없으면 막는다', () => {
    expect(completeLockReason(null, 'SYN_CAUSE', '합성')).not.toBeNull();
  });
});

describe('saveLockReason', () => {
  it('완료된 건은 처리 내용을 고칠 수 없다', () => {
    expect(saveLockReason(detail({ statusCode: DONE_STATUS }))).not.toBeNull();
  });

  /** 원인 코드만 먼저 적어 두고 처리 내역을 나중에 채우는 것이 정상 경로다. */
  it('접수·처리중에서는 언제든 적을 수 있다', () => {
    expect(saveLockReason(detail())).toBeNull();
    expect(saveLockReason(detail({ statusCode: HANDLING_STATUS }))).toBeNull();
  });
});

describe('openDowntimeWarning', () => {
  /**
   * ⚠ 완료가 비가동을 닫아 주지 않는다(계약이 못 박았다). 완료한 뒤에 알면 되돌릴 수 없고,
   * 비가동은 계속 열린 채 집계에서 빠진다.
   */
  it('끝나지 않은 비가동이 있으면 건수와 함께 경고한다', () => {
    expect(openDowntimeWarning(detail({ openLinkedDowntimeCount: 2 }))).toContain('2건');
  });

  it('없으면 경고하지 않는다 — 늘 뜨는 경고는 배경이 된다', () => {
    expect(openDowntimeWarning(detail())).toBeNull();
    expect(openDowntimeWarning(null)).toBeNull();
  });
});
