import { createIdempotencyKey, type ApiClient, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { ApiRequestError, runRequest, toApiError } from '../../../patterns/request';
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
  /** 서버가 돌려준 실패. 409(충돌)면 화면이 다시 불러오기를 안내한다. */
  error: ApiError | null;
}

export interface PlanRunResult {
  saved: { key: string; plan: ProductionPlanFact }[];
  failures: PlanRowFailure[];
  confirmed: number;
}

const fieldErrors = (
  cause: unknown,
): { errors: ProductionPlanDraftErrors; message: string; error: ApiError } => {
  const error = toApiError(cause);
  const errors: ProductionPlanDraftErrors = {};
  if (error.kind === 'validation') {
    for (const item of error.errors) {
      const field = DRAFT_FIELDS.find((name) => name === item.field);
      if (field !== undefined) errors[field] = { message: item.message };
    }
  }
  return { errors, message: apiErrorText(error), error };
};

/** 토큰이 없어 보내지 않은 쓰기. 빈 If-Match를 보내지 않고 다시 불러오기를 안내한다(`requireIfMatch`와 같은 판단). */
const staleToken = (): ApiError => ({
  kind: 'validation',
  errors: [{ scope: 'screen', code: 'STALE_TOKEN', message: messages.save.staleToken }],
});

/**
 * 편집 세션에 불러온 시점의 판을 If-Match로 쓴다. 요청 직전에 다시 받은 판을 쓰면 그사이 다른 사람이나
 * 자동 계획이 바꾼 계획을 409 없이 덮어쓴다. 판이 없으면 보내지 않는다.
 */
const ifMatchOf = (versionNo: number | null | undefined): string => {
  if (versionNo === null || versionNo === undefined) throw new ApiRequestError(staleToken());
  return String(versionNo);
};

/** 바뀐 줄을 저장한다. `confirm`이면 저장에 성공한 뒤 확정 전 계획을 모두 확정한다. */
export const runPlanStep = async (
  client: Client,
  rows: readonly ProductionPlanEditorStateRow[],
  context: { productionOrderId: number; uomId: number },
  confirm: boolean,
): Promise<PlanRunResult> => {
  const result: PlanRunResult = { saved: [], failures: [], confirmed: 0 };
  /* 확정할 계획과 그 판. 방금 저장한 계획은 저장 응답의 판을 쓴다. */
  const toConfirm = new Map<number, number | null>();
  for (const row of rows) {
    if (row.confirmed) continue;
    const prepared = prepareProductionPlanRow(row, context);
    if (!prepared.ok) {
      result.failures.push({ key: row.key, errors: prepared.errors, message: null, error: null });
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
        toConfirm.set(plan.productionPlanId, plan.versionNo);
      } else if (command.kind === 'update' && row.productionPlanId !== null) {
        const id = row.productionPlanId;
        const body = command.body;
        const ifMatch = ifMatchOf(row.versionNo);
        const updated = await runRequest(() =>
          client.PUT('/planning/production-plans/{productionPlanId}', {
            params: {
              path: { productionPlanId: id },
              header: { 'Idempotency-Key': createIdempotencyKey(), 'If-Match': ifMatch },
            },
            body,
          }),
        );
        const plan = toProductionPlanFact(updated);
        result.saved.push({ key: row.key, plan });
        toConfirm.set(id, plan.versionNo);
      } else if (row.productionPlanId !== null) {
        toConfirm.set(row.productionPlanId, row.versionNo);
      }
    } catch (cause) {
      result.failures.push({ key: row.key, ...fieldErrors(cause) });
    }
  }
  if (!confirm || result.failures.length > 0) return result;
  for (const [id, versionNo] of toConfirm) {
    try {
      const ifMatch = ifMatchOf(versionNo);
      await runRequest(() =>
        client.POST('/planning/production-plans/{productionPlanId}:confirm', {
          params: {
            path: { productionPlanId: id },
            header: { 'Idempotency-Key': createIdempotencyKey(), 'If-Match': ifMatch },
          },
        }),
      );
      result.confirmed += 1;
    } catch (cause) {
      const row =
        rows.find((item) => item.productionPlanId === id) ??
        result.saved.find((item) => item.plan.productionPlanId === id);
      const { message, error } = fieldErrors(cause);
      result.failures.push({ key: row?.key ?? String(id), errors: {}, message, error });
    }
  }
  return result;
};

/** 계획 하나를 지운다(작성 중 계획만). 불러온 시점의 판으로 잠근다. 실패하면 그 오류를 돌려준다. */
export const deletePlan = async (
  client: Client,
  productionPlanId: number,
  versionNo: number | null,
): Promise<ApiError | null> => {
  try {
    const ifMatch = ifMatchOf(versionNo);
    await runRequest(() =>
      client.DELETE('/planning/production-plans/{productionPlanId}', {
        params: {
          path: { productionPlanId },
          header: { 'Idempotency-Key': createIdempotencyKey(), 'If-Match': ifMatch },
        },
      }),
    );
    return null;
  } catch (cause) {
    return toApiError(cause);
  }
};
