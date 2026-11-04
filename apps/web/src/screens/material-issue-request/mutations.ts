import type {
  MaterialIssueRequestCreateResultForward,
  PlannedStockConflictDetail,
} from '@omf-mes/api-client';
import { useRef } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { materialIssueRequestKeys } from './queries';
import { toCreatedRequestView, type CreatedRequestView } from './types';
import type { MaterialIssueRequestCreate } from './types';
import { HEADER_FORM_FIELDS } from './validation';

export const PLANNED_STOCK_CONFLICT = 'PLANNED_STOCK_CONFLICT';

/** 409 `PLANNED_STOCK_CONFLICT` 를 화면이 그릴 모양 — 품목별 넘는 양과 가져갈 수 있는가. */
export interface PlannedStockConflict {
  details: PlannedStockConflictDetail[];
  /** 모든 품목이 가져갈 수 있어야 「그래도 요청」을 연다(사유 판단은 서버 값, 화면은 사유 글자를 보지 않는다). */
  overridable: boolean;
  /** 「재고 있는 생산 창고 없음」 품목이 있다 — 막힘. */
  noStockedWarehouse: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * 오류 본문에서 예정 재고 충돌을 꺼낸다 — 서버 S8e `PlannedStockConflictResponse`
 * (`{ errors: [{ code: 'PLANNED_STOCK_CONFLICT' }], plannedStockConflicts: [...] }`). 그 밖의 409 는 `null`.
 */
export const readPlannedStockConflict = (body: unknown): PlannedStockConflict | null => {
  if (!isRecord(body) || !Array.isArray(body.plannedStockConflicts)) return null;
  const details = body.plannedStockConflicts.filter(
    isRecord,
  ) as unknown as PlannedStockConflictDetail[];
  return {
    details,
    overridable: details.length > 0 && details.every((detail) => detail.overridable),
    noStockedWarehouse: details.some((detail) => detail.noStockedWarehouse === true),
  };
};

export const useMaterialIssueRequestMutation = (options: {
  onSuccess: (data: CreatedRequestView) => void;
  /** 409 예정 재고 충돌 — 경고 창(가져갈 수 있음) 또는 막힘 창. */
  onPlannedStockConflict: (conflict: PlannedStockConflict) => void;
}): MasterWriteResult<MaterialIssueRequestCreate> => {
  const { client } = useApiClient();
  /** 성공 결과를 그릴 때 보낸 본문(가져가기 · 미배정 행)을 함께 본다. */
  const lastBodyRef = useRef<MaterialIssueRequestCreate | null>(null);

  return useMasterWrite<MaterialIssueRequestCreate, MaterialIssueRequestCreateResultForward>({
    request: async (body, headers) => {
      lastBodyRef.current = body;
      const result = await client.POST('/logistics/material-issue-requests', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      });
      if (result.response.status === 409) {
        const conflict = readPlannedStockConflict(result.error);
        if (conflict !== null) options.onPlannedStockConflict(conflict);
      }
      return result;
    },
    etagPath: null,
    invalidateKeys: [materialIssueRequestKeys.existingAll],
    knownFields: HEADER_FORM_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      options.onSuccess(toCreatedRequestView(data, lastBodyRef.current ?? {}));
    },
  });
};
