import { useToast } from '@crefle/web-ui';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { hashKey, useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '../api-context';
import { runRequest } from '../request';

import { sessionKeys, useSession } from './session-context';

const t = messages.session;

export interface SignOutAction {
  signOut: () => void;
  /** 나가는 중에는 다시 누르지 못하게 한다 — 연타가 그대로 요청 두 벌이 된다. */
  isSigningOut: boolean;
}

/**
 * **로그아웃 — 서버 세션을 끊고 이 브라우저에 남은 것을 치운다.**
 *
 * ⭐ **서버가 끝났다고 답해야 끝난 것이다.** 자격은 서버가 내린 세션 쿠키에 있으므로, 요청이
 * 실패했는데 화면만 로그아웃한 척하면 **쿠키는 살아 있고** 다음 사람이 브라우저를 열면 그대로
 * 로그인돼 있다. 그래서 실패하면 세션을 유지하고 실패를 말한다 — 같은 규율의 반대편이
 * `session-context.tsx` 머리에 적혀 있다(저장소에 흉내를 내지 않는다).
 *
 * ⭐ **다른 조회의 캐시를 함께 버린다.** 관리웹은 사무실에서 여럿이 번갈아 쓰는 화면이라,
 * 캐시를 남겨 두면 다음 사람이 로그인한 직후 **앞사람이 보던 목록**이 잠깐 그려진다(재조회가
 * 끝나기 전까지). 권한 범위가 다른 사람이면 그 자체가 새는 것이다.
 *
 * ⛔ **세션 칸은 지우지 않고 「없음」으로 덮는다.** 통째로 지우면 관찰자가 곧바로 다시 물어
 * 보므로, 방금 끊은 세션을 확인하러 요청이 한 번 더 나간다.
 */
export const useSignOut = (): SignOutAction => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const { signOut: forgetSession } = useSession();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: (idempotencyKey: string): Promise<void> =>
      runRequest(() =>
        client.DELETE('/app/sessions/current', {
          params: { header: { 'Idempotency-Key': idempotencyKey } },
        }),
      ),
    onSuccess: () => {
      queryClient.removeQueries({
        predicate: (query) => hashKey(query.queryKey) !== hashKey(sessionKeys.current),
      });
      forgetSession();
    },
    onError: () => {
      toast.show({
        variant: 'error',
        title: t.signOutFailure.title,
        description: t.signOutFailure.body,
      });
    },
  });

  return {
    /*
     * ⭐ **멱등 키는 누를 때마다 새로 만든다.** 계약이 이 헤더를 쓰기 API 전부에 필수로 두었고,
     * 요청 함수 안에서 만들면 재시도가 새 키를 얻어 서버에는 서로 다른 요청이 된다
     * (전례 `screens/login/queries.ts`).
     */
    signOut: () => {
      if (mutation.isPending) return;

      mutation.mutate(createIdempotencyKey());
    },
    isSigningOut: mutation.isPending,
  };
};
