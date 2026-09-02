import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { Location } from '../../patterns/locations';
import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import { businessDateOf, type PutawayTask } from '../putaway/putaway';

export type PutawayTaskCompleteTemporary =
  components['schemas']['PutawayTaskCompleteTemporary'];

/** 사유 코드 값 목록이 오는 공통코드 그룹. */
export const PUTAWAY_TASK_TEMPORARY_REASON = 'PUTAWAY_TASK_TEMPORARY_REASON';

/**
 * 이 지시가 이미 어딘가에 적치돼 있는가.
 *
 * 실제 적치 위치는 완료된 건에만 채워진다. 이미 있는데 또 적으면 같은 지시에 두 기록이 남는다.
 */
export const isAlreadyPutAway = (task: PutawayTask): boolean =>
  task.actualLocationId !== null && task.actualLocationId !== undefined;

export interface TemporaryDraft {
  location: Location | null;
  reasonCode: string;
  remarks: string;
}

/**
 * 등록할 수 있는가.
 *
 * 사유와 비고 중 하나는 있어야 한다 - 서버가 둘 다 비면 막는다. 사유만 필수로 두지는 않는다.
 * 확정된 것은 사유를 입력한다는 것이지 사유가 있어야 한다는 것이 아니다. 값을 못 고르는
 * 상황에서 기록 자체가 막히면 임시로 둔 물건이 어디 있는지 남지 않는다.
 */
export const canSubmit = (
  task: PutawayTask | null,
  draft: TemporaryDraft,
  hasWorker: boolean,
): boolean => {
  if (task === null || draft.location === null || !hasWorker) {
    return false;
  }

  if (isAlreadyPutAway(task)) {
    return false;
  }

  return draft.reasonCode !== '' || draft.remarks.trim() !== '';
};

export const toOutboxDraft = (
  task: PutawayTask,
  draft: TemporaryDraft,
  location: Location,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const body: PutawayTaskCompleteTemporary = {
    actualLocationId: location.locationId,
    reasonCode: draft.reasonCode === '' ? null : draft.reasonCode,
    remarks: draft.remarks.trim() === '' ? null : draft.remarks.trim(),
    businessDate: businessDateOf(now),
    occurredAt,
  };

  return {
    label: messages.temporaryPutaway.record,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: `/logistics/putaway-tasks/${String(task.putawayTaskId)}:complete-temporary`,
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
