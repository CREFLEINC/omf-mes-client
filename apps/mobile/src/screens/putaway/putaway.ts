import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { Location } from '../../patterns/locations';
import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type PutawayTask = components['schemas']['PutawayTask'];
export type PutawayTaskComplete = components['schemas']['PutawayTaskComplete'];
export type { Location };

/**
 * 고른 위치가 지시와 맞는가.
 *
 * 권장이 있으면 그 위치만 받는다 - 다른 곳에 두면 다음 사람이 찾지 못하고, 서버도 막는다.
 * 권장이 없는 품목까지 막으면 미등록 품목이 적치 자체를 못 해 현장이 선다. 그때는 확인을
 * 받고 통과시키되 어디에 두었는지는 반드시 남긴다.
 */
export const MATCHED = 'matched';
export const NOT_RECOMMENDED = 'notRecommended';
export const NO_RULE = 'noRule';

export type LocationVerdict = typeof MATCHED | typeof NOT_RECOMMENDED | typeof NO_RULE;

export const verdictOf = (task: PutawayTask, location: Location): LocationVerdict => {
  if (task.recommendedLocationId === null || task.recommendedLocationId === undefined) {
    return NO_RULE;
  }

  return task.recommendedLocationId === location.locationId ? MATCHED : NOT_RECOMMENDED;
};

/** 이 위치가 한 품목만 받는가. 지금 무엇이 들어 있는지는 이 화면이 알지 못한다. */
export const isSingleItemOnly = (location: Location): boolean => !location.allowMixedItem;

export const canComplete = (
  task: PutawayTask | null,
  location: Location | null,
  confirmedNoRule: boolean,
  hasWorker: boolean,
): boolean => {
  if (task === null || location === null || !hasWorker) {
    return false;
  }

  const verdict = verdictOf(task, location);

  if (verdict === NOT_RECOMMENDED) {
    return false;
  }

  return verdict === MATCHED || confirmedNoRule;
};

/** 단말이 정하는 업무 기준일. 서버가 수신 시각으로 다시 잡지 않는다. */
export const businessDateOf = (now: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const toOutboxDraft = (
  task: PutawayTask,
  location: Location,
  confirmedNoRule: boolean,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const body: PutawayTaskComplete = {
    actualLocationId: location.locationId,
    /* 권장이 있는 건에까지 참을 실으면 확인한 적 없는 통과가 기록으로 남는다. */
    confirmedNoRule: verdictOf(task, location) === NO_RULE && confirmedNoRule,
    businessDate: businessDateOf(now),
    occurredAt,
  };

  return {
    label: messages.putaway.record,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: `/logistics/putaway-tasks/${String(task.putawayTaskId)}:complete`,
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
