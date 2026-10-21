import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { masterName } from '../../patterns/master-name';
import { runRequest, toApiError } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)·코드로 이어진 값을 이름으로 푼다 — 공급사·공장(조건 선택지)·품목(조건 칩), 그리고 창고 코드.
 * 표의 공급사·품목·단위 이름은 응답에 함께 온다(server #762) — 여기서 풀지 않는다.
 *
 * **넷은 목록으로 받고 품목만 번호로 하나씩 푼다.** 가름의 잣대는 마스터의 크기다 —
 * 품목은 수천 건이라 목록 한 쪽으로는 이름 대부분이 「알 수 없음」으로 선다(omf-all-around#37).
 *
 * 목록으로 받는 것은 `includeInactive=true`로 한 번 받아 둔다. 기본 조회는 사용 중인 것만 내려주므로,
 * 미사용 값을 참조하는 행이 오면 이름이 비어 보인다 — ERP 수신본이라 그런 행이 실제로 온다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.inboundSchedule;

/**
 * 참조를 이름으로 풀 때 필요한 것 전부. **셋을 함께 들고 있어야 세 갈래를 가를 수 있다** —
 * 아직 오지 않음 · 목록에 없음 · 불러오기 실패.
 */
export interface ReferenceSource {
  entries: readonly LookupEntry[];
  isError: boolean;
  isLoading: boolean;
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다 */
  truncated: boolean;
  /** 조회 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  refetch: () => void;
}

/**
 * 참조 값 하나의 표기 상태.
 *
 * **네 갈래를 타입으로 가른다.** 하나로 뭉개면 #47이 그대로 되살아난다 —
 * 본 자료가 참조 목록보다 먼저 오는 순간 정상 값이 「알 수 없음」으로 보이고,
 * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자에게 반대로 읽힌다.
 *
 * **어느 갈래에도 번호를 담지 않는다**(#44). 담을 자리가 없으면 화면으로 샐 경로도 없다.
 */
export type ReferenceState =
  | { kind: 'named'; label: string; code?: string; name?: string }
  | { kind: 'unknown' }
  | { kind: 'loading' }
  | { kind: 'failed' };

/**
 * 참조 하나를 표기 상태로 옮긴다.
 *
 * 순서가 뜻을 정한다 — **실패 · 미도착이 「목록에 없음」보다 앞선다.** 목록이 없거나 못 받은 것을
 * 「그 값이 목록에 없다」로 판정하면 정상 값에 잘못된 값이라는 표를 붙이는 셈이다.
 *
 * `String(id)`는 **맞춰 보기 위한 것이지 표시를 위한 것이 아니다** — 결과 어디에도 담기지 않는다.
 */
export const toReference = (
  source: ReferenceSource,
  id: number | null | undefined,
): ReferenceState => {
  if (source.isError) return { kind: 'failed' };
  if (source.isLoading) return { kind: 'loading' };
  if (id === null || id === undefined) return { kind: 'unknown' };

  const entry = source.entries.find((candidate) => candidate.value === String(id));
  if (entry === undefined) return { kind: 'unknown' };

  return entry.code === undefined
    ? { kind: 'named', label: entry.label }
    : { kind: 'named', label: entry.label, code: entry.code, name: entry.name ?? '' };
};

/** 표기 상태를 화면 문구로 옮긴다. 네 갈래의 문구가 서로 달라야 뜻이 구분된다. */
export const describeReference = (state: ReferenceState): string => {
  switch (state.kind) {
    case 'named':
      return state.label;
    case 'unknown':
      return t.values.unknown;
    case 'loading':
      return t.values.referenceLoading;
    case 'failed':
      return t.values.referenceFailed;
  }
};

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ENTRIES: LookupEntry[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 선택칸 아래에 붙일 안내. 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로 읽고**
 * 찾는 값이 없으면 「그런 공급사가 없다」로 결론짓는다.
 *
 * **실패가 잘림보다 앞선다.** 둘이 겹치는 자리가 실제로 있다 — 첫 조회가 잘린 목록을 주고
 * 다시 부르기가 실패하면 낡은 자료(`truncated`)와 실패(`isError`)가 함께 참이 된다.
 * 그때 「일부만 보인다」고만 말하면 지금 목록이 **낡았다는 사실**이 가려진다.
 *
 * 화면이 아니라 여기에 둔다 — 판정이 `LookupResult`의 두 필드로만 정해져
 * 화면을 띄우지 않고 단위로 고정할 수 있다.
 */
export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  suppliers: ['inbound-schedule-lookups', 'suppliers'] as const,
  plants: ['inbound-schedule-lookups', 'plants'] as const,
  itemName: (itemId: number) => ['inbound-schedule-lookups', 'item', itemId] as const,
  storageLocations: ['inbound-schedule-lookups', 'code', 'SL_TYPE'] as const,
};

/**
 * 공급사 — 표의 공급사 칸과 조건 줄의 공급사 선택지가 함께 쓴다.
 *
 * 계약이 거래처를 공급사·고객으로 가르는 조건을 주지 않으므로 전체 거래처를 받는다.
 * 좁혀 받을 근거가 생기면 그때 쿼리를 더한다 — 지금 지어내면 고를 수 있는 값이 사라진다.
 */
export const useSupplierOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.suppliers,
    queryFn: () =>
      fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/partners', {
            params: { query: { includeInactive: true, page, size } },
          }),
        ),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.partnerId),
        label: `${item.partnerCode} · ${item.partnerName}`,
        isActive: item.isActive,
        code: item.partnerCode,
        name: item.partnerName,
      })) ?? EMPTY_ENTRIES,
    truncated: data?.truncated === true,
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 공장 — 조건 줄의 공장 선택지와 조건 칩이 쓴다. 표에는 공장 열이 없다(폭 예산). */
export const usePlantOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.plants,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.plantId),
        label: `${item.plantCode} · ${item.plantName}`,
        isActive: item.isActive,
        code: item.plantCode,
        name: item.plantName,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 그 번호의 품목이 없다(404). **못 받은 것과 다르다** — 다시 부를 이유가 없다. */
const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 품목 이름 — 표의 품목 칸과 품목 조건 칩이 쓴다. **번호로 하나씩 푼다**(`GET /mdm/items/{itemId}`).
 *
 * ⛔ **목록 첫 쪽으로 풀지 않는다.** 종전에는 `GET /mdm/items`를 `size` 없이 한 번 받아
 *    그 안에서 이름을 찾았다 — 기본 쪽 크기 밖의 품목이 전부 「알 수 없음」으로 섰다.
 * ⛔ **쪽을 돌며 다 받는 것으로 바꾸지 않는다.** 마스터가 9,000건인 곳이 있다.
 * ⭐ 부르는 횟수는 **이 쪽에 실제로 뜬 품목 수**다. 같은 품목이면 요청도 하나다(같은 캐시 열쇠).
 */
export interface ItemNameLookup {
  /** 품목 하나의 표기 상태. 404 는 「목록에 없음」, 그 밖의 실패는 「실패」로 가른다. */
  of: (itemId: number) => ReferenceState;
  /** 하나라도 실패했는가. 실패 안내와 「다시 시도」가 이것을 본다. */
  isError: boolean;
  refetch: () => void;
}

type Client = ReturnType<typeof useApiClient>['client'];

interface ItemName {
  code: string;
  name: string;
}

const fetchItemName = async (client: Client, itemId: number): Promise<ItemName> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
  );

  /* 상세는 봉투로 온다 — 편집 가능 여부(`editability`)는 이 화면이 쓰지 않는다. */
  const item = data.item;

  return { code: item.itemCode, name: masterName(item, item.itemName) };
};

export const useItemNames = (itemIds: readonly number[]): ItemNameLookup => {
  const { client } = useApiClient();

  const uniqueIds = [...new Set(itemIds)];

  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: lookupKeys.itemName(itemId),
      queryFn: () => fetchItemName(client, itemId),
    })),
  });

  return {
    of: (itemId) => {
      const index = uniqueIds.indexOf(itemId);
      const result = index === -1 ? undefined : results[index];

      if (result === undefined) return { kind: 'loading' };
      /* 없는 품목은 실패가 아니다 — 다시 불러도 같은 답이 온다. */
      if (result.isError)
        return isNotFound(result.error) ? { kind: 'unknown' } : { kind: 'failed' };

      return result.data === undefined
        ? { kind: 'loading' }
        : {
            kind: 'named',
            label: `${result.data.code} · ${result.data.name}`,
            code: result.data.code,
            name: result.data.name,
          };
    },
    isError: results.some((result) => result.isError && !isNotFound(result.error)),
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
};

/**
 * 창고 이름 — 공통코드 `SL_TYPE`(ERP `SL_CD`). W-01 ERP P/O 조회(`erp-purchase-order`)와 같은 그룹이다.
 *
 * **이름을 못 찾으면 코드를 그대로 낸다.** 창고 코드는 사람이 읽는 값이라 「알 수 없음」으로
 * 가리면 정보가 준다. 목록을 못 받았을 때도 같다 — 실패 안내를 따로 세우지 않는다.
 * 끝까지 받는다 — ERP 수신이 만든 그룹은 한 쪽을 넘을 수 있다.
 */
export const useStorageLocationNames = (): ((code: string | null) => string) => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.storageLocations,
    queryFn: async () => {
      const data = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupCode: 'SL_TYPE', includeInactive: true, page, size } },
          }),
        ),
      );

      return new Map(data.items.map((value) => [value.code, masterName(value, value.codeName)]));
    },
  });

  const names = query.data;

  return (code) => {
    if (code === null || code.trim() === '') return t.values.empty;

    return names?.get(code) ?? code;
  };
};

/** 스캔·입력 한 번에 찾아볼 품목 수. 정확히 맞는 것을 고르는 데 쓰므로 많을 필요가 없다. */
const SCAN_LOOKUP_SIZE = 20;

export type ScannedItem =
  { kind: 'found'; itemId: number } | { kind: 'ambiguous' } | { kind: 'none' };

/**
 * 바코드·품목번호 한 번으로 품목을 정한다(빠른 조회 「품목코드」).
 *
 * ⚠ **바코드 값이 품목코드라고 본다.** 다른 체계(공급사 품번·라벨 바코드)면 서버의 바코드 → 품목 조회가
 * 들어온 뒤 이 함수만 바꾼다.
 *
 * 품목코드가 정확히 같은 것(대소문자 무시)이 있으면 그것, 없고 찾은 것이 하나뿐이면 그것이다.
 * 둘 다 아니면 사람이 고른다(`ambiguous` → 품목 선택 창).
 */
export const resolveScannedItem = async (client: Client, raw: string): Promise<ScannedItem> => {
  const value = raw.trim();
  const data = await runRequest(() =>
    client.GET('/mdm/items', {
      params: { query: { q: value, includeInactive: true, size: SCAN_LOOKUP_SIZE } },
    }),
  );
  const exact = data.items.find((item) => item.itemCode.toLowerCase() === value.toLowerCase());

  if (exact !== undefined) return { kind: 'found', itemId: exact.itemId };
  if (data.items.length === 1 && data.items[0] !== undefined) {
    return { kind: 'found', itemId: data.items[0].itemId };
  }

  return data.items.length === 0 ? { kind: 'none' } : { kind: 'ambiguous' };
};
