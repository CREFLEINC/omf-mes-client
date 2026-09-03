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

/** 이 지시의 임시 적치 등록 경로. 담는 쪽과 세는 쪽이 어긋나지 않도록 한 자리에서 만든다. */
export const temporaryPathOf = (putawayTaskId: number): string =>
  `/logistics/putaway-tasks/${String(putawayTaskId)}:complete-temporary`;

/** 큐에서 이 화면이 셈에 넣을 만큼만 읽는다. 큐는 화면을 가리지 않고 한 줄로 쌓인다. */
export interface QueuedTemporary {
  path: string;
}

/**
 * 이 지시로 이미 담아 둔 등록이 몇 건인가.
 *
 * 앞 화면이 넘긴 지시는 굳은 스냅숏이라, 등록을 마치고 같은 상태로 다시 들어오면 실제 적치
 * 위치가 여전히 비어 있다. 큐를 함께 보지 않으면 그 사이에 한 건이 더 나가고, 멱등키가
 * 달라 서버도 흡수하지 못한다.
 */
export const queuedCountOf = (entries: QueuedTemporary[], putawayTaskId: number): number =>
  entries.filter((entry) => entry.path === temporaryPathOf(putawayTaskId)).length;

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
  queuedCount: number,
): boolean => {
  if (task === null || draft.location === null || !hasWorker) {
    return false;
  }

  /* 서버가 아는 것과 아직 못 간 것을 함께 본다. 하나만 보면 재진입에 한 건이 더 나간다. */
  if (isAlreadyPutAway(task) || queuedCount > 0) {
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
    path: temporaryPathOf(task.putawayTaskId),
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
