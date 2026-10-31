import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { purchaseOrderKeys } from './queries';

const t = messages.erpPurchaseOrder;

/**
 * 외자 발주 통관번호 받아오기(omf-all-around#206 · 서버 장부 P-143 · omf-mes-server#872 · 계약 server #913).
 *
 * 서버가 ERP 에서 통관번호를 받아 발주 라인에 저장한다. 끝나면 발주 상세를 다시 읽어 라인 칸에 보인다.
 */

/** 라인별 결과 — `SAVED` 받아 저장 · `NOT_FOUND` ERP 에 없음(저장된 값은 그대로) · `MULTIPLE` 여럿이라 저장 안 함. */
export const CUSTOMS_RESULT = {
  saved: 'SAVED',
  notFound: 'NOT_FOUND',
  multiple: 'MULTIPLE',
} as const;

export type CustomsClearanceFetchResult = components['schemas']['CustomsClearanceFetchResult'];

export const useFetchCustomsClearances = (): UseMutationResult<
  CustomsClearanceFetchResult,
  Error,
  number
> => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (purchaseOrderId: number) =>
      runRequest(() =>
        client.POST(
          '/integration/erp-sync/purchase-orders/{purchaseOrderId}/customs-clearances:fetch',
          { params: { path: { purchaseOrderId } } },
        ),
      ),
    onSuccess: (data) =>
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(data.purchaseOrderId) }),
  });
};

/** 라인 칸의 표시 — 「번호 / 순번」. 번호가 없으면 null(「-」는 부르는 쪽이 낸다). */
export const formatCustomsClearance = (
  no: string | null | undefined,
  seq: number | null | undefined,
): string | null => {
  if (no === null || no === undefined || no.trim() === '') return null;
  return seq === null || seq === undefined ? no : `${no} / ${String(seq)}`;
};

/** 결과를 한 줄로 — 「3줄 중 2줄 받음 · 1줄 통관 전」. */
export const summarizeCustomsResult = (result: CustomsClearanceFetchResult): string => {
  const count = (code: string) => result.lines.filter((line) => line.result === code).length;
  return t.customs.summary(
    result.lines.length,
    count(CUSTOMS_RESULT.saved),
    count(CUSTOMS_RESULT.notFound),
    count(CUSTOMS_RESULT.multiple),
  );
};

/**
 * 실패 문구. 외자가 아니거나 서버에 통관 조회가 설정되지 않으면 400 `STATE_LOCKED` 다 — 서버 문구를 그대로 보인다.
 * 서버 문구가 없으면 갈래별 공용 문구로.
 */
export const customsErrorMessage = (error: ApiError, httpStatus: number | undefined): string => {
  if (error.kind === 'stateLocked' || error.kind === 'validation') {
    const first = error.errors[0]?.message;
    if (first !== undefined && first !== '') return first;
  }
  if (error.kind === 'http' && error.message !== undefined && error.message !== '') {
    return error.message;
  }
  if (httpStatus === 404 || (error.kind === 'http' && error.status === 404)) {
    return t.customs.notFoundOrder;
  }
  return t.loadFailedDescription;
};
