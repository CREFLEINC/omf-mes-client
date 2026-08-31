import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { BREAKDOWN_TRIGGER, EQUIPMENT_TARGET, PM_DUE_TRIGGER, type TriggerDraft } from './types';

/**
 * 발행 폼의 편집 상태와 그 판정.
 *
 * ⭐ **보전 유형을 화면이 고르지 않는다.** 트리거 조합이 정하고(고장이 하나라도 섞이면 사후),
 * 계약도 그 칸을 만들기 본문에서 뺐다. 화면은 **무엇이 될지 미리 보여 주기만** 한다 — 발행한
 * 뒤에 유형을 보고 놀라지 않게.
 *
 * ⭐ **한 지시에 같은 설비만 묶는다.** 트리거를 고를 때마다 판정하지 않고 여기 한 곳에서
 * 본다 — 고르는 자리와 발행하는 자리 둘로 나누면 한쪽만 고쳐져 섞인 지시가 나간다.
 *
 * **순수 함수만 둔다.** 「오늘」을 읽지 않는다 — 예정일에 과거를 막는 규칙은 계약에도 스펙에도
 * 없고, 화면이 지어내면 늦게 발행하는 건을 못 적는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.maintenanceOrder;

type MaintenanceOrderCreate = components['schemas']['MaintenanceOrderCreate'];

export interface OrderDraft {
  /** 대상 설비. 트리거를 고르면 그 설비로 정해진다. */
  target: string;
  plannedDate: string;
  assignee: string;
  baseDate: string;
  orderNote: string;
  /** 점검·보전 항목 마스터의 식별자들. 순서가 곧 표시 순서다. */
  itemIds: string[];
}

export const EMPTY_DRAFT: OrderDraft = {
  target: '',
  plannedDate: '',
  assignee: '',
  baseDate: '',
  orderNote: '',
  itemIds: [],
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isCalendarDate = (value: string): boolean => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

/**
 * 이 조합이 만들 보전 유형.
 *
 * ⭐ **고장이 하나라도 섞이면 사후다**(계약의 규칙). 서버가 정하지만 화면도 같은 판정을 한다 —
 * 발행 전에 무엇이 될지 보여 주기 위해서다. 둘이 갈리면 화면 쪽이 틀린 것이니 이 함수를 고친다.
 */
export const derivedTypeLabel = (triggers: readonly TriggerDraft[]): string =>
  triggers.some((trigger) => trigger.triggerTypeCode === BREAKDOWN_TRIGGER)
    ? t.form.corrective
    : t.form.preventive;

/**
 * 주기 기준일을 적을 자리인가.
 *
 * ⭐ **예방보전에만 적는다**(계약: 「사후 보전에는 비어 있다」). 사후인데 기준일이 실리면
 * 다음 주기가 엉뚱한 날부터 시작한다.
 */
export const usesBaseDate = (triggers: readonly TriggerDraft[]): boolean =>
  triggers.length > 0 && !triggers.some((trigger) => trigger.triggerTypeCode === BREAKDOWN_TRIGGER);

/**
 * 고른 트리거들이 같은 설비인가. **비어 있으면 참이다** — 아직 아무것도 안 골랐으면 섞일 것이 없다.
 */
export const isSameEquipment = (triggers: readonly TriggerDraft[]): boolean => {
  if (triggers.length === 0) return true;

  const first = triggers[0]?.equipmentId;

  return triggers.every((trigger) => trigger.equipmentId === first);
};

/** 지금 묶고 있는 설비. 아무것도 안 골랐으면 `null`이다. */
export const lockedEquipmentId = (triggers: readonly TriggerDraft[]): number | null =>
  triggers[0]?.equipmentId ?? null;

export type DraftErrors = Partial<Record<keyof OrderDraft | 'triggers', string>>;

export const validateDraft = (
  draft: OrderDraft,
  triggers: readonly TriggerDraft[],
): DraftErrors => {
  const errors: DraftErrors = {};

  if (draft.target === '') errors.target = t.form.requiredTarget;
  if (draft.assignee === '') errors.assignee = t.form.requiredAssignee;

  if (draft.plannedDate === '') {
    errors.plannedDate = t.form.requiredPlannedDate;
  } else if (!isCalendarDate(draft.plannedDate)) {
    errors.plannedDate = t.form.invalidPlannedDate;
  }

  if (draft.baseDate !== '' && !isCalendarDate(draft.baseDate)) {
    errors.baseDate = t.form.invalidPlannedDate;
  }

  if (triggers.length === 0) {
    errors.triggers = t.form.requiredTrigger;
  } else if (!isSameEquipment(triggers)) {
    /* ⭐ 섞인 것을 발행하면 지시 하나가 두 설비를 가리키게 되고 되돌릴 길이 없다. */
    errors.triggers = t.form.mixedEquipment;
  }

  /*
   * ⭐ 설비 보전은 항목 마스터를 **반드시** 가리킨다(계약: 「targetTypeCode=EQUIPMENT 이면
   * 반드시 채운다 — 부여가 없으면 발행할 수 없다」).
   */
  if (draft.itemIds.length === 0) errors.itemIds = t.form.requiredItem;

  return errors;
};

export const hasErrors = (errors: DraftErrors): boolean => Object.keys(errors).length > 0;

const optionalText = (value: string): string | undefined => {
  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
};

/**
 * 편집 상태를 요청 본문으로 옮긴다.
 *
 * ⛔ **보전 유형을 싣지 않는다** — 계약의 만들기 본문에 그 칸이 없다. 트리거 조합이 정한다.
 * ⛔ **`itemNames`를 쓰지 않는다** — 항목 마스터가 없을 때의 옛 표현이고, 설비 보전은 마스터를
 * 가리켜야 한다. 둘을 함께 실으면 `items`가 이기지만 애초에 싣지 않는다.
 * ⛔ **사후 보전에는 주기 기준일을 싣지 않는다** — 실으면 다음 주기가 엉뚱한 날부터 시작한다.
 */
export const toCreateBody = (
  draft: OrderDraft,
  triggers: readonly TriggerDraft[],
): MaintenanceOrderCreate => ({
  targetTypeCode: EQUIPMENT_TARGET,
  targetId: Number(draft.target),
  plannedDate: draft.plannedDate,
  assigneeUserId: Number(draft.assignee),
  items: draft.itemIds.map((id, index) => ({
    inspectionItemId: Number(id),
    sequenceNo: index + 1,
  })),
  triggers: triggers.map((trigger) => ({
    triggerTypeCode: trigger.triggerTypeCode,
    /* ⛔ 주기 도래는 가리킬 행이 없어 비운다 — 나머지 둘에서는 반드시 채운다. */
    ...(trigger.triggerTypeCode === PM_DUE_TRIGGER || trigger.sourceId === null
      ? {}
      : { sourceId: trigger.sourceId }),
  })),
  ...(usesBaseDate(triggers) && draft.baseDate !== '' ? { baseDate: draft.baseDate } : {}),
  ...(optionalText(draft.orderNote) === undefined
    ? {}
    : { orderNote: optionalText(draft.orderNote) }),
});
