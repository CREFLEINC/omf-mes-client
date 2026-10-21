import { createIdempotencyKey, type ApiClient } from '@omf-mes/api-client';

import { runRequest, runRequestWithResponse, toApiError } from '../../../patterns/request';
import type {
  ProductionPlanDraftErrors,
  ProductionPlanDraftField,
} from '../../production-plan/editor-model';
import {
  prepareProductionPlanRow,
  type ProductionPlanEditorStateRow,
} from '../../production-plan/editor-state';
import { toProductionPlanFact } from '../../production-plan/queries';
import type { ProductionPlanFact } from '../../production-plan/types';
import { apiErrorText } from '../release-runner';

/**
 * 생산계획 단계의 저장과 전개 확정(T-W-C 중간 단계의 확정). 행마다 따로 저장하지 않고 하단 바 동작 하나로
 * 바뀐 줄을 저장한 뒤 작성 중 계획을 확정한다. 서버 호출과 검증은 기존 생산계획 모델을 쓴다.
 */
type Client = ApiClient['client'];

const DRAFT_FIELDS: readonly ProductionPlanDraftField[] = [
  'planDate',
  'plannedQty',
  'bomId',
  'routingId',
  'plannedLineId',
  'remarks',
];

export interface PlanRowFailure {
  key: string;
  errors: ProductionPlanDraftErrors;
  message: string | null;
}

export interface PlanRunResult {
  saved: { key: string; plan: ProductionPlanFact }[];
  failures: PlanRowFailure[];
  confirmed: number;
}

const fieldErrors = (cause: unknown): { errors: ProductionPlanDraftErrors; message: string } => {
  const error = toApiError(cause);
  const errors: ProductionPlanDraftErrors = {};
  if (error.kind === 'validation') {
    for (const item of error.errors) {
      const field = DRAFT_FIELDS.find((name) => name === item.field);
      if (field !== undefined) errors[field] = { message: item.message };
    }
  }
  return { errors, message: apiErrorText(error) };
};

const etagOf = async (client: Client, productionPlanId: number): Promise<string> => {
  const detail = await runRequestWithResponse(() =>
    client.GET('/planning/production-plans/{productionPlanId}', {
      params: { path: { productionPlanId } },
    }),
  );
  return detail.response.headers.get('ETag') ?? '';
};

/** 바뀐 줄을 저장한다. `confirm`이면 저장에 성공한 뒤 확정 전 계획을 모두 확정한다. */
export const runPlanStep = async (
  client: Client,
  rows: readonly ProductionPlanEditorStateRow[],
  context: { productionOrderId: number; uomId: number },
  confirm: boolean,
): Promise<PlanRunResult> => {
  const result: PlanRunResult = { saved: [], failures: [], confirmed: 0 };
  const planIds: number[] = [];
  for (const row of rows) {
    if (row.confirmed) continue;
    const prepared = prepareProductionPlanRow(row, context);
    if (!prepared.ok) {
      result.failures.push({ key: row.key, errors: prepared.errors, message: null });
      continue;
    }
    try {
      const command = prepared.command;
      if (command.kind === 'create') {
        const created = await runRequest(() =>
          client.POST('/planning/production-plans', {
            params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
            body: command.body,
          }),
        );
        const plan = toProductionPlanFact(created);
        result.saved.push({ key: row.key, plan });
        planIds.push(plan.productionPlanId);
      } else if (command.kind === 'update' && row.productionPlanId !== null) {
        const id = row.productionPlanId;
        const body = command.body;
        const updated = await runRequest(async () =>
          client.PUT('/planning/production-plans/{productionPlanId}', {
            params: {
              path: { productionPlanId: id },
              header: {
                'Idempotency-Key': createIdempotencyKey(),
                'If-Match': await etagOf(client, id),
              },
            },
            body,
          }),
        );
        result.saved.push({ key: row.key, plan: toProductionPlanFact(updated) });
        planIds.push(id);
      } else if (row.productionPlanId !== null) {
        planIds.push(row.productionPlanId);
      }
    } catch (cause) {
      const { errors, message } = fieldErrors(cause);
      result.failures.push({ key: row.key, errors, message });
    }
  }
  if (!confirm || result.failures.length > 0) return result;
  for (const id of planIds) {
    try {
      await runRequest(async () =>
        client.POST('/planning/production-plans/{productionPlanId}:confirm', {
          params: {
            path: { productionPlanId: id },
            header: {
              'Idempotency-Key': createIdempotencyKey(),
              'If-Match': await etagOf(client, id),
            },
          },
        }),
      );
      result.confirmed += 1;
    } catch (cause) {
      const row =
        rows.find((item) => item.productionPlanId === id) ??
        result.saved.find((item) => item.plan.productionPlanId === id);
      result.failures.push({
        key: row?.key ?? String(id),
        errors: {},
        message: fieldErrors(cause).message,
      });
    }
  }
  return result;
};

/** 계획 하나를 지운다(작성 중 계획만). */
export const deletePlan = async (
  client: Client,
  productionPlanId: number,
): Promise<string | null> => {
  try {
    await runRequest(async () =>
      client.DELETE('/planning/production-plans/{productionPlanId}', {
        params: {
          path: { productionPlanId },
          header: {
            'Idempotency-Key': createIdempotencyKey(),
            'If-Match': await etagOf(client, productionPlanId),
          },
        },
      }),
    );
    return null;
  } catch (cause) {
    return apiErrorText(toApiError(cause));
  }
};
