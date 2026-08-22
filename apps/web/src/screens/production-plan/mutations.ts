import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { productionPlanKeys, toProductionPlanFact } from './queries';
import type { ProductionPlanFact } from './types';

type ProductionPlan = components['schemas']['ProductionPlan'];
type ProductionPlanCreate = components['schemas']['ProductionPlanCreate'];

const PRODUCTION_PLAN_CREATE_FIELDS = [
  'productionOrderId',
  'planDate',
  'plannedQty',
  'uomId',
  'bomId',
  'routingId',
  'plannedLineId',
  'splitOfPlanId',
  'remarks',
] as const;

export interface CreateProductionPlanOptions {
  onSuccess: (data: ProductionPlanFact) => void;
}

export const useCreateProductionPlan = (
  options: CreateProductionPlanOptions,
): MasterWriteResult<ProductionPlanCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<ProductionPlanCreate, ProductionPlan>({
    request: (body, headers) =>
      client.POST('/planning/production-plans', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [productionPlanKeys.all],
    knownFields: PRODUCTION_PLAN_CREATE_FIELDS,
    onSuccess: (data) => {
      options.onSuccess(toProductionPlanFact(data));
    },
  });
};
