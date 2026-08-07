import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 선택 목록 넷 — 공급사·공장·품목·단위.
 *
 * **지어내는 것이 아니라 실제로 조회한다.** 자리표시로 두는 것은 값 목록이 확정되지 않은
 * 상태 코드뿐이다(`status-options.ts`).
 *
 * 전부 `includeInactive=true`로 한 번 받아 둔다. 기본 조회는 사용 중인 것만 내려주므로,
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
  { kind: 'named'; label: string } | { kind: 'unknown' } | { kind: 'loading' } | { kind: 'failed' };

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

export const lookupKeys = {
  suppliers: ['inbound-schedule-lookups', 'suppliers'] as const,
  plants: ['inbound-schedule-lookups', 'plants'] as const,
  items: ['inbound-schedule-lookups', 'items'] as const,
  uoms: ['inbound-schedule-lookups', 'uoms'] as const,
};

/**
 * 공급사 — 목록 표의 공급사 칸과 조건 줄의 공급사 선택지가 함께 쓴다.
 *
 * 계약이 거래처를 공급사·고객으로 가르는 조건을 주지 않으므로 전체 거래처를 받는다.
 * 좁혀 받을 근거가 생기면 그때 쿼리를 더한다 — 지금 지어내면 고를 수 있는 값이 사라진다.
 */
export const useSupplierOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.suppliers,
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
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 공장 — 고른 건의 제목줄이 쓴다. 조건에는 없다(계약에 있으나 화면 조건으로 두지 않았다). */
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

/** 품목 — 라인 표의 품목 칸과 조건 줄의 품목 선택지가 함께 쓴다. */
export const useItemOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.items,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/items', { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.itemId),
        label: `${item.itemCode} · ${item.itemName}`,
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

/**
 * 단위 — 라인 표만 쓴다.
 *
 * **건을 고르기 전에는 부르지 않는다**(`enabled`). 쓰지 않는 상태에서 부르면
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
