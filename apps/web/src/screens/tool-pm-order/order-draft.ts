import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { MOLD_TARGET, PM_DUE_TRIGGER, type MoldView } from './types';

/**
 * 오더 만들기 폼의 편집 상태와 그 판정.
 *
 * ⭐ **한 오더 = 한 툴이다.** 그래서 이 파일의 만들기 함수는 **툴 하나마다** 본문을 만든다 —
 * 여럿을 한 본문에 담는 모양 자체를 두지 않는다. 그런 모양이 있으면 언젠가 그것으로 보낸다.
 *
 * ⭐ **트리거 스냅샷을 발행 시점 값으로 얼린다.** 누계 타발수는 실적 등록에서 리셋되므로,
 * 얼려 두지 않으면 나중에 「도래할 때 얼마였는가」를 되짚을 수 없다.
 *
 * **순수 함수만 둔다.** 「오늘」을 읽지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.toolPmOrder;

type MaintenanceOrderCreate = components['schemas']['MaintenanceOrderCreate'];

export interface ItemDraft {
  key: string;
  name: string;
}

export interface ToolOrderDraft {
  plannedDate: string;
  assignee: string;
  baseDate: string;
  orderNote: string;
  /** ⭐ 툴은 항목 마스터가 없어 이름을 직접 적는다. */
  items: ItemDraft[];
}

export const EMPTY_DRAFT: ToolOrderDraft = {
  plannedDate: '',
  assignee: '',
  baseDate: '',
  orderNote: '',
  items: [],
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

export type DraftErrors = Partial<Record<keyof ToolOrderDraft | 'selection', string>>;

export const validateDraft = (draft: ToolOrderDraft, selectedCount: number): DraftErrors => {
  const errors: DraftErrors = {};

  if (selectedCount === 0) errors.selection = t.form.requiredSelection;
  if (draft.assignee === '') errors.assignee = t.form.requiredAssignee;

  if (draft.plannedDate === '') {
    errors.plannedDate = t.form.requiredPlannedDate;
  } else if (!isCalendarDate(draft.plannedDate)) {
    errors.plannedDate = t.form.invalidPlannedDate;
  }

  if (draft.baseDate !== '' && !isCalendarDate(draft.baseDate)) {
    errors.baseDate = t.form.invalidPlannedDate;
  }

  if (draft.items.length === 0) {
    errors.items = t.form.requiredItem;
  } else if (draft.items.some((item) => item.name.trim() === '')) {
    /* 빈 항목을 그대로 보내면 이름 없는 줄이 오더에 남고, 담당자가 무엇을 할지 알 수 없다. */
    errors.items = t.form.emptyItemName;
  }

  return errors;
};

export const hasErrors = (errors: DraftErrors): boolean => Object.keys(errors).length > 0;

const optionalText = (value: string): string | undefined => {
  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
};

/**
 * 툴 **하나**의 오더 본문.
 *
 * ⛔ **보전 유형을 싣지 않는다** — 트리거 조합이 정한다(주기 도래뿐이므로 예방이다).
 * ⛔ **주기 도래 트리거의 원천 식별자를 싣지 않는다** — 가리킬 행이 없다.
 * ⭐ **스냅샷을 얼려 보낸다** — 누계는 실적 등록에서 리셋되므로 지금 값을 남기지 않으면
 * 「도래할 때 얼마였는가」가 사라진다.
 */
export const toCreateBody = (draft: ToolOrderDraft, mold: MoldView): MaintenanceOrderCreate => ({
  targetTypeCode: MOLD_TARGET,
  targetId: mold.moldId,
  plannedDate: draft.plannedDate,
  assigneeUserId: Number(draft.assignee),
  /* 툴은 항목 마스터가 없어 이름만 담는다 — 마스터 식별자를 지어내지 않는다. */
  items: draft.items.map((item, index) => ({
    itemName: item.name.trim(),
    sequenceNo: index + 1,
  })),
  triggers: [
    {
      triggerTypeCode: PM_DUE_TRIGGER,
      ...(mold.pmDueAxisCode === null ? {} : { pmDueAxisCode: mold.pmDueAxisCode }),
      shotCountAtDue: mold.currentShotCount,
      ...(mold.guaranteedShotCount === null
        ? {}
        : { guaranteedShotCountAtDue: mold.guaranteedShotCount }),
    },
  ],
  ...(draft.baseDate === '' ? {} : { baseDate: draft.baseDate }),
  ...(optionalText(draft.orderNote) === undefined
    ? {}
    : { orderNote: optionalText(draft.orderNote) }),
});
