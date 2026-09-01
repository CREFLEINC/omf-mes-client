import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

/** 멈췄다 / 돌지만 이상하다. 정지 여부가 뒤를 가른다. */
export type OccurrenceState = 'STOPPED' | 'ABNORMAL';

export interface FailureReport {
  equipmentId: number;
  symptom: string;
  occurrenceState: OccurrenceState;
  /** 모르면 비운다. 비가동 구간을 만드는 것은 이 화면이 아니다. */
  stoppedAt: string | null;
  notifyAssignee: boolean;
}

export interface ReportValidity {
  canSubmit: boolean;
  symptomMissing: boolean;
}

/**
 * 보고를 낼 수 있는가.
 *
 * 증상은 최소 글자 수를 강제하지 않는다. 무엇이 어떻게 되었는지는 사람마다 길이가 다르고,
 * 길이를 요구하면 자릿수를 채우려고 아무 말이나 적게 된다.
 */
export const validateReport = (draft: Partial<FailureReport>): ReportValidity => {
  const symptomMissing = (draft.symptom ?? '').trim() === '';

  return {
    symptomMissing,
    canSubmit:
      draft.equipmentId !== undefined && !symptomMissing && draft.occurrenceState !== undefined,
  };
};

/**
 * 큐에 담을 모양으로 바꾼다.
 *
 * 보고 시각은 단말 시계가 정한다 — 오프라인 지연이 고장 발생 시각을 뒤로 밀면 안 된다.
 * 알림은 끊겨 있어도 끄지 않는다. 끄면 보고자가 알린 줄 안다.
 */
export const toOutboxDraft = (report: FailureReport, occurredAt: string): OutboxDraft => ({
  idempotencyKey: createIdempotencyKey({
    operation: 'breakdown-report',
    target: report.equipmentId,
  }),
  method: 'POST',
  path: '/maintenance/breakdowns',
  body: {
    equipmentId: report.equipmentId,
    symptom: report.symptom.trim(),
    occurrenceStateCode: report.occurrenceState,
    stoppedAt: report.stoppedAt,
    reportedAt: occurredAt,
    notifyAssignee: report.notifyAssignee,
  },
  occurredAt,
  /* 설비담당이 와야 끝나는 일이라, 서버가 받기 전까지 보고됨으로 그리지 않는다. */
  confirmation: 'pending',
});

/**
 * 읽은 코드를 못 찾았다고 말할 수 있는가.
 *
 * 목록이 아직 오지 않았으면 말할 수 없다. 그때 없다고 하면 있는 설비를 없다고 하는 것이 되고,
 * 작업자는 맞는 코드를 들고 계속 다시 쏜다.
 */
export const scanMissOf = (
  scanned: string | null,
  loaded: boolean,
  selectedCode: string | undefined,
): string | null => (scanned !== null && loaded && selectedCode !== scanned ? scanned : null);
