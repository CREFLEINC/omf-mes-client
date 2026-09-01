import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

export const workerKeys = {
  byNo: (workerNo: string | null) => ['worker-by-no', workerNo] as const,
};

/**
 * 사번이 가리키는 작업자 식별자.
 *
 * 담당자로 거르는 목록은 이 값을 요구한다. 비우면 본인이 되는 것이 아니다 - 현장 단말은
 * 계정 로그인이 없어 서버가 본인을 풀 근거가 없고, 비우면 남의 지시까지 함께 온다.
 *
 * 찾지 못한 것과 조회가 실패한 것을 가른다. 앞엣것은 데이터가 돌아온 정상 결과다.
 */
export const useWorkerId = (workerNo: string | null): UseQueryResult<number | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workerKeys.byNo(workerNo),
    enabled: workerNo !== null,
    queryFn: async () => {
      if (workerNo === null) {
        throw new Error('사번을 확인하기 전에는 작업자를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/workers', { params: { query: { q: workerNo } } }),
      );

      /*
       * 검색은 부분 일치라 사번이 비슷한 다른 사람이 함께 온다. 첫 줄을 그대로 쓰면 남의
       * 지시를 이 사람의 것으로 보인다.
       */
      return data.items.find((worker) => worker.workerNo === workerNo)?.workerId ?? null;
    },
  });
};
