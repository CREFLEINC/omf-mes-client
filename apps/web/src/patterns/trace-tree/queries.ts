import { messages, named } from '@omf-mes/i18n';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiClient } from '../api-context';
import { fetchAllPages } from '../fetch-all-pages';
import { masterName } from '../master-name';
import { plantsInScope } from '../oa-access';
import { REFERENCE_PAGE_SIZE, type ReferenceSource } from '../reference-picker';
import { runRequest } from '../request';
import { useSession } from '../session';
import type { ListCondition } from './lot-list-state';
import type {
  BackwardTree,
  ForwardTree,
  TraceDirection,
  TraceLotPage,
  TraceStartMatch,
} from './types';

/** 추적 두 화면의 조회(피처 015 계약 §1~§4). 내보내기는 `export.tsx`. */
type Client = ReturnType<typeof useApiClient>['client'];

const t = messages.traceTree;

/** 조건 목록 한 쪽 크기(계약 §1 — 최대 100). */
export const LIST_PAGE_SIZE = 100;

export const traceTreeKeys = {
  all: ['trace-tree'] as const,
  plants: ['trace-tree', 'plants'] as const,
  recent: (direction: TraceDirection, plantId: number) =>
    ['trace-tree', 'recent', direction, plantId] as const,
  condition: (direction: TraceDirection, plantId: number, condition: ListCondition) =>
    ['trace-tree', 'condition', direction, plantId, condition] as const,
  tree: (direction: TraceDirection, plantId: number, lotId: number, serialNo: string | null) =>
    ['trace-tree', 'tree', direction, plantId, lotId, serialNo] as const,
  lot: (lotId: number) => ['trace-tree', 'lot', lotId] as const,
  codes: (group: string) => ['trace-tree', 'codes', group] as const,
  partners: (role: PartnerRole) => ['trace-tree', 'partners', role] as const,
};

export interface TracePlant {
  plantId: number;
  plantCode: string;
  plantName: string;
}

/** 계정 범위의 사용 중인 공장(코드 순). 추적 API 는 공장 하나를 받는다. */
export const useTracePlants = () => {
  const { client } = useApiClient();
  const { session } = useSession();
  return useQuery({
    queryKey: traceTreeKeys.plants,
    enabled: session !== null && session !== undefined,
    staleTime: Infinity,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { size: 100 } } })),
    select: (data): TracePlant[] =>
      plantsInScope(session?.scopes ?? [], data.items)
        .filter((plant) => plant.isActive)
        .sort((left, right) => left.plantCode.localeCompare(right.plantCode))
        .map((plant) => ({
          plantId: plant.plantId,
          plantCode: plant.plantCode,
          plantName: plant.plantName,
        })),
  });
};

const fetchLots = (
  client: Client,
  direction: TraceDirection,
  query: {
    plantId: number;
    partnerId?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    size?: number;
  },
): Promise<TraceLotPage> =>
  runRequest(() =>
    direction === 'FORWARD'
      ? client.GET('/trace/material-trace-lots', { params: { query } })
      : client.GET('/trace/product-trace-lots', { params: { query } }),
  );

/** 최근 100개(계약 §1, 조건 없음). */
export const useRecentLots = (
  direction: TraceDirection,
  plantId: number | null,
  enabled: boolean,
) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: traceTreeKeys.recent(direction, plantId ?? 0),
    enabled: enabled && plantId !== null,
    queryFn: () => fetchLots(client, direction, { plantId: plantId ?? 0 }),
  });
};

/** 조건 결과 — 100개씩, [더 보기]가 다음 쪽을 부른다. */
export const useConditionLots = (
  direction: TraceDirection,
  plantId: number | null,
  condition: ListCondition | null,
) => {
  const { client } = useApiClient();
  const ready = plantId !== null && condition !== null;
  return useInfiniteQuery({
    queryKey: traceTreeKeys.condition(
      direction,
      plantId ?? 0,
      condition ?? { partnerId: 0, from: '', to: '' },
    ),
    enabled: ready,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchLots(client, direction, {
        plantId: plantId ?? 0,
        partnerId: condition?.partnerId,
        dateFrom: condition?.from,
        dateTo: condition?.to,
        page: pageParam,
        size: LIST_PAGE_SIZE,
      }),
    getNextPageParam: (last) =>
      last.page.page * last.page.size < last.page.total ? last.page.page + 1 : undefined,
  });
};

/** 번호 하나 풀기(계약 §2). 맞는 것이 없으면 빈 배열. */
export const fetchTraceStarts = async (
  client: Client,
  direction: TraceDirection,
  plantId: number,
  q: string,
): Promise<TraceStartMatch[]> =>
  (
    await runRequest(() =>
      client.GET('/trace/trace-starts', { params: { query: { plantId, direction, q } } }),
    )
  ).matches;

/** LOT 하나의 번호 — 주소(`?lot=`)로 들어온 LOT 을 번호로 풀어 목록에 넣는다. */
export const fetchLotNo = async (client: Client, lotId: number): Promise<string> =>
  (await runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }))).lot
    .lotNo;

export type TraceTree = ForwardTree | BackwardTree;

/** 고른 LOT 하나의 계보(계약 §3·§4). 접기·펴기는 다시 부르지 않는다(받은 그래프를 나눠 그린다). */
export const useTraceTree = (
  direction: TraceDirection,
  plantId: number | null,
  lotId: number | null,
  serialNo: string | null,
) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: traceTreeKeys.tree(direction, plantId ?? 0, lotId ?? 0, serialNo),
    enabled: plantId !== null && lotId !== null,
    queryFn: (): Promise<TraceTree> =>
      direction === 'FORWARD'
        ? runRequest(() =>
            client.GET('/trace/forward-tree', {
              params: { query: { plantId: plantId ?? 0, lotId: lotId ?? 0 } },
            }),
          )
        : runRequest(() =>
            client.GET('/trace/backward-tree', {
              params: {
                query: {
                  plantId: plantId ?? 0,
                  lotId: lotId ?? 0,
                  ...(serialNo === null ? {} : { serialNo }),
                },
              },
            }),
          ),
  });
};

/** 코드 이름. 사용 중지된 코드로 만든 기록도 있어 사용 중지까지 받는다. 이름을 못 찾으면 코드를 그대로 보인다. */
export const useCodeNames = (group: string): ((code: string) => string) => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: traceTreeKeys.codes(group),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: group, includeInactive: true, size: 100 } },
        }),
      );
      return new Map(data.items.map((value) => [value.code, masterName(value, value.codeName)]));
    },
  });
  return useMemo(() => {
    const names = query.data;
    return (code: string) => names?.get(code) ?? code;
  }, [query.data]);
};

export const LOT_STATUS_GROUP = 'LOT_STATUS';
export const WORK_ORDER_STATUS_GROUP = 'WORK_ORDER_STATUS';
export const IQC_JUDGMENT_GROUP = 'INSPECTION_RESULT_OVERALL_JUDGMENT';

export type PartnerRole = 'SUPPLIER' | 'CUSTOMER';

export const partnerRoleOf = (direction: TraceDirection): PartnerRole =>
  direction === 'FORWARD' ? 'SUPPLIER' : 'CUSTOMER';

/** 공급사·고객 고르기(C-12 참조 선택). 지난 자료를 찾는 조건이라 사용 중지된 거래처도 찾는다. */
export const usePartnerSource = (role: PartnerRole): ReferenceSource => {
  const { client } = useApiClient();
  const words = role === 'SUPPLIER' ? t.material : t.product;
  return useMemo(
    () => ({
      title: words.partnerPicker,
      key: ['trace-tree', 'reference', 'partner', role],
      columns: { code: words.partnerCode, name: words.partnerName },
      search: async (term, page) => {
        const data = await runRequest(() =>
          client.GET('/mdm/partners', {
            params: {
              query: {
                ...(term === '' ? {} : { q: term }),
                roleTypeCode: role,
                includeInactive: true,
                page,
                size: REFERENCE_PAGE_SIZE,
              },
            },
          }),
        );
        return {
          items: data.items.map((partner) => ({
            id: partner.partnerId,
            code: partner.partnerCode,
            name: partner.partnerName,
          })),
          total: data.page.total,
        };
      },
    }),
    [client, role, words],
  );
};

/** 주소로 들어온 거래처 번호를 「이름 (코드)」로 — 번호 하나로 받는 계약이 없어 그 역할의 목록에서 찾는다. */
export const usePartnerLabel = (id: number | null, role: PartnerRole): string => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: traceTreeKeys.partners(role),
    enabled: id !== null,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const all = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/partners', {
            params: { query: { roleTypeCode: role, includeInactive: true, page, size } },
          }),
        ),
      );
      return new Map(
        all.items.map((partner) => [
          partner.partnerId,
          named(partner.partnerName, partner.partnerCode),
        ]),
      );
    },
  });
  return id === null ? '' : (query.data?.get(id) ?? '');
};
