import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 참조.
 *
 * **지어내는 것이 아니라 실제로 조회한다.** 자리표시로 두는 것은 값 목록이 확정되지 않은
 * 코드 선택지뿐이고(`code-options.ts`), 나머지는 전부 계약이 이름을 준다.
 *
 * **참조 → 보이는 자리 → 복구 표**(계획 결정 17). 실패 안내와 「다시 시도」는 그 이름이
 * 실제로 실패로 보이는 자리에 있어야 사용자가 무엇을 되살리는지 알 수 있다.
 *
 * | 참조 | 경로 | 보이는 자리 | 복구 | 언제 부르나 | 어느 PR |
 * | --- | --- | --- | --- | --- | :-: |
 * | 창고 | `/mdm/warehouses` | 목록 표 · 제목줄 · 조건 줄 선택지 · 개시 폼 | **위 구획** | 첫 진입 | ① |
 * | 위치 | `/mdm/locations?warehouseId=` | 위치 선택칸 · 라인 표 제목줄 | **아래 구획** | **실사를 고른 뒤** | ③ |
 * | 품목 | `/mdm/items` | 라인 표의 칸 | **아래 구획** | **위치를 고른 뒤** | ③ |
 * | 단위 | `/mdm/uoms` | 라인 표의 수량 표기 | **아래 구획** | **위치를 고른 뒤** | ③ |
 * | 자재 LOT | `/trace/lots?itemId=` | 라인 표의 칸 | **아래 구획** | **위치를 고른 뒤** | ③ |
 *
 * **이 PR이 부르는 참조는 창고 하나다.** 나머지 넷은 보이는 자리가 전부 PR ③의 부품이라
 * 지금 부르면 아무도 읽지 않는 요청이 되고, 훅만 두면 아무도 부르지 않는 코드가 된다 —
 * 어느 쪽도 「닿을 수 없는 가지를 만들지 않는다」(계획 §5.2)에 어긋난다. 표는 전체를 적어
 * 두어 **뒤 PR이 이 자리에 붙는다**는 것이 이 파일에서 읽히게 한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stocktaking;

/**
 * 참조를 이름으로 풀 때 필요한 것 전부. **셋을 함께 들고 있어야 네 갈래를 가를 수 있다** —
 * 아직 오지 않음 · 목록에 없음 · 불러오기 실패 · 정상.
 */
export interface ReferenceSource {
  entries: readonly LookupEntry[];
  isError: boolean;
  isLoading: boolean;
  /**
   * 목록이 잘렸으면 참.
   *
   * **읽는 쪽이 이 값을 볼 수 있어야 한다.** 잘린 목록으로 이름을 풀면 그 뒤의 정상 값이
   * 「알 수 없음」으로 찍히는데, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
   * 그래서 `isError`·`isLoading`과 같은 층에 둔다 — 이름을 내는 구획이 사실을 밝힐 수 있게.
   */
  truncated: boolean;
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
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
 * 선택칸·표 아래에 붙일 안내. 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로 읽고**
 * 찾는 값이 없으면 「그런 창고가 없다」로 결론짓는다.
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
  warehouses: ['stocktaking-lookups', 'warehouses'] as const,
};

/**
 * 창고 — **목록 표의 칸·고른 실사의 제목줄·조건 줄의 선택지가 같은 목록을 쓴다.**
 *
 * **`includeInactive=true`로 한 번 받아 둔다.** 기본 조회는 사용 중인 것만 내려주므로,
 * 지금은 쓰지 않는 창고를 대상으로 한 과거 실사가 오면 이름이 비어 보인다. 미사용 값을
 * 선택지에서 빼지도 않는다 — 빼면 그 실사를 조건으로 찾을 방법이 사라진다. 표식만 붙인다.
 *
 * **첫 진입에 부른다.** 목록 표의 창고 칸이 목록 응답과 함께 곧바로 그려지므로 고른 뒤에
 * 부르기 시작하면 첫 화면의 이름이 한 박자 늦게 채워진다.
 */
export const useWarehouseLookup = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.warehouses,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.warehouseId),
        label: `${item.warehouseCode} · ${item.warehouseName}`,
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
