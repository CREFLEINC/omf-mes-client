import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 선택 목록 둘 — 고객·납품처.
 *
 * **지어내는 것이 아니라 실제로 조회한다.** 자리표시로 두는 것은 값 목록이 확정되지 않은
 * 상태 코드뿐이다(`status-options.ts`).
 *
 * 계약이 거래처를 고객·공급사·납품처로 가르는 조건을 주지 않는다(`Partner` 스키마에 역할
 * 필드가 없다 — 실측). 그래서 W-01-09의 공급사 조회와 같은 자원(`/mdm/partners`)을 그대로
 * 받는다. 고객·납품처가 같은 파트너 목록을 각각 독립으로 조회하는 이유는 캐시 키를 갈라
 * 한쪽 재시도가 다른 쪽에 번지지 않게 하기 위해서다(W-01-09의 공급사·품목 분리와 같다).
 *
 * 전부 `includeInactive=true`로 한 번 받아 둔다. 기본 조회는 사용 중인 것만 내려주므로,
 * 미사용 값을 참조하는 건이 오면 이름이 비어 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.shipmentSchedule;

/**
 * 참조를 이름으로 풀 때 필요한 것 전부. 셋을 함께 들고 있어야 세 갈래를 가를 수 있다 —
 * 아직 오지 않음 · 목록에 없음 · 불러오기 실패.
 */
export interface ReferenceSource {
  entries: readonly LookupEntry[];
  isError: boolean;
  isLoading: boolean;
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다. */
  truncated: boolean;
  /** 조회 실패에는 복구 경로를 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  refetch: () => void;
}

/**
 * 참조 값 하나의 표기 상태. **네 갈래를 타입으로 가른다.**
 * 하나로 뭉개면 본 자료가 참조 목록보다 먼저 오는 순간 정상 값이 「알 수 없음」으로 보인다.
 *
 * **어느 갈래에도 번호를 담지 않는다** — 담을 자리가 없으면 화면으로 샐 경로도 없다.
 */
export type ReferenceState =
  { kind: 'named'; label: string } | { kind: 'unknown' } | { kind: 'loading' } | { kind: 'failed' };

/**
 * 참조 하나를 표기 상태로 옮긴다.
 *
 * 순서가 뜻을 정한다 — **실패·미도착이 「목록에 없음」보다 앞선다.** 목록이 없거나 못 받은 것을
 * 「그 값이 목록에 없다」로 판정하면 정상 값에 잘못된 값이라는 표를 붙이는 셈이다.
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

const EMPTY_ENTRIES: LookupEntry[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 선택칸 아래에 붙일 안내. 밝히지 않으면 사용자가 불완전한 목록을 완전한 것으로 읽고
 * 찾는 값이 없으면 「그런 거래처가 없다」고 결론짓는다.
 *
 * **실패가 잘림보다 앞선다** — 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면
 * 낡은 자료와 실패가 함께 참이 된다. 그때 「일부만 보인다」고만 말하면 지금 목록이
 * 낡았다는 사실이 가려진다.
 */
export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  customers: ['shipment-schedule-lookups', 'customers'] as const,
  shipToPartners: ['shipment-schedule-lookups', 'ship-to-partners'] as const,
};

const toLookupResult = (
  data:
    | {
        items: { partnerId: number; partnerCode: string; partnerName: string; isActive: boolean }[];
        page: PageMeta;
      }
    | undefined,
  isError: boolean,
  isLoading: boolean,
  refetch: () => void,
): LookupResult => ({
  entries:
    data?.items.map((item) => ({
      value: String(item.partnerId),
      label: `${item.partnerCode} · ${item.partnerName}`,
      isActive: item.isActive,
    })) ?? EMPTY_ENTRIES,
  truncated: data !== undefined && isTruncated(data.page, data.items.length),
  isError,
  isLoading,
  refetch,
});

/** 고객 — 목록 표의 고객 칸과 조건 줄의 고객 선택지가 함께 쓴다. */
export const useCustomerOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.customers,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', { params: { query: { includeInactive: true } } }),
      ),
  });

  return toLookupResult(query.data, query.isError, query.isPending, () => {
    void query.refetch();
  });
};

/** 납품처 — 목록 표의 납품처 칸과 조건 줄의 납품처 선택지가 함께 쓴다. */
export const useShipToPartnerOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.shipToPartners,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', { params: { query: { includeInactive: true } } }),
      ),
  });

  return toLookupResult(query.data, query.isError, query.isPending, () => {
    void query.refetch();
  });
};
