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
 * ⛔ **사번은 메우지 않는다.** 단말 번호·공정은 「이 단말이 무엇인가」라 지어내도 기록의
 * 귀속이 흔들리지 않지만, 사번은 **남는 기록이 누구 앞으로 가는가**다. 한동안 아무도 치지
 * 않았을 때 데모 사번(`100029`)으로 내려갔는데, 사번은 메모리에만 있어(§5-4) 주소로 다시
 * 열거나 새로고침하면 세션이 비고 — 방금 100027 을 친 사람의 작업이 **아무 말 없이** 다른
 * 사람 앞으로 저장됐다(88단계 시험 결함 2 · #1041). 그래서 세션이 비면 `null` 을 그대로
 * 내려보낸다: 화면은 「사번이 확인되지 않았습니다」로 서고, 진입 화면(P-CO-01)에서 다시
 * 지정하면 풀린다. 조회는 그대로 열리므로 이 파일의 쓸모(단말·공정 메우기)는 남는다.
 */

/**
 * 단말 번호. ⚠ **씨앗(`tools/mock/seed.mjs`)에 단말 자료가 없다** — 이 경로는 계약 예시
 * 서버로 넘어가 어떤 번호에도 답하므로, 이 값 자체에 근거가 있는 것은 아니다. 씨앗이 단말을
 * 갖게 되면 그때 실제 번호로 맞춘다.
 */
export const POP_DEV_TERMINAL_ID = 1001;

/**
 * 게이팅 판정의 대상 공정. ⚠ **씨앗에 공정 자료가 없다** — 바로 위 단말 번호와 같은 사정으로
 * 계약 예시 서버가 답하며, 이 값 자체에 근거가 있는 것은 아니다.
 */
export const POP_DEV_PROCESS_ID = 1001;

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
        workerNo: session?.worker.workerNo ?? null,
      }}
    >
      {children}
    </PopIdentityProvider>
  );
};
