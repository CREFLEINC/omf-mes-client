import type { ReactNode } from 'react';

import { PopIdentityProvider } from './pop-identity';
import { useWorkerSession } from './worker-session';

/**
 * **개발 서버에서만 서는** POP 단말 신원 공급자.
 *
 * ⭐ **왜 있는가.** `pop-identity`는 「받는 자리만 세우고 채우는 것은 셸에 맡긴다」로 두었고,
 * 그 셸이 아직 없다. 그래서 POP 화면은 조회는 되는데 **저장·발행이 「단말이 확인되지
 * 않았습니다」로 잠긴 채** 뜬다 — 확인·시연에서 화면의 절반만 볼 수 있었다(실측).
 *
 * ⛔ **누가 어떻게 채우는가는 설계가 정할 자리다**(`pop-identity` 머리말). 이 파일은 그
 * 결정을 대신하지 않는다 — **개발 서버에서만** 목 서버의 값으로 임시로 메우고, 설계가
 * 방식을 정하면 이 파일을 걷어낸다. 배포본에는 들어가지 않으므로 현장 단말이 이 값으로
 * 통과하는 일은 없다.
 *
 * ⚠ **사번은 지어내기 전에 화면이 정한 것을 먼저 쓴다.** 진입 화면(P-CO-01)이 사번을
 * `worker-session`에 두므로, 사람이 실제로 친 사번으로 기록되는 편이 시연에 정직하다.
 * 아직 아무도 치지 않았을 때만 데모 사번으로 내려간다.
 */

/** 목 서버에 있는 단말. `GET /mdm/terminals/{terminalId}` 가 이 번호로 답한다. */
export const POP_DEV_TERMINAL_ID = 1001;

/** 게이팅 판정의 대상 공정. 목 서버의 공정 하나를 쓴다. */
export const POP_DEV_PROCESS_ID = 1001;

/** 아무도 사번을 치지 않았을 때의 값. 목 서버 조회가 통하는 사번이다. */
export const POP_DEV_WORKER_NO = '100029';

export interface PopDevIdentityProviderProps {
  children: ReactNode;
}

export const PopDevIdentityProvider = ({ children }: PopDevIdentityProviderProps) => {
  const session = useWorkerSession();

  return (
    <PopIdentityProvider
      value={{
        terminalId: POP_DEV_TERMINAL_ID,
        processId: POP_DEV_PROCESS_ID,
        workerNo: session?.worker.workerNo ?? POP_DEV_WORKER_NO,
      }}
    >
      {children}
    </PopIdentityProvider>
  );
};
