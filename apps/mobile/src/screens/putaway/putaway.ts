import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { isWarehouseWhole, type Location } from '../../patterns/locations';
import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

/** 004 — 원천(`originCode` · `originDocumentNo`)과 완료 응답의 옮긴 양(`movedQty`)도 생성 타입에 있다(계약 §6). */
export type PutawayTask = components['schemas']['PutawayTask'];
export type PutawayTaskComplete = components['schemas']['PutawayTaskComplete'];
export type { Location };

/**
 * 고른 위치가 지시와 맞는가.
 *
 * 지시가 둬도 되는 위치를 싣는다(서버 #906 · 적치 규칙 제거, 사용자 결정 2026-10-29) — 그 창고에서 품목을
 * 보관 품목으로 걸어 둔 맨 아래 위치 전부다. 목록이 있으면 그 중 아무 데나 받는다 - 다른 곳에 두면 다음
 * 사람이 찾지 못하고, 서버도 막는다. 목록이 비면 보관 위치를 정하지 않은 품목이라 이 창고 어디든 둔다.
 */
export const MATCHED = 'matched';
export const NOT_ALLOWED = 'notAllowed';
export const ANYWHERE = 'anywhere';

export type LocationVerdict = typeof MATCHED | typeof NOT_ALLOWED | typeof ANYWHERE;

export const verdictOf = (task: PutawayTask, location: Location): LocationVerdict => {
  if (task.allowedLocations.length === 0) {
    return ANYWHERE;
  }

  return task.allowedLocations.some((each) => each.locationId === location.locationId)
    ? MATCHED
    : NOT_ALLOWED;
};

/**
 * 위치 라벨을 스캔하는가.
 *
 * 둘 곳이 「창고 전체」 하나뿐이면 스캔할 라벨이 없어 목록에서 고른다. 그 밖에는 라벨을 읽어 실물과
 * 맞춘다. 위치를 받지 못했으면 스캔하는 쪽으로 둔다 - 모르는 채 선택을 열면 라벨을 읽지 않고 화면만
 * 보고 적치가 끝난다.
 */
export const scansLocation = (task: PutawayTask, locations: Location[] | undefined): boolean => {
  const [only, ...rest] = task.allowedLocations;
  if (only === undefined || rest.length > 0) {
    return true;
  }

  const found = locations?.find((each) => each.locationId === only.locationId);

  return found === undefined || !isWarehouseWhole(found);
};

/**
 * 둬도 되는 위치를 한 줄로. 하나면 그 코드, 여럿이면 첫 코드와 나머지 수 - 카드가 길어지지 않게
 * 하고, 전부는 「자세히」에서 본다. 비면 null.
 */
export const allowedSummaryOf = (task: PutawayTask): string | null => {
  const [first, ...rest] = task.allowedLocations;
  if (first === undefined) {
    return null;
  }

  return rest.length === 0
    ? first.locationCode
    : messages.putaway.tasks.allowedMore(first.locationCode, String(rest.length));
};

/** 스캔한 LOT 이 이 지시의 것인가. 지시만 보고 적치하면 손에 든 것이 무엇인지 아무도 모른다. */
export const lotMatches = (lotNo: string | null, scanned: string): boolean =>
  lotNo !== null && scanned.trim() === lotNo;

export interface CompleteInput {
  task: PutawayTask | null;
  location: Location | null;
  lotNo: string | null;
  scannedLot: string | null;
  hasWorker: boolean;
}

export const canComplete = ({
  task,
  location,
  lotNo,
  scannedLot,
  hasWorker,
}: CompleteInput): boolean => {
  if (task === null || location === null || !hasWorker) {
    return false;
  }

  if (verdictOf(task, location) === NOT_ALLOWED) {
    return false;
  }

  return scannedLot !== null && lotMatches(lotNo, scannedLot);
};

/** 단말이 정하는 업무 기준일. 서버가 수신 시각으로 다시 잡지 않는다. */
export const businessDateOf = (now: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const toOutboxDraft = (
  task: PutawayTask,
  location: Location,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const body: PutawayTaskComplete = {
    actualLocationId: location.locationId,
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

/**
 * 원천 한 줄(screens/M-putaway.md) — 원천을 모르면(예전 지시) 구매 입고다. 창고 보충은 요청번호(`originDocumentNo`,
 * 서버 S7e)를 붙인다.
 */
export const originOf = (task: PutawayTask): string => {
  const name = messages.putaway.tasks.origin[task.originCode ?? 'GOODS_RECEIPT'];
  const no = task.originDocumentNo;
  return task.originCode === 'REPLENISHMENT_RECEIPT' && no !== null && no !== undefined && no !== ''
    ? messages.putaway.tasks.originWithNo(name, no)
    : name;
};

/**
 * 완료 응답으로 본 결과 한 줄 — 창고 보충 지시가 지시 수량보다 덜 옮겼으면 「남은 N 만」, 0 이면 「닫았습니다」.
 * 응답을 못 받았거나(오프라인 담기) 다 옮겼으면 null.
 */
export const movedNoteOf = (task: PutawayTask, response: unknown, uom: string): string | null => {
  const moved = (response as { movedQty?: unknown } | undefined)?.movedQty;
  if (typeof moved !== 'number' || moved >= task.taskQty) return null;
  return moved <= 0
    ? messages.putaway.done.movedNone
    : messages.putaway.done.movedPartial(`${String(moved)} ${uom}`.trim());
};
