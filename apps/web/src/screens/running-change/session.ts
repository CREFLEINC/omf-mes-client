import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 열린 작업 세션 — **교체를 그 구간에 매다는 값**이고, **지금 물린 금형의 출처**다.
 *
 * 프로세스가 「작업자·POP **같은 세션**」이라 못박았지만(§5-4), `material_consumption`의
 * `work_session_id`는 계약이 **nullable**로 두었다. 그래서 이 조회는 **교체를 막지 않는다** —
 * 세션이 없으면 기록이 세션 밖에 남을 뿐 성립은 한다(§6).
 *
 * ⛔ **이 화면은 세션을 열지 않는다.** 세션을 여는 것은 `P-02-01`(작업 시작) 소관이다.
 * 여기서 열면 같은 구간을 두 화면이 만들게 되고, 어느 쪽이 정본인지 정할 근거가 없다.
 *
 * ⚠ **조회가 실패해도 교체를 막지 않는다.** 게이팅과 다른 축이다 — 게이팅은 「이 단말이
 * 투입해도 되는가」라 모르면 닫아야 하지만(F-6), 세션은 「이 교체가 어느 구간에 속하는가」라
 * 모르면 매달지 않을 뿐이다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 */

type Client = ApiClient['client'];

export const workSessionKeys = {
  open: (workOrderId: number) => ['running-change', 'work-session', workOrderId] as const,
};

/**
 * 지금 열려 있는 구간.
 *
 * `moldId`가 함께 오는 것이 이 화면에서 P-02-03 과 다른 점이다 — 스펙 §4-B 가 「교체 대상이
 * 금형이면 여기를 본다」로 `mdm.mold`를 읽기로 두었고, 그 번호를 아는 자리가 세션뿐이다.
 */
export interface OpenWorkSession {
  workSessionId: number | null;
  moldId: number | null;
}

export const NO_OPEN_SESSION: OpenWorkSession = { workSessionId: null, moldId: null };

/**
 * 이 W/O 에서 열려 있는 세션. 없으면 전부 `null`이다.
 *
 * **여럿이면 매달지 않는다.** 계약이 목록을 돌려주므로 둘 이상이 올 수 있는데, 그중 하나를
 * 화면이 고르면 **교체가 엉뚱한 구간에 붙는다** — 되돌릴 수 없는 기록이라(B-3) 고를 근거가
 * 없을 때는 비워 두는 쪽이 옳다. 계약이 이 칸을 nullable 로 둔 것이 그 여지다.
 */
const fetchOpenSession = async (client: Client, workOrderId: number): Promise<OpenWorkSession> => {
  const data = await runRequest(() =>
    client.GET('/production/work-sessions', {
      params: { query: { workOrderId, open: true } },
    }),
  );

  if (data.items.length !== 1) return NO_OPEN_SESSION;

  const session = data.items[0];
  if (session === undefined) return NO_OPEN_SESSION;

  return {
    workSessionId: session.workSessionId,
    moldId: session.moldId ?? null,
  };
};

/**
 * 열린 세션 조회.
 *
 * 조회 중이거나 실패했으면 전부 `null`이고, 그 상태에서도 교체는 선다.
 */
export const useOpenWorkSession = (workOrderId: number | null): OpenWorkSession => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: workSessionKeys.open(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: () => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 세션을 조회하지 않습니다.');
      }

      return fetchOpenSession(client, workOrderId);
    },
  });

  return query.data ?? NO_OPEN_SESSION;
};
