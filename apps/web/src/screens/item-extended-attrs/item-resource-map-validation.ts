import type { ErrorItem, ItemResourceMap } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import {
  resourceMapKeyOf,
  rowResourceMapKey,
  type ItemResourceMapFormValues,
} from './item-resource-map-draft';

/**
 * 설비·금형 매핑 편집 창의 검증. **계약의 제약을 옮긴 것만 만든다.**
 *
 * | 로컬에서 막는 것 | 계약 근거 |
 * | --- | --- |
 * | 설비·금형 중 하나 | `ck_item_resource_map_target` · 400 `equipmentId` `REQUIRED` |
 * | 우선순위 0 이상의 정수 | `priority_no >= 0` |
 * | 같은 공정·설비·금형 | `uq_item_resource_map` · 400 `moldId` `UNIQUE_VIOLATION` |
 *
 * 오류를 붙이는 칸은 **서버가 같은 오류를 붙이는 칸과 같다** — 로컬과 서버가 다른 칸을 짚으면
 * 같은 문제가 두 자리에서 다르게 보인다.
 */

const t = messages.itemExtendedAttrs.itemResourceMap.validation;

const isNonNegativeInteger = (value: string): boolean => /^\d+$/.test(value.trim());

export const validateItemResourceMap = (
  values: ItemResourceMapFormValues,
  /** 같은 품목·공장의 줄 전부. 사용 중지한 줄도 유일 제약에 든다 */
  rows: readonly ItemResourceMap[],
  /** 고치는 줄. 자기 자신은 중복으로 세지 않는다 */
  editingId: number | null,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.equipmentId === '' && values.moldId === '') {
    errors.equipmentId = t.equipmentOrMold;
  }

  if (values.priorityNo.trim() === '') {
    errors.priorityNo = t.required;
  } else if (!isNonNegativeInteger(values.priorityNo)) {
    errors.priorityNo = t.priorityNoInvalid;
  }

  if (errors.equipmentId === undefined) {
    const key = resourceMapKeyOf(values);
    const isDuplicate = rows.some(
      (row) => row.itemResourceMapId !== editingId && rowResourceMapKey(row) === key,
    );

    if (isDuplicate) errors.moldId = t.duplicate;
  }

  return errors;
};

/**
 * 서버 오류를 화면의 말로 되말한다. 유일 범위(사용 중지한 줄 포함)와 되살리는 길은 화면만 안다.
 * 모르는 코드는 서버 문구를 그대로 둔다.
 */
export const restateItemResourceMapError = (item: ErrorItem): string | undefined => {
  if (item.field === 'equipmentId' && item.code === 'REQUIRED') return t.equipmentOrMold;
  if (item.field === 'moldId' && item.code === 'UNIQUE_VIOLATION') return t.duplicate;

  return undefined;
};
