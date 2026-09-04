import type { components } from '@omf-mes/api-client';

import type { Process, ProcessFormValues } from './types';

type ProcessCreate = components['schemas']['ProcessCreate'];
type ProcessUpdate = components['schemas']['ProcessUpdate'];

export const emptyProcessFormValues = (): ProcessFormValues => ({
  processCode: '',
  processName: '',
  processTypeCode: '',
});

export const processToFormValues = (process: Process): ProcessFormValues => ({
  processCode: process.processCode,
  processName: process.processName,
  processTypeCode: process.processTypeCode,
});

export const isSameProcessValues = (left: ProcessFormValues, right: ProcessFormValues): boolean =>
  left.processCode === right.processCode &&
  left.processName === right.processName &&
  left.processTypeCode === right.processTypeCode;

export const toProcessCreate = (values: ProcessFormValues): ProcessCreate => ({
  processCode: values.processCode.trim(),
  processName: values.processName.trim(),
  processTypeCode: values.processTypeCode,
});

export const toProcessUpdate = (values: ProcessFormValues): ProcessUpdate => ({
  processCode: values.processCode.trim(),
  processName: values.processName.trim(),
  processTypeCode: values.processTypeCode,
});
