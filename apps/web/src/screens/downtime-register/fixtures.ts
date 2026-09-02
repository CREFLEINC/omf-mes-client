import type { components } from '@omf-mes/api-client';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다.
 *
 * 전부 지어낸 합성값이다 — 실 운영 설비 코드·사번을 넣지 않는다(공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 5100대(설비) · 5200대(비가동) ·
 * 5300대(고장) · 5400대(단말·공정).
 */

type Downtime = components['schemas']['Downtime'];
type Breakdown = components['schemas']['Breakdown'];

export const EQUIPMENT_ID = 5101;
export const EQUIPMENT_CODE = 'SAMPLE-PRS-01';
export const WORKER_NO = 'SAMPLE-3391';
export const TERMINAL_ID = 5401;
export const PROCESS_ID = 5402;

/** 시험이 보는 「오늘」. 시각이 데이터인 화면이라 날짜를 고정하지 않으면 감지기가 흔들린다. */
export const TODAY = '2026-08-11';

/** 지역 시각 문자열 — 계약이 offset 있는 시각을 요구한다. */
export const at = (time: string, day: string = TODAY): string => `${day}T${time}:00+09:00`;

export const downtime = (overrides: Partial<Downtime> = {}): Downtime => ({
  downtimeId: 5201,
  equipmentId: EQUIPMENT_ID,
  reasonCode: 'MOLD_CHANGE',
  reasonName: '금형 교체',
  startedAt: at('09:40'),
  endedAt: at('10:30'),
  durationMinutes: 50,
  recordedByWorkerNo: WORKER_NO,
  ...overrides,
});

/** 끝나지 않은 구간 — **끝 시각을 빼는 것**이 진행 중이라는 뜻이다. */
export const ongoingDowntime = (overrides: Partial<Downtime> = {}): Downtime => {
  const { endedAt: _endedAt, durationMinutes: _durationMinutes, ...rest } = downtime(overrides);

  return { ...rest, endedAt: null, durationMinutes: null };
};

export const breakdown = (overrides: Partial<Breakdown> = {}): Breakdown => ({
  breakdownId: 5301,
  breakdownNo: 'SAMPLE-MLF-0088',
  equipmentId: EQUIPMENT_ID,
  symptom: '합성 증상',
  occurrenceStateCode: 'STOPPED',
  stoppedAt: at('14:20'),
  reportedAt: at('14:25'),
  reporterWorkerNo: WORKER_NO,
  statusCode: 'RECEIVED',
  ...overrides,
});
