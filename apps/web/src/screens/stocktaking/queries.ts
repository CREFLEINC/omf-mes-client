import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import type { CountFilterQuery } from './filters';
import {
  toCountDetailView,
  toCountView,
  type CountDetailView,
  type CountListResult,
} from './types';

/**
 * 이 화면의 요청.
 *
 * | 언제 | 무엇 | 어느 PR |
 * | --- | --- | :-: |
 * | 첫 진입 | 실사 목록 · **창고 목록**(`lookups.ts`) | ① |
 * | 실사를 고르면 | 그 실사의 **상세**(헤더 + 요약 4칸 + **낙관적 잠금 토큰**) | ① |
 * | 「실사 개시」 확인 | `POST /inventory/counts` — **되돌릴 수 없다** | ② |
 * | 위치를 고르면 | 그 위치의 라인 | ③ |
 * | 「이 위치 실사 완료」 | `PUT …/lines` — **파괴적 치환** | ③ |
 * | 「마감」 확인 | `POST …:close` — **되돌릴 수 없다** | ④ |
 *
 * **이 PR은 읽기 둘까지다.** 쓰기 셋은 잠금 규약이 서로 달라(없음 / 선택 / 필수) 각각의
 * PR에서 배선한다 — 이 파일에 쓰기 훅이 하나도 없다는 것이 「PR ①은 쓰기를 부르지 않는다」의
 * 구조적 근거다(완료 조건 C13).
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다** —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 */
export type CountListQuery = CountFilterQuery & {
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
};

/**
 * 캐시 키.
 *
 * **목록과 상세의 앞머리를 갈라 둔다** — 하나로 묶으면 목록만 다시 부르려 해도 상세까지
 * 함께 무효화되고, 그때 상세 응답이 새 참조로 오면서 **치던 값이 사라진다**(#43의 형태).
 * 그 위험은 초안이 생기는 PR ②·③에서 실제 피해가 되지만, 갈라 두는 것은 지금 한다.
 */
const COUNT_LIST_KEY = ['inventory-counts', 'list'] as const;

export const countKeys = {
  lists: COUNT_LIST_KEY,
  list: (query: CountListQuery) => [...COUNT_LIST_KEY, query] as const,
  /** 상세는 **실사마다** 갈린다 — 다른 실사를 골랐다가 되돌아와도 캐시가 그대로다. */
  detail: (inventoryCountId: number | null) =>
    ['inventory-counts', 'detail', inventoryCountId] as const,
};

const fetchInventoryCounts = async (
  client: Client,
  query: CountListQuery,
): Promise<CountListResult> => {
  const data = await runRequest(() => client.GET('/inventory/counts', { params: { query } }));

  return { items: data.items.map(toCountView), page: data.page };
};

/**
 * 실사 목록.
 *
 * **조건이 하나도 없어도 조회한다.** 화면에 들어오면 곧바로 진행 중인 실사가 보여야
 * 사용자가 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
 *
 * **기본 기간을 심지 않는다**(계획 결정 3). 첫 요청에 날짜가 실리지 않는다.
 *
 * **응답 갈래가 200뿐이다**(실측) — 이 오퍼레이션에는 403이 없다. 그래도 배너는 403 갈래를
 * 갖는다: 계약에 없다는 것이 게이트웨이가 막지 않는다는 뜻은 아니다.
 */
export const useInventoryCounts = (query: CountListQuery): UseQueryResult<CountListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: countKeys.list(query),
    queryFn: () => fetchInventoryCounts(client, query),
  });
};

const fetchInventoryCountDetail = async (
  client: Client,
  inventoryCountId: number,
): Promise<CountDetailView> => {
  const data = await runRequest(() =>
    client.GET('/inventory/counts/{inventoryCountId}', {
      params: { path: { inventoryCountId } },
    }),
  );

  return toCountDetailView(data);
};

/**
 * 고른 실사의 상세 — **헤더와 요약 4칸이 한 번에 온다.**
 *
 * **고르기 전에는 부르지 않는다.** 캐시 키가 고른 번호를 담으므로 같은 실사를 다시 그려도
 * 요청이 한 번을 넘지 않는다.
 *
 * **이 조회가 단계 판정의 근거다**(계획 결정 2). 200이면 S1, 404면 S4다 —
 * 목록에 그 실사가 있는지로 판정하지 않는다. `ct`는 경로 조각이라 목록과 무관하게 상세를
 * 부를 수 있고, 목록 소속으로 판정하면 **조건이 좁아 목록에 없는 실사를 고른 상태가 지워진다.**
 *
 * **응답의 `ETag`가 마감의 `If-Match`가 된다**(공유계약 A-4). 본문 필드로는 오지 않으므로
 * `etag-store`가 경로별로 보관하고, 그 소비는 PR ④에 있다 — 여기서는 조회만 한다.
 */
export const useInventoryCountDetail = (
  inventoryCountId: number | null,
): UseQueryResult<CountDetailView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: countKeys.detail(inventoryCountId),
    enabled: inventoryCountId !== null,
    queryFn: () => {
      if (inventoryCountId === null) {
        throw new Error('실사를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return fetchInventoryCountDetail(client, inventoryCountId);
    },
  });
};

/**
 * 그 실사가 **없는가**(404).
 *
 * 다른 실패와 갈라야 하는 이유는 사용자가 할 조치가 다르기 때문이다 — 없는 실사는 다시
 * 시도해도 나타나지 않으므로 「다시 시도」가 아니라 **주소 정리와 다시 고르기**로 안내한다
 * (계획 결정 2의 S4 · 수명 표 6행).
 *
 * **상세 조회의 실패 갈래는 404뿐이다**(실측 — 이 오퍼레이션의 응답은 200과 404 둘이다).
 * 그래도 다른 갈래를 남겨 둔다: 네트워크 끊김과 게이트웨이 오류는 계약에 적히지 않는다.
 */
export const isCountNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};
