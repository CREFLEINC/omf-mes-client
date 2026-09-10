import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { Location } from '../../patterns/locations';
import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type PutawayTask = components['schemas']['PutawayTask'];
export type PutawayTaskComplete = components['schemas']['PutawayTaskComplete'];
export type PutawayRule = components['schemas']['PutawayRule'];
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

/**
 * 이 창고가 위치를 관리하는가.
 *
 * 관리하면 위치를 스캔해 실물 라벨과 맞춰야 하고, 관리하지 않으면 스캔할 라벨 자체가 없어
 * 목록에서 고른다. 값을 받지 못했으면 관리하는 쪽으로 둔다 - 모르는 채 선택을 열면 라벨을
 * 읽지 않고 화면만 보고 적치가 끝난다.
 */
export const UNMANAGED_LEVEL = 'WAREHOUSE';

export const scansLocation = (task: PutawayTask): boolean =>
  task.warehouseManagementLevelCode !== UNMANAGED_LEVEL;

/**
 * 이 위치에 지금 들어 있는 것과 부딪치는가.
 *
 * 한 품목만 받는 자리에 다른 품목이 있으면 막는다. 한 LOT 만 받는 자리도 같다. 위반을
 * 안내로만 두면 사람은 통과로 읽고, 그 자리에 얹은 재고는 다음 사람이 찾지 못한다.
 */
export const MIXED_ITEM = 'mixedItem';
export const MIXED_LOT = 'mixedLot';

export type MixProblem = typeof MIXED_ITEM | typeof MIXED_LOT;

export interface LocationContent {
  itemId: number;
  lotId?: number | null;
  onHandQty: number;
}

export const mixProblemOf = (
  task: PutawayTask,
  location: Location,
  contents: LocationContent[],
): MixProblem | null => {
  const held = contents.filter((each) => each.onHandQty > 0);

  if (!location.allowMixedItem && held.some((each) => each.itemId !== task.itemId)) {
    return MIXED_ITEM;
  }

  return !location.allowMixedLot &&
    held.some(
      (each) => each.lotId !== null && each.lotId !== undefined && each.lotId !== task.lotId,
    )
    ? MIXED_LOT
    : null;
};

/** 지금 있는 양에 이번 지시를 더하면 한도를 넘는가. 넘어도 막지는 않는다 - 경고다. */
export const overCapacityOf = (
  task: PutawayTask,
  location: Location,
  contents: LocationContent[],
): { held: number; after: number; capacity: number } | null => {
  const capacity = location.capacityQty;

  if (capacity === null || capacity === undefined) {
    return null;
  }

  const held = contents.reduce((sum, each) => sum + each.onHandQty, 0);
  const after = held + task.taskQty;

  return after > capacity ? { held, after, capacity } : null;
};

/** 스캔한 LOT 이 이 지시의 것인가. 지시만 보고 적치하면 손에 든 것이 무엇인지 아무도 모른다. */
/**
 * 품목의 보관조건과 자리의 보관조건이 어긋나는가.
 *
 * 막지 않는다 - 설계가 경고로 정한 항목이고, 냉장 자리가 없어 상온에 두어야 하는 날이 있다.
 * 다만 말하지 않으면 아무도 모른 채 지나간다.
 *
 * 모르면 말하지 않는다. 둘 중 하나라도 비어 있으면 어긋났다고 할 근거가 없고, 그것을 어긋난
 * 것으로 읽으면 보관조건을 안 적은 품목마다 경고가 떠 진짜 경고가 묻힌다.
 */
/** 보관조건 값 목록을 받는 그룹. 품목과 위치가 같은 코드계를 쓴다. */
export const STORAGE_CONDITION = 'STORAGE_CONDITION';

export const storageMismatch = (
  itemCondition: string | null | undefined,
  locationCondition: string | null | undefined,
): boolean => {
  const item = itemCondition ?? '';
  const at = locationCondition ?? '';

  return item !== '' && at !== '' && item !== at;
};

export const lotMatches = (lotNo: string | null, scanned: string): boolean =>
  lotNo !== null && scanned.trim() === lotNo;

export interface CompleteInput {
  task: PutawayTask | null;
  location: Location | null;
  lotNo: string | null;
  scannedLot: string | null;
  contents: LocationContent[];
  confirmedNoRule: boolean;
  hasWorker: boolean;
}

export const canComplete = ({
  task,
  location,
  lotNo,
  scannedLot,
  contents,
  confirmedNoRule,
  hasWorker,
}: CompleteInput): boolean => {
  if (task === null || location === null || !hasWorker) {
    return false;
  }

  const verdict = verdictOf(task, location);

  if (verdict === NOT_RECOMMENDED) {
    return false;
  }

  if (mixProblemOf(task, location, contents) !== null) {
    return false;
  }

  if (scannedLot === null || !lotMatches(lotNo, scannedLot)) {
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
