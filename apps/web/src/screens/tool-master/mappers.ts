import type { components } from '@omf-mes/api-client';

import { PENDING_CODE_VALUE, PM_TRIGGER, usesDateAxis } from './code-options';
import type { Mold, ToolFormValues } from './types';

type MoldCreate = components['schemas']['MoldCreate'];
type MoldUpdate = components['schemas']['MoldUpdate'];

/** 수 칸의 문자열을 계약의 수로. 빈 칸은 「없음」이다. */
const textToOptionalNumber = (value: string): number | null =>
  value.trim() === '' ? null : Number(value);

const numberToText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

/** 상세에서 받은 툴을 폼 값으로. */
export const formValuesFrom = (tool: Mold): ToolFormValues => ({
  moldCode: tool.moldCode,
  moldName: tool.moldName,
  toolTypeCode: tool.toolTypeCode,
  plantId: String(tool.plantId),
  cavityCount: String(tool.cavityCount),
  guaranteedShotCount: numberToText(tool.guaranteedShotCount),
  pmTriggerTypeCode: tool.pmTriggerTypeCode,
  pmCycleInterval: numberToText(tool.pmCycleInterval),
  pmCycleUnitCode: tool.pmCycleUnitCode ?? '',
});

/**
 * 신규 툴 폼의 초기값. 공장은 목록에서 고른 것이 있으면 그것을 따른다.
 *
 * ⭐ **캐비티 수의 처음 값은 `1` 이다** — 계약의 기본값이고, 금형이 아닌 도구도 하나로 세는 것이
 * 맞다. 빈 칸으로 두면 금형이 아닌 도구를 등록할 때마다 뜻 없는 값을 물어보게 된다.
 * ⭐ **판정 기준의 처음 값은 「하지 않음」이다** — 계약의 기본값이다. 예방보전을 하겠다는 것은
 * 사용자가 고르는 것이지 화면이 가정할 것이 아니다.
 */
export const emptyFormValues = (plantId: string): ToolFormValues => ({
  moldCode: '',
  moldName: '',
  toolTypeCode: PENDING_CODE_VALUE,
  plantId,
  cavityCount: '1',
  guaranteedShotCount: '',
  pmTriggerTypeCode: PM_TRIGGER.none,
  pmCycleInterval: '',
  pmCycleUnitCode: '',
});

/**
 * 툴 수정 요청 본문.
 *
 * ⛔ **`plantId`·`statusCode`·`currentShotCount`·`lastPmDate` 는 실리지 않는다** — 계약이 수정
 * 본문에 두지 않았다. 누계 타발수는 실적이 정하고, 상태는 사용 중지·폐기가 정한다(스펙 §6).
 *
 * ⭐ **날짜 축을 쓰지 않으면 주기를 비운다.** 짝 제약이 「날짜 축일 때만 뜻이 있다」는 말이므로
 * 값을 남겨 두면 서버 자료가 모순 상태가 된다 — 타발수로만 판정하는데 6개월 주기가 붙은 꼴이다.
 * 폼에는 남겨 둔다(다시 날짜 축으로 바꾸면 방금 적은 것이 그대로 있다) —
 * **지우는 자리는 보낼 때 하나다.**
 *
 * ⛔ **적정타수의 빈 칸은 `null` 이지 `0` 이 아니다** — `0` 은 「이미 다 썼다」로 셈된다.
 */
export const toToolUpdate = (values: ToolFormValues, codeEditable: boolean): MoldUpdate => {
  const onDateAxis = usesDateAxis(values.pmTriggerTypeCode);

  return {
    ...(codeEditable ? { moldCode: values.moldCode.trim() } : {}),
    moldName: values.moldName.trim(),
    toolTypeCode: values.toolTypeCode,
    cavityCount: Number(values.cavityCount),
    guaranteedShotCount: textToOptionalNumber(values.guaranteedShotCount),
    pmTriggerTypeCode: values.pmTriggerTypeCode,
    pmCycleInterval: onDateAxis ? textToOptionalNumber(values.pmCycleInterval) : null,
    pmCycleUnitCode: onDateAxis ? values.pmCycleUnitCode : null,
  };
};

/** 툴 등록 요청 본문. 계약상 수정 본문에 `plantId` 를 더한 형태다. */
export const toToolCreate = (values: ToolFormValues): MoldCreate => ({
  ...toToolUpdate(values, true),
  moldCode: values.moldCode.trim(),
  plantId: Number(values.plantId),
});
