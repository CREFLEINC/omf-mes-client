import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PeriodQuery } from './period';
import type { MessageListResult } from './types';

/**
 * 이 화면의 읽기. 경로 리터럴은 여기와 `requests.ts`(쓰기)에만 둔다 —
 * `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 캐시 키는 `all`이 나머지의 접두라 한 번의 무효화로 목록이 함께 다시 조회된다.
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체. **기간은 필수**이고 나머지는 값이 있을 때만 키가 실린다 —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 */
export type MessageListQuery = PeriodQuery;

export const messageKeys = {
  all: ['integration-messages'] as const,
  list: (query: MessageListQuery | null) => ['integration-messages', 'list', query] as const,
};

const fetchMessageList = (client: Client, query: MessageListQuery): Promise<MessageListResult> =>
  runRequest(() => client.GET('/integration/messages', { params: { query } }));

/**
 * 연계 메시지 목록.
 *
 * **기간이 갖춰지지 않으면 조회하지 않는다**(`query === null`). 계약이 기간을 필수로 두어
 * 비운 채 보내면 400이 돌아오고, 사용자에게는 「조회가 늘 실패한다」로만 보인다.
 */
export const useMessageList = (
  query: MessageListQuery | null,
): UseQueryResult<MessageListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: messageKeys.list(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('기간을 정하기 전에는 목록을 조회하지 않습니다.');
      }

      return fetchMessageList(client, query);
    },
  });
};
