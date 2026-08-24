import type { components } from '@omf-mes/api-client';

import type { WorkOrderCloseRemainderDisposition } from './close-input-draft';

type WorkOrderClose = components['schemas']['WorkOrderClose'];
type WorkOrderCloseCompletionJudgment =
  components['schemas']['WorkOrderProgress']['completionJudgmentCode'];

export interface WorkOrderCloseRequestInput {
  completionJudgmentCode: WorkOrderCloseCompletionJudgment;
  remainderDispositionCode: WorkOrderCloseRemainderDisposition | null;
  reasonCode: string;
  erpSendItems: readonly string[];
}

export const toWorkOrderCloseRequest = (
  input: WorkOrderCloseRequestInput,
): WorkOrderClose | null => {
  const erpSendItems = [...input.erpSendItems];
  const reasonCode = input.reasonCode.trim();

  if (input.completionJudgmentCode === 'UNDER') {
    if (input.remainderDispositionCode === null || reasonCode === '') {
      return null;
    }

    return {
      remainderDispositionCode: input.remainderDispositionCode,
      reasonCode,
      erpSendItems,
    };
  }

  if (input.completionJudgmentCode === 'OVER') {
    return reasonCode === '' ? null : { reasonCode, erpSendItems };
  }

  return { erpSendItems };
};
