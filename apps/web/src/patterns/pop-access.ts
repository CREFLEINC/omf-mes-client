import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { POP_SCREENS, type PopScreen } from './pop-screen-catalog';
import { runRequest } from './request';

/**
 * **이 단말이 갈 수 있는 POP 화면**을 판정한다(공유계약 G-34).
 *
 * ⭐ **판정축은 단말 계정 하나다.** POP 의 사번은 「누가 기록을 남기는가」이지 「무엇을 볼 수
 * 있는가」가 아니다 — 「관리 화면=계정 권한 / POP=사번 귀속」으로 이원화돼 있고(REQ-PR-0023
 * D1), 진입 화면 `P-CO-01` 은 **권한 판정을 하지 않는다**(§5-1). 그래서 사번이 바뀌어도 후보는
 * 바뀌지 않는다.
 *
 * ⭐ **누르기 전에 거른다.** 계약이 세션 권한 배열을 두고 「403 을 받아 보고 아는 것이 아니라
 * «누르기 전에» 판정한다」고 못박았다(`Session.permissions`). 이동한 뒤 403 으로 되돌아오는
 * 길은 작업자에게 「고장」으로 보인다.
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
interface SessionPermissions {
  permissions?: string[];
}

export const popAccessKeys = {
  session: ['pop', 'session', 'permissions'] as const,
};

/**
 * ⚠ **세션은 자주 바뀌지 않지만 무한정 묵히지도 않는다.** 단말은 하루 종일 켜져 있어, 권한을
 * 새로 받은 사람이 단말을 껐다 켜야만 반영되는 것은 곤란하다. 5분이면 교대 사이에 한 번은
 * 다시 묻는다.
 */
const SESSION_STALE_MS = 5 * 60 * 1000;

export const useAccessiblePopScreens = (): PopAccess => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: popAccessKeys.session,
    staleTime: SESSION_STALE_MS,
    queryFn: (): Promise<SessionPermissions> =>
      runRequest(() => client.GET('/app/sessions/current')),
  });

  if (query.isPending) return { state: 'loading', screens: [] };

  const permissions = query.data?.permissions;

  if (permissions === undefined) return { state: 'unknown', screens: [] };

  const granted = new Set(permissions);
  const screens = POP_SCREENS.filter((screen) => granted.has(screen.code));

  return { state: screens.length === 0 ? 'empty' : 'ready', screens };
};
