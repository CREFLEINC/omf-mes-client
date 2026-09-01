import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 열린 작업 세션 — **투입을 그 구간에 매다는 값**이다.
 *
 * 세션은 「한 단말에서 한 교대 동안 이 W/O를 돌린 구간」이고, `material_consumption`의
 * `work_session_id`는 **nullable**이다(스펙 §5-5). 그래서 이 조회는 **투입을 막지 않는다** —
 * 세션이 없어도 투입은 선다. 긴급 투입·사후 입력이 그 경우다.
 *
 * ⛔ **이 화면은 세션을 열지 않는다.** 스펙 §5-5가 「열린 세션에 붙는 것만 다룬다」로
 * 못박았고, 세션을 여는 것은 `P-02-01`(작업 시작) 소관이다. 여기서 열면 같은 구간을 두 화면이
 * 만들게 되고, 어느 쪽이 정본인지 정할 근거가 없다.
 *
 * ⚠ **조회가 실패해도 투입을 막지 않는다.** 게이팅과 다른 축이다 — 게이팅은 「이 단말이 투입해도
 * 되는가」라 모르면 닫아야 하지만(F-6), 세션은 「이 투입이 어느 구간에 속하는가」라 모르면
 * 매달지 않을 뿐이다. 세션을 못 읽었다고 투입을 막으면 계약이 nullable로 둔 것을 화면이
 * 필수로 만든다.
 */

type Client = ApiClient['client'];

export const workSessionKeys = {
  open: (workOrderId: number) => ['material-input-scan', 'work-session', workOrderId] as const,
};

/**
 * 이 W/O에서 열려 있는 세션의 번호. 없으면 `null`이다.
 *
 * **여럿이면 매달지 않는다.** 계약이 목록을 돌려주므로 둘 이상이 올 수 있는데, 그중 하나를
 * 화면이 고르면 **투입이 엉뚱한 구간에 붙는다** — 되돌릴 수 없는 기록이라(B-3) 고를 근거가
 * 없을 때는 비워 두는 쪽이 옳다. 계약이 이 칸을 nullable로 둔 것이 그 여지다.
 */
const fetchOpenSessionId = async (client: Client, workOrderId: number): Promise<number | null> => {
  const data = await runRequest(() =>
    client.GET('/production/work-sessions', {
      params: { query: { workOrderId, open: true } },
    }),
  );

  return data.items.length === 1 ? (data.items[0]?.workSessionId ?? null) : null;
};

/**
 * 열린 세션 조회.
 *
 * 반환은 **번호 하나**다 — 화면이 세션을 다루지 않으므로 그 밖의 것을 들고 있을 이유가 없다.
 * 조회 중이거나 실패했으면 `null`이고, 그 상태에서도 투입은 선다.
 */
export const useOpenWorkSession = (workOrderId: number | null): number | null => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: workSessionKeys.open(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: () => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 세션을 조회하지 않습니다.');
      }

      return fetchOpenSessionId(client, workOrderId);
    },
  });

  return query.data ?? null;
};
