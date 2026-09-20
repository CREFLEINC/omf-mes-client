import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { masterName } from '../../patterns/master-name';
import { runRequest, toApiError } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 참조 넷 — 공급사·공장·품목·단위.
 *
 * **셋은 목록으로 받고 품목만 번호로 하나씩 푼다.** 가름의 잣대는 마스터의 크기다 —
 * 목록 한 번으로 받는 방식은 그 한 쪽에 담기는 만큼만 이름을 얻고 나머지는 조용히 빈다.
 *
 * **지어내는 것이 아니라 실제로 조회한다.** 자리표시로 두는 것은 값 목록이 확정되지 않은
 * 코드 선택지뿐이고, 그 자리는 PR ②에 있다.
 *
 * 목록으로 받는 셋은 `includeInactive=true`로 한 번 받아 둔다. 기본 조회는 사용 중인 것만
 * 내려주므로, 미사용 값을 참조하는 발주가 오면 이름이 비어 보인다 — 지금은 쓰지 않는
 * 거래처·공장을 참조하는 과거 발주가 실제로 있다. 번호로 묻는 품목은 그 축이 없다
 * (상세 조회는 사용 여부로 거르지 않는다).
 *
 * **참조 → 보이는 자리 → 복구 표**(계획 결정 15). 실패 안내와 「다시 시도」는 그 이름이
 * 실제로 실패로 보이는 자리에 있어야 사용자가 무엇을 되살리는지 알 수 있다.
 *
 * | 참조 | 보이는 자리 | 복구 |
 * | --- | --- | --- |
 * | 공급사 | 발주 표의 칸 · 조건 칩 | **위 구획** |
 * | 품목 · 단위 | 라인 표의 칸 | **아래 구획** |
 * | **공장** | **고른 발주의 제목줄뿐** | **아래 구획** |
 *
 * 공장이 아래에 있는 이유가 이 표의 요점이다 — 발주 표에는 공장 열이 없어(폭 예산상
 * 제목줄로 보냈다) 위 구획에 두면 **보이지도 않는 실패의 복구 버튼**이 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.overReceiptSplit;

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
  | { kind: 'named'; label: string }
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

  const label = source.entries.find((entry) => entry.value === String(id))?.label;

  return label === undefined ? { kind: 'unknown' } : { kind: 'named', label };
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
 */
export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  suppliers: ['over-receipt-split-lookups', 'suppliers'] as const,
  plants: ['over-receipt-split-lookups', 'plants'] as const,
  /** 품목은 번호마다 하나씩이라 열쇠도 번호를 담는다. */
  itemName: (itemId: number) => ['over-receipt-split-lookups', 'item-name', itemId] as const,
  uoms: ['over-receipt-split-lookups', 'uoms'] as const,
};

/**
 * 공급사 — 발주 표의 공급사 칸과 조건 줄의 공급사 선택지가 함께 쓴다.
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
      })) ?? EMPTY_ENTRIES,
    truncated: data?.truncated === true,
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/**
 * 공장 — 고른 발주의 제목줄이 쓴다. 조건에는 없다(계약에 있으나 화면 조건으로 두지 않았다).
 *
 * **고르기 전에도 부른다.** 단위와 달리 잠그지 않는 이유는 이름이 **제목줄에 곧바로** 필요해서다 —
 * 발주를 고른 순간 라인 조회와 참조 조회가 함께 시작되면 제목줄이 「이름 불러오는 중」에서
 * 한 박자 늦게 채워진다. 요청 수는 화면당 한 번이라 미리 받아 두는 값이 크다.
 */
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
 * 품목 — 라인 표의 품목 칸이 쓴다. **번호로 하나씩 푼다**(`GET /mdm/items/{itemId}`).
 *
 * ⛔ **목록 첫 쪽으로 풀지 않는다.** 종전에는 `GET /mdm/items`를 `size` 없이 한 번 받아
 *    그 안에서 이름을 찾았다 — 계약의 기본 쪽 크기가 50이라, 품목 마스터가 그보다 크면
 *    첫 쪽 밖의 품목을 실은 발주가 **전부 「알 수 없음」**으로 섰다. 그 문구는
 *    *값이 잘못됐다*는 뜻이라 사용자에게 정반대로 읽힌다.
 * ⛔ **쪽을 돌며 다 받는 것으로 바꾸지 않는다.** 마스터가 9,000건인 곳이 있어
 *    첫 진입에 180번을 부르게 된다 — 얻는 것은 화면에 뜬 서너 줄의 이름뿐이다.
 * ⭐ 부르는 횟수는 **고른 발주의 라인에 실제로 실린 품목 수**다. 두 라인이 같은 품목이면
 *    요청도 하나다(같은 캐시 열쇠).
 *
 * 계약에 `itemIds` 같은 복수 번호 필터가 없어 한 번에 묶어 묻는 길이 없다.
 * 생기면 이 자리를 한 번의 요청으로 되돌린다.
 */
export interface ItemNameLookup {
  /**
   * 한 라인의 품목 표기 상태.
   *
   * **네 갈래가 그대로 산다.** 「목록에 없음」은 이제 *그 번호의 품목이 없다*(404)는 뜻이다 —
   * 못 받은 것(실패)과 가른다. 둘을 뭉개면 지워진 품목 한 건이 라인 구획 전체에
   * 「다시 시도」를 세우고, 눌러도 영영 풀리지 않는다.
   * 라인의 `itemId`는 계약상 필수라 빈 값 갈래만 서지 않는다.
   */
  of: (itemId: number) => ReferenceState;
  /** 하나라도 실패했는가. 라인 구획의 실패 안내와 「다시 시도」가 이것을 본다. */
  isError: boolean;
  refetch: () => void;
}

type Client = ReturnType<typeof useApiClient>['client'];

const fetchItemName = async (client: Client, itemId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
  );

  /* 상세는 봉투로 온다 — 편집 가능 여부(`editability`)는 이 화면이 쓰지 않는다. */
  const item = data.item;

  return `${item.itemCode} · ${masterName(item, item.itemName)}`;
};

export const useItemNames = (itemIds: readonly number[]): ItemNameLookup => {
  const { client } = useApiClient();

  /** 같은 품목을 실은 라인이 여럿이면 요청은 하나다. */
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
      if (result.isError) return isNotFound(result.error) ? { kind: 'unknown' } : { kind: 'failed' };

      return result.data === undefined
        ? { kind: 'loading' }
        : { kind: 'named', label: result.data };
    },
    isError: results.some((result) => result.isError && !isNotFound(result.error)),
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
};

/**
 * 단위 — 라인 표의 수량 입력칸 아래에서만 보인다.
 *
 * **발주를 고르기 전에는 부르지 않는다**(`enabled`). 쓰지 않는 상태에서 부르면
 * 어느 요청이 무엇을 위한 것인지 가릴 수 없고, 첫 진입의 요청 수가 이유 없이 는다.
 */
export const useUomOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.uoms,
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
    refetch: () => {
      void query.refetch();
    },
  };
};
