import { messages } from '@omf-mes/i18n';

import type { ProcessFormValues } from './types';

const t = messages.routing.validation;

export const PROCESS_FORM_FIELDS = ['processCode', 'processName', 'processTypeCode'] as const;

export const validateProcess = (
  values: ProcessFormValues,
): Partial<Record<keyof ProcessFormValues, string>> => {
  const errors: Partial<Record<keyof ProcessFormValues, string>> = {};

  if (values.processCode.trim() === '') errors.processCode = t.processCodeBlank;
  if (values.processName.trim() === '') errors.processName = t.processNameBlank;
  if (values.processTypeCode === '') errors.processTypeCode = t.processTypeRequired;

  return errors;
};
