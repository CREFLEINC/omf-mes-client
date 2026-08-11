import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';
import type { CountFilterQuery } from './filters';
import {
  toCountDetailView,
  toCountView,
  type CountDetailView,
  type CountListResult,
} from './types';
import { OPEN_FORM_FIELDS } from './validation';

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
 * **이 PR은 읽기 둘과 쓰기 하나까지다.** 쓰기 셋은 잠금 규약이 서로 달라(**없음** / 선택 /
 * 필수) 각각의 PR에서 배선한다 — 여기 있는 개시가 그중 잠금이 **없는** 하나다.
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

type InventoryCountCreate = components['schemas']['InventoryCountCreate'];
type InventoryCountDetailResponse = components['schemas']['InventoryCountDetailResponse'];

export interface InventoryCountOpenOptions {
  /** 만들어진 실사. **화면 타입으로 옮겨 넘긴다** — 계약 응답이 화면 코드로 새지 않는다. */
  onSuccess: (detail: CountDetailView) => void;
}

/**
 * 실사 개시 — **이 화면의 첫째 쓰기이고 되돌릴 수 없다.**
 *
 * **공통 쓰기 훅을 그대로 쓰고 고치지 않는다**(계획 결정 16). 이름에 「마스터」가 들어 있으나
 * 그 훅은 리소스 이름을 알지 않는다 — 요청 함수·잠금 토큰 경로·무효화 키·화면이 아는 필드만
 * 받는다. 이름 변경은 `patterns/` 변경(높은 위험)이라 별도 작업으로 남긴다.
 *
 * **잠금 토큰이 없다**(`etagPath: null`). 이 오퍼레이션에는 `If-Match`가 아예 없고(실측)
 * 응답 갈래도 201·400·403뿐이라 충돌(409)이 나오지 않는다 — 저장 실패 배너에 「최신 불러오기」가
 * 뜨지 않는 이유가 그것이다. **세 쓰기 중 잠금 규약이 없는 것은 이 하나뿐이다**(치환은 선택,
 * 마감은 필수).
 *
 * **목록을 무효화한다.** 개시로 실사 전표가 하나 늘어나므로 목록이 낡는다 — 방금 만든 실사가
 * 목록에 보이지 않으면 사용자는 만들어졌는지 확인할 길이 없다. **상세는 함께 무효화되지
 * 않는다**(캐시 앞머리가 갈려 있다) — 새 실사의 상세는 `ct`가 옮겨 가면서 새로 뜬다.
 *
 * **남은 위험**: 응답을 받지 못한 뒤 다시 누르면 공통 훅이 **새 멱등 키**를 만들어 서버가
 * 재전송으로 보지 못한다. 제출 단위로 키를 고정하면 풀리는 문제이나 그것은 `patterns/` 변경이라
 * 범위 밖이다 — 화면 차원 완화 셋(전송 중 전면 잠금 · 성공 후 초안 비움 · 응답 없음 안내)으로
 * 다룬다.
 */
export const useInventoryCountOpen = (
  options: InventoryCountOpenOptions,
): MasterWriteResult<InventoryCountCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<InventoryCountCreate, InventoryCountDetailResponse>({
    request: (body, headers) =>
      client.POST('/inventory/counts', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [countKeys.lists],
    knownFields: OPEN_FORM_FIELDS,
    onSuccess: (data) => {
      options.onSuccess(toCountDetailView(data));
    },
  });
};
