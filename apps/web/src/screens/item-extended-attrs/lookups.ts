import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  toRoutingOperationOptions,
  type RoutingRevisionOperations,
} from './routing-operation-options';
import type { LookupEntry, PageMeta } from './types';

/**
 * FK로 이어진 값을 채우는 선택 목록. **지어내는 것이 아니라 실제로 조회한다** —
 * 자리표시로 두는 것은 값 목록이 확정되지 않은 코드뿐이다(`code-catalog.ts`).
 *
 * 전부 `includeInactive=true`로 한 번 받아 두고 표시 규칙은 화면이 정한다.
 * 기본 조회는 사용 중인 것만 내려주므로, 미사용 값을 참조하는 행을 열면 이름이 비어 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다 */
  truncated: boolean;
  /** 조회가 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다 */
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

const lookupKeys = {
  uoms: ['item-extended-attrs-lookups', 'uoms'] as const,
  businessUnits: ['item-extended-attrs-lookups', 'business-units'] as const,
  partners: ['item-extended-attrs-lookups', 'partners'] as const,
  processes: ['item-extended-attrs-lookups', 'processes'] as const,
  routings: (itemId: number) => ['item-extended-attrs-lookups', 'routings', itemId] as const,
  routingOperations: (routingId: number) =>
    ['item-extended-attrs-lookups', 'routing-operations', routingId] as const,
};

/**
 * 단위 — 원본 구획의 **기준 단위 이름**.
 *
 * `baseUomId`는 내부 식별자라 화면에 그대로 낼 수 없다. 이름으로 옮기고,
 * 옮길 수 없으면 「알 수 없음」을 낸다(`options.ts`의 `lookupLabel`).
 */
export const useUomOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.uoms,
    // 품목을 고르기 전에는 이 목록을 쓸 자리가 없다.
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.uomId),
        label: `${item.uomCode} · ${item.uomName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/**
 * 사업부 — 사업부 매핑의 「보내는 사업부」·「받는 사업부」.
 *
 * `legalEntityId`로 좁히지 않는다. 이 화면에 법인 조건이 없고, 좁히면 사용자가
 * 왜 어떤 사업부가 보이지 않는지 알 수단이 없다.
 */
export const useBusinessUnitOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.businessUnits,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/business-units', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.businessUnitId),
        label: `${item.businessUnitCode} · ${item.businessUnitName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/**
 * 거래처 — 외부 코드의 「거래처」.
 *
 * **비우는 것이 정상 값이다**(계약: 「비우면 (전체)」 · A-7). 그래서 이 목록이 비어도
 * 화면이 막히지 않지만, 목록을 받지 못했다는 사실은 밝혀야 한다 —
 * 거래처를 고르려던 사용자가 「(전체)」로 저장해 버리면 유일 제약이 다르게 걸린다.
 */
export const usePartnerOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.partners,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.partnerId),
        label: `${item.partnerCode} · ${item.partnerName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/**
 * 공정 — 구성품의 「실사용 공정」.
 *
 * 계약이 「화면이 쓰는 것은 `processId`·`processName`이다」라 적었다.
 * 등록 공정(`routingOperationId`)과 **다른 자원이다** — 그쪽은 Routing Rev에 매달린
 * 공정 라인이고 이쪽은 공정 마스터다. 계약이 「다를 수 있다」고 적은 이유가 이것이다.
 */
export const useProcessOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.processes,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/processes', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.processId),
        label: `${item.processCode} · ${item.processName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/**
 * 등록 공정 — **조회가 2단이다.**
 *
 * `routingOperationId`는 Routing **Rev**에 매달린 공정 라인 한 줄이라, 품목의 Rev 목록을 받고
 * Rev마다 공정 목록을 받아야 선택지가 만들어진다. 계약에 「품목의 공정 라인을 한꺼번에 받는」
 * 오퍼레이션이 없다.
 *
 * **최신 Rev만 받지 않는다.** 구성품이 가리키는 공정이 옛 Rev의 줄일 수 있다(M32).
 *
 * 잘림이라는 상태가 없다 — 두 응답 모두 쪽 나눔이 없다. 대신 **일부 Rev를 받지 못한 것**을
 * 같은 자리(`truncated`)로 알린다: 사용자가 보는 사실이 「목록이 온전하지 않다」로 같기 때문이다.
 */
export const useRoutingOperationOptions = (
  itemId: number | null,
  enabled: boolean,
): LookupResult => {
  const { client } = useApiClient();

  const revisions = useQuery({
    queryKey: lookupKeys.routings(itemId ?? 0),
    enabled: enabled && itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 Rev 목록을 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/planning/routings', { params: { query: { itemId } } }));
    },
  });

  const revisionItems = revisions.data?.items ?? [];

  /*
   * **2단에도 같은 조건을 준다.** 1단만 막으면 캐시가 따뜻할 때 샌다 —
   * 꺼진 조회도 react-query가 **캐시에 있던 값을 그대로 돌려주므로** `revisionItems`가
   * 비어 있지 않고, 조건 없는 `useQueries`는 그 목록을 보고 Rev 수만큼 요청을 낸다.
   * 구성품 표가 보이지도 않는 동안 공정 목록을 받아 둘 이유가 없다.
   */
  const operationQueries = useQueries({
    queries: revisionItems.map((routing) => ({
      queryKey: lookupKeys.routingOperations(routing.routingId),
      enabled,
      queryFn: () =>
        runRequest(() =>
          client.GET('/planning/routings/{routingId}/operations', {
            params: { path: { routingId: routing.routingId } },
          }),
        ),
    })),
  });

  const grouped: RoutingRevisionOperations[] = revisionItems.map((routing, index) => ({
    routingVersion: routing.routingVersion,
    // 아직 받지 못한 것과 받지 못한 것을 같은 `null`로 둔다 — 둘 다 「지금은 고를 수 없다」다.
    operations: operationQueries[index]?.data?.items ?? null,
  }));

  const options = toRoutingOperationOptions(grouped);

  return {
    entries: options.entries,
    truncated: options.incomplete && !operationQueries.some((query) => query.isPending),
    // Rev 목록 자체를 받지 못하면 선택지를 만들 근거가 없다.
    isError: revisions.isError,
    isLoading: revisions.isPending || operationQueries.some((query) => query.isPending),
  };
};
