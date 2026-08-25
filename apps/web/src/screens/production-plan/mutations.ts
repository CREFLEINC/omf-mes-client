import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { workOrderKeys } from '../work-order/queries';
import { productionPlanDetailPath, productionPlanKeys, toProductionPlanFact } from './queries';
import type { ProductionPlanFact } from './types';

type ProductionPlan = components['schemas']['ProductionPlan'];
type ProductionPlanCreate = components['schemas']['ProductionPlanCreate'];
type ProductionPlanUpdate = components['schemas']['ProductionPlanUpdate'];

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

const PRODUCTION_PLAN_UPDATE_FIELDS = [
  'planDate',
  'plannedQty',
  'bomId',
  'routingId',
  'plannedLineId',
  'remarks',
] as const;

const PRODUCTION_PLAN_DELETE_FIELDS = [] as const;

export interface CreateProductionPlanOptions {
  onSuccess: (data: ProductionPlanFact) => void;
}

export interface UpdateProductionPlanOptions {
  productionPlanId: number;
  onSuccess: (data: ProductionPlanFact) => void;
}

export interface DeleteProductionPlanOptions {
  productionPlanId: number;
  onSuccess: () => void;
}

export interface ConfirmProductionPlanOptions {
  productionPlanId: number;
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

export const useUpdateProductionPlan = (
  options: UpdateProductionPlanOptions,
): MasterWriteResult<ProductionPlanUpdate> => {
  const { client } = useApiClient();

  return useMasterWrite<ProductionPlanUpdate, ProductionPlan>({
    request: (body, headers) =>
      client.PUT('/planning/production-plans/{productionPlanId}', {
        params: {
          path: { productionPlanId: options.productionPlanId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      }),
    etagPath: productionPlanDetailPath(options.productionPlanId),
    invalidateKeys: [productionPlanKeys.all],
    knownFields: PRODUCTION_PLAN_UPDATE_FIELDS,
    onSuccess: (data) => {
      options.onSuccess(toProductionPlanFact(data));
    },
  });
};

export const useDeleteProductionPlan = (
  options: DeleteProductionPlanOptions,
): MasterWriteResult<void> => {
  const { client } = useApiClient();

  return useMasterWrite<void, void>({
    request: (_variables, headers) =>
      client.DELETE('/planning/production-plans/{productionPlanId}', {
        params: {
          path: { productionPlanId: options.productionPlanId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    etagPath: productionPlanDetailPath(options.productionPlanId),
    invalidateKeys: [productionPlanKeys.all],
    knownFields: PRODUCTION_PLAN_DELETE_FIELDS,
    onSuccess: () => {
      options.onSuccess();
    },
  });
};

export const useConfirmProductionPlan = (
  options: ConfirmProductionPlanOptions,
): MasterWriteResult<void> => {
  const { client } = useApiClient();

  return useMasterWrite<void, ProductionPlan>({
    request: (_variables, headers) =>
      client.POST('/planning/production-plans/{productionPlanId}:confirm', {
        params: {
          path: { productionPlanId: options.productionPlanId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    etagPath: productionPlanDetailPath(options.productionPlanId),
    invalidateKeys: [productionPlanKeys.all, workOrderKeys.all],
    knownFields: [],
    onSuccess: (data) => {
      options.onSuccess(toProductionPlanFact(data));
    },
  });
};
