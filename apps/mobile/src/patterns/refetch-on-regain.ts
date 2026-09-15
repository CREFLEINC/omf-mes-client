import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useServerReachable } from './online-status';

/**
 * 다시 닿기 시작하면 실패한 채로 멈춘 조회를 다시 받는다.
 *
 * 끊긴 동안 나간 요청은 실패한 채로 멈춘다 - 조회 기본값이 `networkMode: 'always'` 라 요청이
 * 나가고, `retry: 0` 이라 오류 상태에 머문다. 다시 답을 받기 시작해도 그것을 풀 계기가 없다.
 *
 * 그대로 두면 화면이 값을 들고 있으면서 연결을 확인하라고 말한다 - 실측 2026-09-15 에 망이
 * 돌아온 뒤에도 도착 위치를 확인할 수 없다는 줄이 그 위치 값 바로 위에 남아 있었다. 연결을
 * 확인하라는 말은 자리를 옮기라는 뜻이라, 멀쩡한 단말을 든 사람을 헛되이 움직인다.
 *
 * 지금 화면이 보고 있는 것 가운데 오류인 것만 다시 받는다. 성공해 있는 것까지 부르면 연결이
 * 돌아올 때마다 화면 전부가 다시 묻고, 화면 밖 것까지 부르면 그동안 쌓인 오류 조회가 한꺼번에
 * 나간다 - 화면 밖 것은 그 화면을 다시 열 때 어차피 다시 조회한다.
 *
 * 닿는지를 보이는 값을 방아쇠로만 쓴다. 이 훅은 화면 갈래를 가르지 않는다.
 */
export const useRefetchOnRegain = (): void => {
  const reachable = useServerReachable();
  const queryClient = useQueryClient();
  const before = useRef(reachable);

  useEffect(() => {
    const regained = !before.current && reachable;
    before.current = reachable;

    if (!regained) {
      return;
    }

    void queryClient.refetchQueries({
      type: 'active',
      predicate: (query) => query.state.status === 'error',
    });
  }, [queryClient, reachable]);
};
