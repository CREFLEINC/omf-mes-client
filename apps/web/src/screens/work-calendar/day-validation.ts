import { messages } from '@omf-mes/i18n';

import type { DayFormValues } from './types';

const t = messages.workCalendar.dayValidation;

/**
 * 서버가 준 필드 오류를 **인라인으로 낼 수 있는** 칸 이름.
 *
 * ⛔ **오류를 그릴 자리가 없는 칸을 넣지 않는다** — 넣으면 그 오류는 인라인으로 분류된 뒤
 * 아무 데도 그려지지 않아 어디에도 표시되지 않는 오류가 된다.
 */
export const DAY_FORM_FIELDS: readonly string[] = [
  'dayTypeCode',
  'startTime',
  'endTime',
  'reasonCode',
  'remarks',
];

/** `HH:MM` — 24시간 표기. 계약의 예(`08:00`)가 그 모양이다. */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * ⭐ **부분 가동은 휴무가 아니다** — 반일 근무를 담는 갈래라 시각 두 칸이 **짝**이다.
 * 하나만 있으면 언제부터 언제까지인지 알 수 없어 조업시간을 아무도 셀 수 없다.
 *
 * ⛔ **같은 시각도 받지 않는다.** 길이가 0인 조업시간은 부분 가동이 아니라 휴무이고,
 * 그렇게 저장하면 가동률이 「부분 가동인데 0시간」이라는 모순 상태가 된다.
 *
 * ⛔ **사유는 재지 않는다** — 계약이 선택으로 두었고, 값 목록도 아직 없다(`omf-mes#145`).
 */
export const validateDay = (values: DayFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.dayTypeCode === '') {
    errors.dayTypeCode = t.dayTypeRequired;

    return errors;
  }

  if (values.dayTypeCode !== 'PARTIAL') return errors;

  const start = values.startTime.trim();
  const end = values.endTime.trim();

  if (start === '') errors.startTime = t.timesRequired;
  if (end === '') errors.endTime = t.timesRequired;
  if (start === '' || end === '') return errors;

  if (!TIME.test(start)) errors.startTime = t.timeFormat;
  if (!TIME.test(end)) errors.endTime = t.timeFormat;
  if (errors.startTime !== undefined || errors.endTime !== undefined) return errors;

  /* 자릿수가 맞는 `HH:MM` 은 글자 차례가 곧 시각 차례다 — 따로 셈하지 않는다. */
  if (end <= start) errors.endTime = t.endAfterStart;

  return errors;
};
