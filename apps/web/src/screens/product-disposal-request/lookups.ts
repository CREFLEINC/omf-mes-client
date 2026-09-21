import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { masterName } from '../../patterns/master-name';
import { runRequest, toApiError } from '../../patterns/request';

/**
 * 참조 이름과 코드 선택지.
 *
 * ⚠ **뿌리 키를 화면 캐시와 «가른다»** — 같은 뿌리를 쓰면 폐기 요청 한 번마다 무효화가 접두로
 * 걸려 품목·단위 전량이 다시 나간다. 참조 이름은 폐기로 바뀌지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const EMPTY_ENTRIES: LookupEntry[] = [];

const nameOr = (value: string): string =>
  value.trim() === '' ? messages.common.reference.unknown : value;

const useLookup = (key: string, load: () => Promise<LookupEntry[]>): LookupSource => {
  const query = useQuery({ queryKey: ['product-disposal-lookups', key], queryFn: load });

  return {
    entries: query.data ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/** 그 번호의 품목이 없다(404). **못 받은 것과 다르다** — 다시 부를 이유가 없다. */
const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/** 아직 묻지 않은 번호의 자리. 「없다」가 아니라 「아직 오지 않았다」로 읽혀야 한다. */
const PENDING_SOURCE: LookupSource = { entries: EMPTY_ENTRIES, isError: false, isLoading: true };

/**
 * 품목 이름 — **번호로 하나씩 푼다**(`GET /mdm/items/{itemId}`).
 *
 * ⛔ **목록 첫 쪽으로 풀지 않는다.** 종전에는 `GET /mdm/items`를 `size` 없이 한 번 받아
 *    그 안에서 이름을 찾았다 — 계약의 기본 쪽 크기가 50이라, 품목 마스터가 그보다 크면
 *    첫 쪽 밖의 품목을 가리키는 줄이 **전부 「알 수 없음」**으로 섰다(omf-all-around#37).
 *    그 문구는 *값이 잘못됐다*는 뜻이라 사용자에게 정반대로 읽힌다(G-9).
 * ⛔ **쪽을 돌며 다 받는 것으로 바꾸지 않는다.** 마스터가 9,000건인 곳이 있어 첫 진입에
 *    46번을 부르게 된다 — 얻는 것은 표에 실제로 뜬 몇 줄의 이름뿐이다.
 * ⭐ 부르는 횟수는 **표에 실제로 선 품목 수**다. 같은 품목을 가리키는 줄이 여럿이면 요청도 하나다.
 *
 * 계약에 `itemIds` 같은 복수 번호 필터가 없어 한 번에 묶어 묻는 길이 없다.
 * 생기면 이 자리를 한 번의 요청으로 되돌린다.
 *
 * **줄마다 따로 판정한다** — 한 품목의 실패가 다른 줄의 이름을 지우지 않는다.
 * 없는 품목(404)은 실패가 아니라 「알 수 없음」이다(빈 원천으로 낸다).
 */
export interface ItemNameLookup {
  of: (itemId: number) => LookupSource;
  /** 하나라도 **못 받았는가**(404는 아니다). */
  isError: boolean;
  refetch: () => void;
}

export const useItemNames = (itemIds: readonly (number | null)[]): ItemNameLookup => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds.filter((id): id is number => id !== null))].sort(
    (left, right) => left - right,
  );

  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: ['product-disposal-lookups', 'item-name', itemId] as const,
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });

  return {
    of: (itemId) => {
      const index = uniqueIds.indexOf(itemId);
      const result = index === -1 ? undefined : results[index];

      if (result === undefined) return PENDING_SOURCE;

      const item = result.data?.item;

      return {
        entries:
          item === undefined
            ? EMPTY_ENTRIES
            : [
                {
                  value: String(itemId),
                  label: `${item.itemCode} · ${nameOr(masterName(item, item.itemName))}`,
                  isActive: item.isActive,
                },
              ],
        /* 없는 품목은 실패가 아니다 — 빈 원천이 되어 「알 수 없음」으로 읽힌다. */
        isError: result.isError && !isNotFound(result.error),
        isLoading: result.isPending,
      };
    },
    isError: results.some((result) => result.isError && !isNotFound(result.error)),
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
};

export const useUomLookup = (): LookupSource => {
  const { client } = useApiClient();

  return useLookup('uoms', async () => {
    const data = await runRequest(() =>
      client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
    );

    return data.items.map((uom) => ({
      value: String(uom.uomId),
      label: nameOr(uom.uomCode),
      isActive: uom.isActive,
    }));
  });
};

/**
 * 공통코드 값 목록.
 *
 * ⭐ **그룹을 «이름»으로 가리킨다**(`codeGroupCode`) — 채번 식별자는 환경마다 달라 하드코딩할
 * 수 없다(계약 명시 · omf-mes#179). 계약이 이 두 그룹의 이름을 못박아 두어(G-32) 출고 유형과
 * 출고 사유는 **자리표시를 기다리지 않고 조회로 채운다.**
 */
const useCodeValues = (codeGroupCode: string): LookupSource => {
  const { client } = useApiClient();

  return useLookup(`code-values:${codeGroupCode}`, async () => {
    const data = await runRequest(() =>
      client.GET('/mdm/code-values', { params: { query: { codeGroupCode } } }),
    );

    return data.items.map((value) => ({
      value: value.code,
      label: nameOr(value.codeName),
      /* 코드값에는 사용 여부가 없다 — 조회가 이미 쓸 수 있는 것만 낸다. */
      isActive: true,
    }));
  });
};

export const useIssueTypeCodes = (): LookupSource => useCodeValues('ISSUE_TYPE');
export const useIssueReasonCodes = (): LookupSource => useCodeValues('GOODS_ISSUE_REASON');
