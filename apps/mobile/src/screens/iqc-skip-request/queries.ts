import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

export type ApprovalRequest = components['schemas']['ApprovalRequest'];

/**
 * 검사 대기 상태의 코드 문자열.
 *
 * 계약이 품질 판정 축의 값 넷을 이름으로 적어 두었고 그중 하나다. 값 목록 자체는 공통코드가
 * 내려주지만, 이 화면은 그중 한 값인지만 물으므로 목록을 받아 올 자리가 없다.
 */
export const INSPECTION_PENDING = 'INSPECTION_PENDING';

/**
 * 승인 요청이 가리키는 대상의 유형.
 *
 * 다형 참조라 같은 번호가 다른 표를 가리킬 수 있다. 유형 없이 번호만으로 물으면 남의 표의
 * 요청을 이 LOT 의 것으로 읽는다.
 */
export const INBOUND_LOT = 'INBOUND_LOT';

export const iqcSkipKeys = {
  pending: (lotId: number | null) => ['iqc-skip-pending', lotId] as const,
  mine: (workerNo: string | null) => ['iqc-skip-mine', workerNo] as const,
};

/**
 * 이 LOT 에 아직 끝나지 않은 요청이 있는가.
 *
 * 막지 않는다. 취소가 없는 화면이라 다시 올리는 것이 유일한 정정 경로이고, 막으면 그 길까지
 * 닫힌다.
 */
export const usePendingRequest = (lotId: number | null): UseQueryResult<ApprovalRequest | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcSkipKeys.pending(lotId),
    enabled: lotId !== null,
    queryFn: async () => {
      if (lotId === null) {
        throw new Error('LOT을 찾기 전에는 요청을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/app/approval-requests', {
          params: {
            query: { targetTypeCode: INBOUND_LOT, targetId: lotId, pendingOnly: true, size: 1 },
          },
        }),
      );

      return data.items[0] ?? null;
    },
  });
};

/**
 * 내가 올린 요청.
 *
 * 승인 유형으로 거르지 않는다. 그 코드 문자열은 아직 확정 전이라, 지어내 실으면 값이 달라지는
 * 순간 목록이 조용히 빈다 - 비어 있는 것과 없는 것이 화면에서 같아 보인다.
 *
 * 사번을 싣는다. 이 셸에는 계정 로그인이 없어 서버가 상신자를 풀 근거가 그 헤더뿐이고, 한
 * 단말을 여러 사람이 교대로 쓰므로 없이 부르면 남이 올린 요청이 섞인다. 목록이 비는 것이
 * 아니라 채워진 채로 틀려서 화면으로는 보이지 않는다.
 *
 * 사번을 모르는 동안에는 부르지 않는다 - 교대 중에 부르면 그 사이의 답이 누구 것인지 모른다.
 */
export const useMyRequests = (workerNo: string | null): UseQueryResult<ApprovalRequest[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcSkipKeys.mine(workerNo),
    enabled: workerNo !== null,
    queryFn: async () => {
      if (workerNo === null) {
        throw new Error('사번을 확인하기 전에는 내가 올린 요청을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/app/approval-requests', {
          params: { query: { requestedByMe: true, size: 20 } },
          /*
           * params.header 로 싣지 못한다 - 이 헤더는 계약에 갓 선언됐고 생성 타입이 아직
           * 그 회차를 타지 않았다. 편입은 다른 팀 소관이라 우리가 재생성하지 않는다.
           * 편입되면 params.header 로 옮긴다.
           */
          headers: { 'X-Worker-No': workerNo },
        }),
      );

      return data.items;
    },
  });
};
