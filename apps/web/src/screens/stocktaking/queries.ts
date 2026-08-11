import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';
import type { CountFilterQuery } from './filters';
import { LOCATION_LINE_PAGE_SIZE } from './line-replace-request';
import {
  toCountDetailView,
  toCountLineView,
  toCountView,
  type CountDetailView,
  type CountLineListResult,
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
 * **이 PR에서 읽기 셋과 쓰기 셋이 다 섰다.** 쓰기 셋은 잠금 규약이 서로 달라(**없음** /
 * 선택 / **필수**) 각각의 PR에서 배선했다 — 개시가 잠금이 **없는** 하나, 치환이 **선택**인
 * 하나, 마감이 **필수**인 하나다. 세 규약이 이 파일 안에 나란히 있어 서로 견줘 읽힌다.
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
  /** 한 실사의 라인 전부. **치환 성공 뒤 이 앞머리로 한 번에 무효화한다.** */
  linesOf: (inventoryCountId: number | null) =>
    ['inventory-counts', 'lines', inventoryCountId] as const,
  /** 라인은 **실사와 위치 둘 다로** 갈린다 — 위치를 옮겼다 되돌아와도 앞 위치의 줄이 안 보인다. */
  lines: (inventoryCountId: number | null, locationId: number | null) =>
    ['inventory-counts', 'lines', inventoryCountId, locationId] as const,
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

const fetchInventoryCountLines = async (
  client: Client,
  inventoryCountId: number,
  locationId: number,
): Promise<CountLineListResult> => {
  const data = await runRequest(() =>
    client.GET('/inventory/counts/{inventoryCountId}/lines', {
      params: {
        path: { inventoryCountId },
        /*
         * **좁히는 조건을 만들지 않는다**(계획 결정 6 · 감지기 M44). 계약에
         * `uncountedOnly`·`varianceOnly`·`itemId`가 있으나 그 조건으로 받은 목록을 치환에
         * 실으면 **나머지가 미실사로 되돌아간다** — 조건을 쓰는 자리가 없으면 그 사고 경로가
         * 코드에 없다.
         *
         * `size`를 싣는 것은 **이 조회 하나뿐이다**(목록은 서버 기본값을 쓴다). 한 위치는
         * 한 번에 받아야 하기 때문이며, 그래도 잘리면 저장을 차단한다(계획 결정 8).
         */
        query: { locationId, size: LOCATION_LINE_PAGE_SIZE },
      },
    }),
  );

  return { items: data.items.map(toCountLineView), page: data.page };
};

/**
 * 고른 위치의 라인.
 *
 * **실사와 위치가 둘 다 있어야 조회가 성립한다**(완료 조건 C31 · 감지기 M33). 하나라도 없으면
 * 부르지 않는다 — 「조회가 성립하지 않는데 하위 요청만 나가 스켈레톤에 갇힌다」(W-01-07 Minor)를
 * 막는 자리이고, `?? 0` 같은 대체값으로 메우면 **없는 실사·위치의 경로로 요청이 나간다.**
 *
 * **응답 갈래가 200뿐이다**(실측) — 이 오퍼레이션에는 403도 404도 없다. 그래도 배너는 갈래를
 * 갖는다: 계약에 없다는 것이 게이트웨이가 막지 않는다는 뜻은 아니다.
 */
export const useInventoryCountLines = (
  inventoryCountId: number | null,
  locationId: number | null,
): UseQueryResult<CountLineListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: countKeys.lines(inventoryCountId, locationId),
    enabled: inventoryCountId !== null && locationId !== null,
    queryFn: () => {
      if (inventoryCountId === null || locationId === null) {
        throw new Error('실사와 위치를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      return fetchInventoryCountLines(client, inventoryCountId, locationId);
    },
  });
};

type InventoryCountCreate = components['schemas']['InventoryCountCreate'];
type InventoryCountDetailResponse = components['schemas']['InventoryCountDetailResponse'];
type InventoryCountLineReplace = components['schemas']['InventoryCountLineReplace'];
type InventoryCountLineListResponse = components['schemas']['InventoryCountLineListResponse'];
type InventoryCountClose = components['schemas']['InventoryCountClose'];

/**
 * 한 실사의 상세 경로.
 *
 * **낙관적 잠금 토큰이 이 경로에 매여 있다**(`etag-store`가 경로별로 보관한다). 치환과 마감이
 * 그 토큰을 쓰는데, 경로 문자열을 자리마다 짓면 한 글자만 달라도 **토큰을 못 찾은 채 조용히
 * 지나간다** — 치환은 그때 토큰 없이 나가고 마감은 아예 멈춘다. 한 곳에서 짓는다.
 */
const detailPathOf = (inventoryCountId: number): string =>
  `/inventory/counts/${String(inventoryCountId)}`;

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

export interface InventoryCountLineReplaceOptions {
  /** 어느 실사의 라인인가. **없으면 보낼 수 없다** — 경로 조각이라 지어낼 수 없다. */
  inventoryCountId: number | null;
  /** 치환 결과. **서버가 되돌려 준 줄**을 화면 타입으로 옮겨 넘긴다. */
  onSuccess: (result: CountLineListResult) => void;
}

/**
 * 한 위치의 라인 치환 — **이 화면의 둘째 쓰기이고 파괴적이다.**
 *
 * 계약이 「여기 없는 기존 라인은 미실사로 되돌린다」라 적었다. 되돌릴 수 **있는** 유일한 쓰기이나
 * (같은 위치를 다시 치환하면 된다) 그 되돌림도 **무엇이 사라졌는지 알아야** 할 수 있다 —
 * 그래서 전 줄 필수·잘림 차단·빈 배열 금지가 `line-replace-request.ts`에 겹으로 서 있다.
 *
 * **낙관적 잠금이 선택이다**(`IfMatchVersionOptional` — 실측). 세 쓰기 중 이 하나만 그렇다:
 * 개시에는 `If-Match`가 아예 없고 마감은 필수다. 계약이 그 이유도 적었다 — 「오프라인에서도
 * 쓰는 오퍼레이션에서는 선택이다. 큐에 쌓인 요청은 토큰을 싣지 않는다」(현장 단말이 같은
 * 경로를 쓴다).
 *
 * **그래서 공통 훅의 `etagPath`를 쓰지 않는다.** 그 규약은 「없으면 보내지 않고 멈춘다」
 * (`staleToken`)인데, 여기서는 **없어도 보내는 것이 계약이 정한 동작**이다(완료 조건 C46).
 * 대신 요청 함수가 보관소를 직접 보고 **있으면 싣는다** — 훅을 고치면 `patterns/` 변경이라
 * 높은 위험이고 다른 소비 화면 10여 개가 함께 바뀐다(계획 결정 16).
 *
 * **화면이 아는 필드 이름이 없다**(`knownFields: []`). 계약이 줄마다의 오류를 어떤 이름으로
 * 주는지 정하지 않았고(실측), 지어내 맞추면 **엉뚱한 줄에 붙는다** — 표 안 입력칸은 줄마다
 * 있어 한 칸만 틀려도 사용자가 다른 줄을 고친다. 전부 배너로 올려 서버 문구를 그대로 낸다.
 *
 * **성공 뒤 상세와 라인을 함께 무효화한다**(승인 13-7 · 감지기 M47). 치환 200 응답에 `ETag`가
 * 없어(실측) 마감의 `If-Match`가 낡고, 요약 4칸도 낡는다 — 상세를 다시 읽는 한 번이 둘을 다
 * 해결한다. 라인만 다시 부르면 **요약이 낡은 채로 마감 버튼의 활성 여부를 정한다**(PR ④).
 */
export const useInventoryCountLineReplace = (
  options: InventoryCountLineReplaceOptions,
): MasterWriteResult<InventoryCountLineReplace> => {
  const { client, etags } = useApiClient();
  const { inventoryCountId } = options;

  return useMasterWrite<InventoryCountLineReplace, InventoryCountLineListResponse>({
    request: (body, headers) => {
      if (inventoryCountId === null) {
        throw new Error('실사를 고르기 전에는 라인을 치환하지 않습니다.');
      }

      /* 토큰은 **상세 조회가 남긴 것**이다 — 치환·마감 응답에는 `ETag`가 없다(실측). */
      const ifMatch = etags.ifMatch(detailPathOf(inventoryCountId));

      return client.PUT('/inventory/counts/{inventoryCountId}/lines', {
        params: {
          path: { inventoryCountId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
          },
        },
        body,
      });
    },
    etagPath: null,
    invalidateKeys: [countKeys.detail(inventoryCountId), countKeys.linesOf(inventoryCountId)],
    knownFields: [],
    onSuccess: (data) => {
      options.onSuccess({ items: data.items.map(toCountLineView), page: data.page });
    },
  });
};

export interface InventoryCountCloseOptions {
  /** 어느 실사를 마감하는가. **없으면 보낼 수 없다** — 경로 조각이라 지어낼 수 없다. */
  inventoryCountId: number | null;
  /** 마감된 실사. **화면 타입으로 옮겨 넘긴다** — 계약 응답이 화면 코드로 새지 않는다. */
  onSuccess: (detail: CountDetailView) => void;
}

/**
 * 실사 마감 — **이 화면의 셋째 쓰기이고 되돌릴 수 없다.**
 *
 * 마감한 실사를 다시 여는 오퍼레이션이 계약에 없다(실측 — 이 자원의 경로는 넷뿐이다).
 * 개시도 되돌릴 수 없지만 잘못 개시하면 쓸모없는 전표가 하나 남을 뿐이고, 마감은 **진행 중인
 * 실사를 끝낸다** — 그래서 확인 창과 요약 조건이 그 앞에 선다(`close-guard.ts`).
 *
 * **낙관적 잠금이 필수다**(`IfMatchVersion` — 실측). 세 쓰기 중 이 하나만 그렇다: 개시에는
 * `If-Match`가 아예 없고 치환은 선택이다. 그래서 **공통 훅의 `etagPath`를 그대로 쓴다** —
 * 그 규약이 「없으면 보내지 않고 멈춘다」(`staleToken`)인데, 여기서는 **그것이 옳다.**
 * 목 서버가 `If-Match` 없는 마감을 400으로 되돌리는 것을 실왕복으로 확인했다.
 * 치환이 같은 규약을 쓸 수 없어 우회한 것과 **정반대 방향**이며, 그 갈림이 계약 그대로다.
 *
 * **토큰은 상세 조회가 남긴 것이다.** 치환 200에도 마감 200에도 `ETag` 헤더가 없다(실왕복
 * 재확인) — 그래서 치환 성공 뒤 상세를 다시 읽어(승인 13-7) 마감이 쓸 토큰을 새로 받는다.
 *
 * **화면이 아는 필드 이름이 없다**(`knownFields: []`). 치환과 결론은 같지만 **이유가 다르다** —
 * 치환은 서버가 줄 오류를 어떤 이름으로 주는지 계약이 정하지 않아서이고, 마감은 **보내는 값이
 * `businessDate` 하나인데 그 값을 넣는 입력칸이 화면에 없기** 때문이다(화면이 실행 시각에서
 * 파생한다). 이름을 채우면 그 오류가 인라인으로 분류되는데 **붙일 칸이 없어 조용히 사라진다** —
 * 사용자에게는 「마감을 눌렀는데 아무 일도 없다」로 보인다. 전부 배너로 올려 서버 문구를
 * 그대로 낸다.
 *
 * **목록과 상세를 무효화한다.** 마감으로 상태 코드와 요약이 바뀌므로 둘 다 낡는다 —
 * 목록을 두면 마감한 실사가 「진행 중」으로 보이고, 상세를 두면 요약이 마감 전 값으로 남는다.
 * **라인은 무효화하지 않는다** — 마감이 줄을 바꾸지 않고, 마감 성공은 `loc`를 비워
 * 라인 구획 자체를 닫는다.
 */
export const useInventoryCountClose = (
  options: InventoryCountCloseOptions,
): MasterWriteResult<InventoryCountClose> => {
  const { client } = useApiClient();
  const { inventoryCountId } = options;

  return useMasterWrite<InventoryCountClose, InventoryCountDetailResponse>({
    request: (body, headers) => {
      const ifMatch = headers['If-Match'];

      /*
       * **훅 규약이 이미 막는 자리다** — `etagPath`가 있으면 토큰이 없을 때 보내지 않고
       * 멈추고, 실사를 고르기 전에는 화면이 버튼을 그리지 않는다. 값으로 메우지 않고 타입을
       * 좁히기만 한다 — 빈 `If-Match`나 `0` 같은 대체값을 실으면 **계약 위반이 조용히 나간다.**
       */
      if (inventoryCountId === null || ifMatch === undefined) {
        throw new Error('실사와 낙관적 잠금 토큰이 있어야 마감을 보냅니다.');
      }

      return client.POST('/inventory/counts/{inventoryCountId}:close', {
        params: {
          path: { inventoryCountId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'], 'If-Match': ifMatch },
        },
        body,
      });
    },
    etagPath: inventoryCountId === null ? null : detailPathOf(inventoryCountId),
    invalidateKeys: [countKeys.lists, countKeys.detail(inventoryCountId)],
    knownFields: [],
    onSuccess: (data) => {
      options.onSuccess(toCountDetailView(data));
    },
  });
};
