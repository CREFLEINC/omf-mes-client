import type { ApiError, ErrorItem, ItemResourceMap } from '@omf-mes/api-client';
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
 * | 같은 공정·설비·금형 | `uq_item_resource_map` · 400 화면 범위 `UNIQUE_VIOLATION` |
 *
 * 설비·금형 누락은 서버와 같은 칸(`equipmentId`)에 붙인다. 중복은 서버가 화면 범위로 내지만
 * 로컬에서는 고칠 칸 옆(`moldId`)에 낸다 — 저장 전에 어느 칸을 바꿔야 하는지 보이는 편이 낫다.
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
  if (item.code === 'UNIQUE_VIOLATION') return t.duplicate;

  return undefined;
};

/**
 * 배너로 가는 오류(화면 범위)도 같은 말로 되말한다. 쓰기 훅의 되말하기는 칸 오류에만 닿아,
 * 화면 범위로 오는 중복은 이 자리가 아니면 서버 문구 그대로 남는다.
 */
export const restateItemResourceMapApiError = (error: ApiError | null): ApiError | null =>
  error?.kind === 'validation'
    ? {
        ...error,
        errors: error.errors.map((item) => ({
          ...item,
          message: restateItemResourceMapError(item) ?? item.message,
        })),
      }
    : error;
