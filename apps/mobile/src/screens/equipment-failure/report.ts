import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import type { CapturedPhoto } from '../../patterns/photo-capture';

/** 멈췄다 / 돌지만 이상하다. 정지 여부가 뒤를 가른다. */
export type OccurrenceState = 'STOPPED' | 'ABNORMAL';

/**
 * 화면의 시각 칸이 주는 것은 시:분뿐인데 계약이 받는 것은 날짜까지 있는 시각이다.
 *
 * 보고 시각과 같은 날로 본다. 고장을 적는 것은 난 직후라 날을 넘길 일이 드물고, 넘겼다면
 * 시각만으로는 어느 날인지 알 수 없어 어차피 화면이 물어야 한다.
 */
export const stoppedAtOf = (hourMinute: string, occurredAt: string): string | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(hourMinute);

  if (match === null) {
    return null;
  }

  const reported = new Date(occurredAt);
  const at = new Date(occurredAt);
  at.setHours(Number(match[1]), Number(match[2]), 0, 0);

  /* 멈춘 것이 보고보다 뒤일 수는 없다. 자정을 넘겨 적으면 그날로 잡은 값이 미래가 된다. */
  if (at.getTime() > reported.getTime()) {
    at.setDate(at.getDate() - 1);
  }

  return at.toISOString();
};

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
export const toOutboxDraft = (
  report: FailureReport,
  occurredAt: string,
  reportId: string,
  workerNo: string,
): OutboxDraft => ({
  /* 사진이 이 건을 가리켜야 하므로 식별자를 여기서 정한다. 묶음 이름도 같은 값을 쓴다. */
  id: reportId,
  batchId: reportId,
  workerNo,
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
    stoppedAt: report.stoppedAt === null ? null : stoppedAtOf(report.stoppedAt, occurredAt),
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

/** 계약이 정한 한도. 넘겨 찍을 수 없게 화면이 막는다. */
export const MAX_PHOTOS = 3;

/*
 * 담아 둘 수 있는 사진의 총량. 한 장이 수백 KB 라 이 값이면 대여섯 장이 들어가고, 그보다
 * 쌓이면 단말 보관소가 감당하지 못한다. 넘으면 더 찍지 못하게 막고 이유를 말한다.
 */
export const PHOTO_QUEUE_LIMIT_BYTES = 4 * 1024 * 1024;

/**
 * 사진을 본문에 딸린 건으로 담는다.
 *
 * 사진에 따로 멱등키를 두지 않는다 - 본문이 성공해야 붙을 곳이 생기므로 본문의 키를 나눠 쓴다.
 * 본문이 거부되면 사진도 함께 되돌아온다.
 */
export const toPhotoDrafts = (
  photos: CapturedPhoto[],
  body: OutboxDraft,
  occurredAt: string,
  reportId: string,
): OutboxDraft[] =>
  photos.map((photo, index) => ({
    id: `${reportId}-photo-${String(index)}`,
    idempotencyKey: `${body.idempotencyKey}:photo:${String(index)}`,
    method: 'POST',
    path: '/maintenance/breakdowns/:breakdownId/attachments',
    body: null,
    file: { fileName: photo.fileName, mimeType: photo.mimeType, data: photo.data },
    pathFrom: {
      entryId: reportId,
      field: 'breakdownId',
      token: ':breakdownId',
    },
    batchId: body.batchId,
    workerNo: body.workerNo,
    occurredAt,
    /* 본문이 가야 붙을 곳이 생긴다. 담긴 것만으로 붙었다고 할 수 없다. */
    confirmation: 'pending',
  }));
