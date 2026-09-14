import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { usePopIdentity } from './pop-identity';
import { POP_SCREENS, type PopScreen } from './pop-screen-catalog';
import { runRequest } from './request';

/**
 * **이 단말이 갈 수 있는 POP 화면**을 판정한다(공유계약 G-34).
 *
 * ⭐ POP 설치본에서는 현재 단말 Bearer로 자기 화면 정책(P-10)을 읽는다. 관리웹 세션으로
 * 렌더하는 경우에는 기존 세션 권한을 사용한다. 사번은 기록 귀속이지 화면 권한이 아니다.
 *
 * ⭐ **누르기 전에 거른다.** 서버가 명시한 코드와 설치된 화면의 교집합만 후보로 둔다.
 * `terminal_process`의 8개 플래그를 16개 화면 코드로 추측해 늘리지 않는다.
 *
 * ⚠ **「모른다」와 「없다」를 갈라 둔다.** 계약이 갈라 놓은 그대로다 — 필드가 **없으면** 값
 * 목록이 아직 정해지지 않았다는 뜻이라 판정하지 않고 사유를 보이며(공유계약 G-2), **빈
 * 배열**은 「아무 기능 권한도 없다」다. 같게 다루면 목록을 못 받은 단말이 「권한 없음」으로
 * 보여 원인이 가려진다. 조회 자체가 실패한 경우도 「모른다」로 둔다.
 */

/**
 * 후보 판정의 결과.
 *
 * - `loading` 아직 세션을 받지 못했다
 * - `unknown` 판정할 근거가 없다 — 조회 실패이거나 권한 목록이 아직 정해지지 않았다
 * - `empty` 판정했고 갈 수 있는 화면이 없다
 * - `ready` 갈 수 있는 화면이 있다
 */
export type PopAccessState = 'loading' | 'unknown' | 'empty' | 'ready';

export interface PopAccess {
  state: PopAccessState;
  screens: readonly PopScreen[];
}

/** 세션 응답에서 이 판정이 쓰는 부분만 본다 — 나머지 필드는 이 자리의 관심이 아니다. */
interface AccessCodes {
  codes?: string[];
}

export const popAccessKeys = {
  session: ['pop', 'session', 'permissions'] as const,
  terminal: (terminalId: number) => ['pop', 'terminal', 'accessible-screens', terminalId] as const,
};

/**
 * ⚠ **세션은 자주 바뀌지 않지만 무한정 묵히지도 않는다.** 단말은 하루 종일 켜져 있어, 권한을
 * 새로 받은 사람이 단말을 껐다 켜야만 반영되는 것은 곤란하다. 5분이면 교대 사이에 한 번은
 * 다시 묻는다.
 */
const SESSION_STALE_MS = 5 * 60 * 1000;

export const useAccessiblePopScreens = (): PopAccess => {
  const { client } = useApiClient();
  const { terminalId } = usePopIdentity();

  const query = useQuery({
    queryKey: terminalId === null ? popAccessKeys.session : popAccessKeys.terminal(terminalId),
    staleTime: SESSION_STALE_MS,
    queryFn: async (): Promise<AccessCodes> => {
      if (terminalId === null) {
        const session = await runRequest(() => client.GET('/app/sessions/current'));
        return { codes: session.permissions };
      }

      const policy = await runRequest(() =>
        client.GET('/mdm/terminals/{terminalId}/accessible-screens', {
          params: { path: { terminalId } },
        }),
      );
      return { codes: policy.screenCodes };
    },
  });

  if (query.isPending) return { state: 'loading', screens: [] };
  // 재조회 실패 때 이전 토큰 세대의 캐시가 남아도 그 코드를 권한으로 재사용하지 않는다.
  if (query.isError) return { state: 'unknown', screens: [] };

  const permissions = query.data?.codes;

  if (permissions === undefined) return { state: 'unknown', screens: [] };

  const granted = new Set(permissions);
  const screens = POP_SCREENS.filter((screen) => granted.has(screen.code));

  return { state: screens.length === 0 ? 'empty' : 'ready', screens };
};
