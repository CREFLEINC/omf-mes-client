import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/** 지난 증상을 찾을 만큼만 본다. 목록 화면이 아니다. */
const RECENT_SIZE = 20;

/** 화면에 세우는 제안 수. 더 두면 증상 칸보다 제안이 커진다. */
const RECENT_SUGGESTIONS = 3;

export const equipmentFailureKeys = {
  openBreakdowns: (equipmentId: number | null) =>
    ['equipment-failure-open-breakdowns', equipmentId] as const,
};

/**
 * 이 설비에 아직 끝나지 않은 고장이 몇 건인가.
 *
 * 막는 데 쓰지 않는다. 다른 증상일 수 있으므로 사람이 보고 정한다.
 */
export const useOpenBreakdownCount = (equipmentId: number | null): UseQueryResult<number> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: equipmentFailureKeys.openBreakdowns(equipmentId),
    enabled: equipmentId !== null,
    queryFn: async () => {
      if (equipmentId === null) {
        throw new Error('설비를 고르기 전에는 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/maintenance/breakdowns', {
          params: { query: { equipmentId, openOnly: true, page: 0, size: 1 } },
        }),
      );

      // 건수만 필요하다. page 가 없으면 셀 수 없으므로 목록 길이로 물러난다.
      return data.page?.total ?? data.items.length;
    },
  });
};

/**
 * 이 설비에 지난번에 적힌 증상들.
 *
 * 증상은 코드로 강제하지 않는 자유 텍스트라(공유계약 A-12), 한 손에 기기를 들고 서서 치는
 * 자리다. 지난 것을 눌러 넣을 수 있어야 그 부담이 준다.
 */
export const useRecentSymptoms = (equipmentId: number | null): UseQueryResult<string[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['equipment-failure-recent-symptoms', equipmentId] as const,
    enabled: equipmentId !== null,
    queryFn: async () => {
      if (equipmentId === null) {
        throw new Error('설비를 고르기 전에는 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/maintenance/breakdowns', {
          params: { query: { equipmentId, page: 1, size: RECENT_SIZE } },
        }),
      );

      const seen = new Set<string>();

      for (const row of data.items) {
        const symptom = row.symptom.trim();

        if (symptom !== '') {
          seen.add(symptom);
        }
      }

      return [...seen].slice(0, RECENT_SUGGESTIONS);
    },
  });
};
