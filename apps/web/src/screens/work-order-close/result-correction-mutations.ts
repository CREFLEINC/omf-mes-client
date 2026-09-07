import type { ApiError, components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { workOrderCloseKeys } from './queries';
import type { ProductionResultCorrect } from './result-correction-model';

type ProductionResult = components['schemas']['ProductionResult'];
type ApprovalRequestCreate = components['schemas']['ApprovalRequestCreate'];
type ApprovalRequestRef = components['schemas']['ApprovalRequestRef'];

const CORRECT_FIELDS = [
  'reasonCode',
  'note',
  'goodQty',
  'defectQty',
  'holdQty',
  'scrapQty',
  'reworkQty',
] as const;

/**
 * 계약은 승인 필요를 별도 응답 코드가 아니라 정정의 400으로 알린다. 필드 오류는 공통 쓰기
 * 훅이 이미 인라인으로 떼므로, 여기 남은 화면 단위 400만 승인 상신 동선으로 넘긴다.
 */
export const isProductionResultApprovalRequired = (error: ApiError | null): boolean =>
  (error?.kind === 'http' && error.status === 400) ||
  (error?.kind === 'validation' && error.errors.some((item) => item.scope === 'screen'));

export const useProductionResultCorrection = (
  productionResultId: number,
  workOrderId: number,
  onSuccess: (result: ProductionResult) => void,
): MasterWriteResult<ProductionResultCorrect> => {
  const { client } = useApiClient();

  return useMasterWrite<ProductionResultCorrect, ProductionResult>({
    request: (body, headers) =>
      client.POST('/production/production-results/{productionResultId}:correct', {
        params: {
          path: { productionResultId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [workOrderCloseKeys.results(workOrderId)],
    knownFields: CORRECT_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

export const useProductionResultApprovalRequest = (
  productionResultId: number,
  onSuccess: (request: ApprovalRequestRef) => void,
): MasterWriteResult<ApprovalRequestCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<ApprovalRequestCreate, ApprovalRequestRef>({
    request: (body, headers) =>
      client.POST('/production/production-results/{productionResultId}:request-approval', {
        params: {
          path: { productionResultId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [],
    knownFields: ['reason'],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
