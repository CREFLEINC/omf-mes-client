import { messages } from '@omf-mes/i18n';

import { usesDateAxis } from './code-options';
import type { ToolFormValues } from './types';

const t = messages.toolMaster.validation;

/**
 * 서버가 준 필드 오류를 **인라인으로 낼 수 있는** 칸 이름. 목록에 없는 필드명은 삼키지 않고
 * 배너로 간다.
 *
 * ⛔ **오류를 그릴 자리가 없는 칸을 여기 넣지 않는다.** 넣으면 그 오류는 인라인으로 분류된 뒤
 * 아무 데도 그려지지 않아 **어디에도 표시되지 않는 오류**가 된다 — 배너로 갔으면 보였을 것이다.
 * 여기 이름 아홉은 모두 오류를 그릴 자리를 가진 입력칸이다.
 */
export const TOOL_FORM_FIELDS: readonly string[] = [
  'moldCode',
  'moldName',
  'toolTypeCode',
  'plantId',
  'cavityCount',
  'guaranteedShotCount',
  'pmTriggerTypeCode',
  'pmCycleInterval',
  'pmCycleUnitCode',
];

const POSITIVE_INTEGER = /^\d+$/;

/** 1 이상의 정수인가. **`0` 을 받지 않는다** — 이 화면의 두 수 칸에서 0 은 뜻이 없다. */
const isPositiveInteger = (text: string): boolean =>
  POSITIVE_INTEGER.test(text) && Number(text) > 0;

export interface ToolValidationContext {
  /** 등록인가. 공장은 등록에서만 고른다 */
  isCreate: boolean;
}

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다. 코드 중복은 서버 몫이다.
 *
 * ⭐ **적정타수가 비어 있어도 막지 않는다.** 「적정타수 없는 것만」 조회 조건이 계약에 있다는
 * 것은 **그 상태로 저장하는 것을 업무가 허용한다**는 뜻이다 — 막으면 나중에 채우는 길이
 * 사라지고 그 조회 조건이 셀 것이 없어진다. 대신 무엇이 서지 않는지를 안내로 밝힌다.
 *
 * ⛔ **누계 타발수를 재지 않는다** — 폼에 없는 값이다. 이 화면이 정하지 않는다(스펙 §6).
 */
export const validateTool = (
  values: ToolFormValues,
  context: ToolValidationContext,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.moldCode === '') {
    errors.moldCode = t.required;
  } else if (values.moldCode.trim() === '') {
    errors.moldCode = t.codeBlank;
  }

  if (values.moldName.trim() === '') {
    errors.moldName = t.required;
  }

  if (values.toolTypeCode === '') {
    errors.toolTypeCode = t.required;
  }

  if (context.isCreate && values.plantId === '') {
    errors.plantId = t.required;
  }

  const cavity = values.cavityCount.trim();

  if (cavity === '') {
    errors.cavityCount = t.required;
  } else if (!isPositiveInteger(cavity)) {
    errors.cavityCount = t.cavityPositiveInteger;
  }

  /* 비어 있는 것은 허용한다 — 적혀 있으면 셀 수 있는 수여야 한다. */
  const guaranteed = values.guaranteedShotCount.trim();

  if (guaranteed !== '' && !isPositiveInteger(guaranteed)) {
    errors.guaranteedShotCount = t.guaranteedPositiveInteger;
  }

  if (values.pmTriggerTypeCode === '') {
    errors.pmTriggerTypeCode = t.required;
  }

  /*
   * ⭐ 날짜 축을 쓰면 **주기 두 칸이 짝으로** 있어야 한다. 하나만 있으면 「6」인지 「6일」인지
   * 「6개월」인지 알 수 없어 다음 예정일을 아무도 셀 수 없다.
   */
  if (usesDateAxis(values.pmTriggerTypeCode)) {
    if (values.pmCycleUnitCode === '') {
      errors.pmCycleUnitCode = t.cycleRequired;
    }

    const interval = values.pmCycleInterval.trim();

    if (interval === '') {
      errors.pmCycleInterval = t.cycleRequired;
    } else if (!isPositiveInteger(interval)) {
      errors.pmCycleInterval = t.intervalPositiveInteger;
    }
  }

  return errors;
};
