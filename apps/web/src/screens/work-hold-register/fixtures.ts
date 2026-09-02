import type { components } from '@omf-mes/api-client';

/** 합성값이다 — 실 운영 값을 쓰지 않는다. */
export const WORK_ORDER_ID = 4013;
export const WORK_SESSION_ID = 9102;
export const WORKER_NO = '20260901';

type WorkSession = components['schemas']['WorkSession'];
type WorkSessionEvent = components['schemas']['WorkSessionEvent'];

export const workSession = (overrides: Partial<WorkSession> = {}): WorkSession => ({
  workSessionId: WORK_SESSION_ID,
  workOrderId: WORK_ORDER_ID,
  sessionNo: 2,
  terminalId: 7,
  startedAt: '2026-09-02T08:00:00+09:00',
  statusCode: 'IN_PROGRESS',
  versionNo: 3,
  ...overrides,
});

export const sessionEvent = (overrides: Partial<WorkSessionEvent> = {}): WorkSessionEvent => ({
  workSessionEventId: 1,
  eventTypeCode: 'START',
  occurredAt: '2026-09-02T08:00:00+09:00',
  ...overrides,
});
