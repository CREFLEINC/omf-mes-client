import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import type { DocumentProgressListQuery } from './filters';
import { toDocumentProgressView, type DocumentProgressListResult } from './types';

/**
 * 이 화면의 요청 — **이 회차에는 읽기 하나다.**
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 문서 유형을 고르면 | 그 유형의 진행현황 목록 |
 *
 * ⭐ **유형을 고르기 전에는 아무것도 부르지 않는다.** `documentTypeCode`가 계약의 **필수**
 * 질의값이라 유형 없이 부를 방법 자체가 없고, 유형 값 목록이 확정되지 않은 지금은 어떤 주소로
 * 들어와도 그 상태다 — 조회가 성립하는가는 `filters.ts`의 `toListQuery`가 한 곳에서 판정하고
 * (`null`이면 성립하지 않는다) 이 훅은 그 결과를 나른다. 여기서 다시 판정하면 두 자리가 갈린다.
 *
 * **참조 조회를 두지 않는다.** 품목·자재 LOT·창고는 번호로만 좁힌다 — 이름 목록을 얹으면 그
 * 조회의 좁힘·잘림 규칙이 함께 따라오는데, 이 회차의 목록은 그 이름을 그리지 않는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

/**
 * 이 자원의 조회를 덮는 뿌리 키.
 *
 * **목록과 상세의 앞머리를 갈라 둔다** — 하나로 묶으면 목록만 다시 부르려 해도 상세까지 함께
 * 무효화된다. 상세 키는 상세 조회가 생기는 회차(단위 ②)에서 이 자리에 더한다.
 *
 * ⚠ **이 회차에는 이 글자를 바꿔도 화면이 달라지지 않는다**(뮤테이션 실측 — 살아남는 뮤턴트).
 * 지금 이 키를 만드는 자리도 읽는 자리도 하나뿐이라, 이름이 통째로 바뀌면 캐시 항목의 이름만
 * 바뀔 뿐 조회·표시·요청 어느 것도 갈리지 않는다. **감지기를 억지로 만들지 않는다** — 감지기가
 * 잴 수 있는 사실이 아직 없기 때문이다.
 *
 * **갈리는 조건**: 쓰기가 붙는 회차(단위 ③④)에 성공 뒤 `documentProgressKeys.all`로 무효화를
 * 걸면, 그때부터 `all`과 `list`의 앞머리가 어긋나는 순간 「취소를 올렸는데 목록이 그대로인」
 * 화면이 생긴다 — 그 회차에서 이 자리가 감지기의 대상이 된다.
 */
const ALL_KEY = ['document-progress'] as const;

export const documentProgressKeys = {
  /**
   * 뿌리 키. **쓰기가 붙는 회차(단위 ③④)에 취소 요청·취소 실행 성공 뒤 이 하나를 무효화한다** —
   * 목록과 상세가 함께 갱신돼야 「취소를 올렸는데 아직 안 올린 것으로 보이는」 화면이 생기지
   * 않는다. 지금은 쓰기가 없어 소비처가 없고, 그 사실을 적어 두는 것이 「쓰이지 않는 자리」와
   * 「아직 쓰이지 않는 자리」를 가른다.
   */
  all: ALL_KEY,
  list: (query: DocumentProgressListQuery) => [...ALL_KEY, 'list', query] as const,
};

const fetchDocumentProgressList = async (
  client: Client,
  query: DocumentProgressListQuery,
): Promise<DocumentProgressListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/document-progress', { params: { query } }),
  );

  return { items: data.items.map(toDocumentProgressView), page: data.page };
};

/**
 * 조회가 성립하지 않을 때의 캐시 키 자리.
 *
 * **키에 `null`을 그대로 넣지 않는다** — 그러면 키의 모양이 성립할 때와 달라져, 「부르지 않는
 * 동안」과 「부르는 동안」이 서로 다른 캐시 항목을 가리키는지 읽기 어려워진다. 어차피 `enabled`가
 * 거짓이라 이 키로는 아무 요청도 나가지 않으며, `documentTypeCode`가 빈 문자열인 것이 곧
 * 「고른 유형이 없다」는 사실이다.
 */
const EMPTY_QUERY: DocumentProgressListQuery = { documentTypeCode: '', cancellableOnly: false };

/**
 * 고른 유형의 진행현황 목록.
 *
 * **질의가 `null`이면 부르지 않는다.** 「부를 수 있는가」의 판정은 `toListQuery` 한 곳이 하고,
 * 여기서는 그 결과를 `enabled`로 옮길 뿐이다 — `queryFn`의 가드는 그 규약이 깨졌을 때
 * **조용히 요청을 내보내지 않고 멈추게** 하는 둘째 겹이다.
 *
 * **정렬을 열지 않는다** — 계약의 이 조회에 정렬 파라미터가 없고(실측), 화면 안에서만 정렬하면
 * 쪽과 어긋난다.
 */
export const useDocumentProgressList = (
  query: DocumentProgressListQuery | null,
): UseQueryResult<DocumentProgressListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: documentProgressKeys.list(query ?? EMPTY_QUERY),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('문서 유형을 고르기 전에는 진행현황을 조회하지 않습니다.');
      }

      return fetchDocumentProgressList(client, query);
    },
  });
};

/**
 * 이 화면이 **덮지 않는 문서 유형**인가(400).
 *
 * 계약이 이 조회의 실패 응답을 **400 하나만** 두었고 그 설명에 「덮지 않는 문서 유형이면 여기로
 * 온다」라고 적었다. 그래서 400을 일반 조회 실패와 갈라야 한다 — 「불러오지 못했습니다」로
 * 뭉개면 사용자가 「다시 시도」를 되풀이하는데 몇 번을 눌러도 같은 답이 온다.
 *
 * **400이 두 모양으로 정규화된다.** 응답 본문에 `errors` 배열이 실려 오면 `validation`이 되고,
 * `message`만 오면 `http`(400)가 된다 — 어느 쪽이 오는지는 서버가 정하므로 **둘 다** 이 갈래로
 * 받는다. 한쪽만 보면 서버가 본문 모양을 바꾸는 순간 이 안내가 조용히 사라진다.
 */
export const isUnsupportedDocumentType = (error: unknown): boolean => {
  const apiError = toApiError(error);

  if (apiError.kind === 'validation') return true;

  return apiError.kind === 'http' && apiError.status === 400;
};
