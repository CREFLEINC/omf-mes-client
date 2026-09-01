import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import type { Lot } from '../../patterns/lots';
import { INSPECTION_PENDING } from './queries';

/** 계약이 사유를 NOT NULL 로 받는다. 빈 값은 저장되지 않으므로 화면이 먼저 막는다. */
export const hasReason = (reason: string): boolean => reason.trim() !== '';

/**
 * 검사 대기인 LOT 인가.
 *
 * 판정하지 못하면 통과시키지 않는다 - 조회가 아직 안 왔거나 실패한 것을 통과로 읽으면,
 * 이미 검사가 끝난 자재에 생략 요청이 올라간다.
 */
export const isInspectionPending = (lot: Lot | null | undefined): boolean =>
  lot?.statusCode === INSPECTION_PENDING;

/**
 * 요청을 큐에 담을 형태로 만든다.
 *
 * 승인 유형과 대상 유형을 싣지 않는다 - 계약이 경로로 그 둘을 정하고 서버가 채운다. 화면이
 * 문자열을 지어 실으면 값이 바뀌는 날 두 자리가 어긋난다.
 */
export const toOutboxDraft = (
  lotId: number,
  reason: string,
  occurredAt: string,
  workerNo: string,
): OutboxDraft => ({
  label: messages.iqcSkipRequest.record,
  workerNo,
  idempotencyKey: createIdempotencyKey(),
  method: 'POST',
  path: `/trace/lots/${String(lotId)}:request-iqc-skip`,
  body: { reason: reason.trim() },
  occurredAt,
  /* 승인자가 이것을 보고 판정한다. 담긴 것만으로 요청됐다고 할 수 없다. */
  confirmation: 'pending',
});

/** 결재선이 없다고 서버가 말한 코드. 승인자가 정해지지 않으면 요청이 설 자리가 없다. */
const ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND';

/**
 * 되돌아온 이유가 결재선 없음인가.
 *
 * 다른 거부와 문구를 가른다 - 이것은 적은 내용이 틀린 것이 아니라 받을 사람이 없는 것이라,
 * 사유를 고쳐 다시 올려도 같은 자리에서 되돌아온다.
 */
export const isRouteMissing = (error: ApiError): boolean =>
  (error.kind === 'validation' || error.kind === 'stateLocked') &&
  error.errors.some((item) => item.code === ROUTE_NOT_FOUND);
