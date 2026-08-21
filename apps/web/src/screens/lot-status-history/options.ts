import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

export const LOT_TYPE_GROUP_CODE = 'LOT_TYPE';
export const LOT_STATUS_GROUP_CODE = 'LOT_STATUS';
export type LotCodeGroupCode = typeof LOT_TYPE_GROUP_CODE | typeof LOT_STATUS_GROUP_CODE;

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
      label: item.codeName,
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
