import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type {
  DecisionResponse,
  DecisionView,
  LocationResponse,
  LotDetailResponse,
  LotHoldResponse,
  LotStatusResponse,
  NonconformanceResponse,
  PageMeta,
  SelectOption,
  StockReinstatementCreate,
  StockReinstatementResponse,
  WarehouseResponse,
} from './types';
import { toDecisionView } from './types';

type Client = ApiClient['client'];

export interface CandidateQuery {
  warehouseId?: number;
  reinstatable: true;
  followUpPending: true;
  page?: number;
  size: number;
}

export interface CandidateList {
  items: DecisionView[];
  page: PageMeta;
}

const ROOT = 'stock-reinstatement';
export const reinstatementKeys = {
  all: [ROOT] as const,
  candidates: (query: CandidateQuery) => [ROOT, 'candidates', query] as const,
  decision: (id: number | null) => [ROOT, 'decision', id] as const,
  nonconformance: (id: number | null) => [ROOT, 'nonconformance', id] as const,
  lot: (id: number | null) => [ROOT, 'lot', id] as const,
  lotStatus: (id: number | null) => [ROOT, 'lot-status', id] as const,
  holds: (id: number | null) => [ROOT, 'holds', id] as const,
  locations: (id: number | null) => [ROOT, 'locations', id] as const,
};

export const useCandidates = (query: CandidateQuery): UseQueryResult<CandidateList> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: reinstatementKeys.candidates(query),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/quality/disposition-decisions', { params: { query } }),
      );
      return { items: data.items.map(toDecisionView), page: data.page };
    },
  });
};

export const useDecision = (id: number | null): UseQueryResult<DecisionView> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: reinstatementKeys.decision(id),
    enabled: id !== null,
    queryFn: async () => {
      if (id === null) throw new Error('판정을 고르기 전에는 상세를 조회하지 않습니다.');
      const data = await runRequest(() =>
        client.GET('/quality/disposition-decisions/{dispositionDecisionId}', {
          params: { path: { dispositionDecisionId: id } },
        }),
      );
      return toDecisionView(data);
    },
  });
};

const useSelectedQuery = <TData>(
  key: readonly unknown[],
  enabled: boolean,
  fetcher: (client: Client) => Promise<TData>,
): UseQueryResult<TData> => {
  const { client } = useApiClient();
  return useQuery({ queryKey: key, enabled, queryFn: () => fetcher(client) });
};

export const useNonconformance = (id: number | null): UseQueryResult<NonconformanceResponse> =>
  useSelectedQuery(reinstatementKeys.nonconformance(id), id !== null, async (client) => {
    if (id === null) throw new Error('부적합을 고르기 전에는 조회하지 않습니다.');
    return runRequest(() =>
      client.GET('/quality/nonconformances/{nonconformanceId}', {
        params: { path: { nonconformanceId: id } },
      }),
    );
  });

export const useLotDetail = (lotId: number | null): UseQueryResult<LotDetailResponse> =>
  useSelectedQuery(reinstatementKeys.lot(lotId), lotId !== null, async (client) => {
    if (lotId === null) throw new Error('LOT을 고르기 전에는 조회하지 않습니다.');
    return runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }));
  });

export const useLotStatus = (
  lotId: number | null,
  itemId: number | null,
  lotNo: string | null,
): UseQueryResult<LotStatusResponse | null> =>
  useSelectedQuery(reinstatementKeys.lotStatus(lotId), lotId !== null, async (client) => {
    if (lotId === null || itemId === null || lotNo === null) {
      throw new Error('LOT 식별값이 서기 전에는 상태를 조회하지 않습니다.');
    }
    const data = await runRequest(() =>
      client.GET('/quality/lot-statuses', {
        params: { query: { itemId, lotTypeCode: 'PRODUCT', q: lotNo, size: 50 } },
      }),
    );
    return data.items.find((item) => item.lotId === lotId) ?? null;
  });

export const useOpenHolds = (lotId: number | null): UseQueryResult<LotHoldResponse[]> =>
  useSelectedQuery(reinstatementKeys.holds(lotId), lotId !== null, async (client) => {
    if (lotId === null) throw new Error('LOT을 고르기 전에는 보류를 조회하지 않습니다.');
    const data = await runRequest(() =>
      client.GET('/quality/lot-holds', { params: { query: { lotId, open: true } } }),
    );
    return data.items;
  });

export interface Lookups {
  warehouses: WarehouseResponse[];
  releaseReasons: SelectOption[];
  reinstatementReasons: SelectOption[];
  uoms: SelectOption[];
}

const nameOf = (value: string | null | undefined, fallback: string): string =>
  value === undefined || value === null || value.trim() === '' ? fallback : value;

export const useLookups = (): UseQueryResult<Lookups> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [ROOT, 'lookups'],
    queryFn: async () => {
      const [warehouses, releaseReasons, reinstatementReasons, uoms] = await Promise.all([
        runRequest(() =>
          client.GET('/mdm/warehouses', {
            params: { query: { includeInactive: false, size: 200 } },
          }),
        ),
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupCode: 'LOT_HOLD_RELEASE_REASON' } },
          }),
        ),
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupCode: 'STOCK_REINSTATEMENT_REASON' } },
          }),
        ),
        runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
      ]);
      const codeOptions = (items: typeof releaseReasons.items): SelectOption[] =>
        items
          .filter((item) => item.isActive)
          .map((item) => ({
            value: item.code,
            label: nameOf(item.nameKo ?? item.codeName, item.code),
          }));
      return {
        warehouses: warehouses.items,
        releaseReasons: codeOptions(releaseReasons.items),
        reinstatementReasons: codeOptions(reinstatementReasons.items),
        uoms: uoms.items.map((uom) => ({ value: String(uom.uomId), label: uom.uomCode })),
      };
    },
  });
};

export const useLocations = (warehouseId: number | null): UseQueryResult<LocationResponse[]> =>
  useSelectedQuery(
    reinstatementKeys.locations(warehouseId),
    warehouseId !== null,
    async (client) => {
      if (warehouseId === null) throw new Error('창고를 고르기 전에는 위치를 조회하지 않습니다.');
      const data = await runRequest(() =>
        client.GET('/mdm/locations', {
          params: { query: { warehouseId, includeInactive: false, size: 200 } },
        }),
      );
      return data.items;
    },
  );

export const useReinstate = (
  onSuccess: (data: StockReinstatementResponse) => void,
): MasterWriteResult<StockReinstatementCreate> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.POST('/logistics/stock-reinstatements', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [reinstatementKeys.all],
    knownFields: [
      'dispositionDecisionId',
      'lot',
      'lotHoldId',
      'toWarehouseId',
      'toLocationId',
      'qty',
      'uomId',
      'releaseReasonCode',
      'reasonCode',
      'businessDate',
      'occurredAt',
      'remarks',
    ],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
