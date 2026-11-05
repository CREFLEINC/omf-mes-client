import { messages } from '@omf-mes/i18n';

import type { ProcessFormValues } from './types';

const t = messages.routing.validation;

export const PROCESS_FORM_FIELDS = ['processCode', 'processName', 'processTypeCode'] as const;

export const validateProcess = (
  values: ProcessFormValues,
): Partial<Record<keyof ProcessFormValues, string>> => {
  const errors: Partial<Record<keyof ProcessFormValues, string>> = {};

  /* 비어 있으면 「입력하세요」, 공백만 있으면 「공백만으로는 안 된다」 — 막는 규칙은 같다(#231). */
  if (values.processCode === '') errors.processCode = t.processCodeRequired;
  else if (values.processCode.trim() === '') errors.processCode = t.processCodeBlank;
  if (values.processName === '') errors.processName = t.processNameRequired;
  else if (values.processName.trim() === '') errors.processName = t.processNameBlank;
  if (values.processTypeCode === '') errors.processTypeCode = t.processTypeRequired;

  return errors;
};
