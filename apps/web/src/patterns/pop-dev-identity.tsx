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
 * ⚠ **모바일 셸은 같은 문제를 다르게 풀었다** — `apps/mobile/src/app/shell-gate.tsx` 가
 * 「등록되지 않은 단말은 어떤 화면에도 닿지 못한다」로 막고 등록 화면을 세운다. 그쪽이
 * 「모르는 것을 통과로 처리하지 않는다」(공유계약 F-6)에 곧게 서 있고, 이 파일은 그 원칙을
 * **개발 서버에 한해** 접은 것이다. POP 의 등록 흐름을 설계가 정할 때 그 형태가 먼저 볼
 * 전례다 — 이 임시물이 그 자리를 대신하지 않는다.
 *
 * ⚠ **사번은 지어내기 전에 화면이 정한 것을 먼저 쓴다.** 진입 화면(P-CO-01)이 사번을
 * `worker-session`에 두므로, 사람이 실제로 친 사번으로 기록되는 편이 시연에 정직하다.
 * 아직 아무도 치지 않았을 때만 데모 사번으로 내려간다.
 */

/**
 * 단말 번호. ⚠ **씨앗(`tools/mock/seed.mjs`)에 단말 자료가 없다** — 이 경로는 계약 예시
 * 서버로 넘어가 어떤 번호에도 답하므로, 이 값 자체에 근거가 있는 것은 아니다. 씨앗이 단말을
 * 갖게 되면 그때 실제 번호로 맞춘다.
 */
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
