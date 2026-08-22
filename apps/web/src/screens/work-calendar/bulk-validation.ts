import { messages } from '@omf-mes/i18n';

import type { BulkFormValues } from './types';

const t = messages.workCalendar.bulkValidation;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 기간을 보내기 전에 잰다. **적용할 설정 자체는 하루 편집과 같은 판정을 쓴다** —
 * 두 벌을 두면 한쪽만 고쳐진다.
 */
export const validateBulkRange = (values: BulkFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};
  const from = values.from.trim();
  const to = values.to.trim();

  if (from === '') errors.from = t.rangeRequired;
  if (to === '') errors.to = t.rangeRequired;
  if (from === '' || to === '') return errors;

  if (!DATE.test(from)) errors.from = t.dateFormat;
  if (!DATE.test(to)) errors.to = t.dateFormat;
  if (errors.from !== undefined || errors.to !== undefined) return errors;

  /* 자릿수가 맞는 `YYYY-MM-DD` 는 글자 차례가 곧 날짜 차례다 — 따로 셈하지 않는다. */
  if (to < from) errors.to = t.endAfterStart;

  return errors;
};
