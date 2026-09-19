import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
import { runRequest } from '../../patterns/request';

export const LOT_TYPE_GROUP_CODE = 'LOT_TYPE';
export const LOT_STATUS_GROUP_CODE = 'LOT_STATUS';
/** 보류 사유. 화면이 코드 대신 이름을 보이려고 읽는다(표시 전용). */
export const LOT_HOLD_REASON_GROUP_CODE = 'LOT_HOLD_REASON';
export type LotCodeGroupCode =
  typeof LOT_TYPE_GROUP_CODE | typeof LOT_STATUS_GROUP_CODE | typeof LOT_HOLD_REASON_GROUP_CODE;

export interface LotCodeOption {
  code: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
}

export interface LotCodeOptionsResult {
  items: readonly LotCodeOption[];
  isSeeded: boolean;
  isTruncated: boolean;
}

export const lotCodeKeys = {
  values: (codeGroupCode: LotCodeGroupCode) =>
    ['lot-status-history', 'code-values', codeGroupCode] as const,
};

type Client = ApiClient['client'];

const fetchLotCodeOptions = async (
  client: Client,
  codeGroupCode: LotCodeGroupCode,
): Promise<LotCodeOptionsResult> => {
  const data = await runRequest(() =>
    client.GET('/mdm/code-values', { params: { query: { codeGroupCode } } }),
  );

  return {
    items: data.items.map((item) => ({
      code: item.code,
      /* 표시명은 고른 언어의 다국어 컬럼이 먼저, 기본 이름이 fallback(G-33). */
      label: masterName(item, item.codeName),
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    })),
    isSeeded: data.items.length > 0,
    isTruncated: data.page.total > data.items.length,
  };
};

export const useLotCodeOptions = (
  codeGroupCode: LotCodeGroupCode,
): UseQueryResult<LotCodeOptionsResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotCodeKeys.values(codeGroupCode),
    queryFn: () => fetchLotCodeOptions(client, codeGroupCode),
  });
};

export const useLotTypeOptions = (): UseQueryResult<LotCodeOptionsResult> =>
  useLotCodeOptions(LOT_TYPE_GROUP_CODE);

export const useLotStatusOptions = (): UseQueryResult<LotCodeOptionsResult> =>
  useLotCodeOptions(LOT_STATUS_GROUP_CODE);

export const useLotHoldReasonOptions = (): UseQueryResult<LotCodeOptionsResult> =>
  useLotCodeOptions(LOT_HOLD_REASON_GROUP_CODE);

/**
 * 코드를 기준값 이름으로 푼다. 목록에 없거나 아직 못 받았으면 코드를 그대로 둔다 —
 * 짐작한 이름을 보이는 것보다 원래 값을 보이는 쪽이 안전하다.
 */
export const codeName = (
  options: readonly Pick<LotCodeOption, 'code' | 'label'>[] | undefined,
  code: string,
): string => options?.find((option) => option.code === code)?.label ?? code;

/**
 * LOT 상태 칩의 색(사용자 지시 2026-09-19). ⭐ 「정상」 초록 · 「검사 대기」 노랑 · 「불량」 빨강.
 * 「폐기」는 끝난 상태라 무채색으로 둔다.
 * 코드는 계약이 적은 LOT_STATUS 값이다(NORMAL·DEFECTIVE·INSPECTION_PENDING·SCRAPPED).
 */
export const lotStatusTone = (statusCode: string): 'success' | 'warning' | 'error' | undefined => {
  if (statusCode === 'NORMAL') return 'success';
  if (statusCode === 'INSPECTION_PENDING') return 'warning';
  if (statusCode === 'DEFECTIVE') return 'error';
  return undefined;
};
