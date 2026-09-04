import { useSyncExternalStore } from 'react';

import type { components } from '@omf-mes/api-client';

/**
 * 계약 타입을 여기서 다시 별칭한다 — 허용 의존 규칙이 `patterns/` → `screens/` 참조를
 * 막으므로 화면 슬라이스의 별칭을 쓸 수 없다. 전례(`patterns/session`)와 같은 형태다.
 */
type WorkerResponse = components['schemas']['Worker'];

/**
 * 현재 작업자를 **단말이 들고 있는 자리**(스펙 §5-4 · 공유계약 D-5).
 *
 * ⭐ **화면 지역 상태로는 성립하지 않는다.** 스펙이 「단말 재시작으로만 사라진다」고 정했는데
 * 컴포넌트 안에 두면 **다른 화면으로 넘어가는 순간 사라진다** — 「작업 화면으로 →」를 누른
 * 바로 그 순간 귀속이 날아간다. 그래서 화면 밖 단일 자리에 둔다.
 *
 * ⛔ **저장하지 않는다.** `localStorage` 도 파일도 쓰지 않는다 — 메모리에만 있어야
 * 단말을 다시 켰을 때 자연히 사라진다(§5-4). 유휴 시간으로도 지우지 않는다: 작업 중
 * 화면을 떠나는 일이 흔하고, 지우는 규약이 아직 없다.
 *
 * ⛔ **요청 계층에 자동으로 붙이지 않는다.** 관리웹과 POP 이 **클라이언트 한 벌**을 함께
 * 쓰므로, 요청 계층에 걸면 관리웹의 저장에도 사번이 실린다 — 공유계약 D-5 가 「관리웹은
 * 계정 토큰으로 오고 화면에 사번 입력 자리가 없어, 필수로 걸면 **없는 사번을 지어내게
 * 된다**」고 못박은 바로 그 일이다. 다른 팀 화면의 요청을 이 화면이 바꾸지 않는다.
 *
 * ⭐ **싣는 것은 POP 쓰기 화면 각자다** — 이미 그렇게 하고 있다(오프라인 큐는 담을 당시의
 * 사번으로, 진입 주소로 받는 화면은 그 값으로). ⚠ **아직 이 자리를 읽는 화면은 없다** —
 * 그 화면들은 각자 다른 출처를 쓰고 있고, 이 자리로 모으는 일은 셸이 `pop-identity` 를
 * 채울 때다(아래).
 *
 * ⭐ **`pop-identity` 가 말하는 「단말 메모리」가 이 자리다.** 그 파일은 「사번은 사번 경량
 * 인증 화면이 단말 메모리에 두는 값」이라 적고 **받는 자리만** 세워 두었다 — 두 벌이 아니라
 * 두는 쪽과 받는 쪽이다. ⛔ **공급자를 여기서 붙이지 않는다**: 그 파일이 「채우는 것은 셸에
 * 맡긴다 · 화면이 출처를 정하지 않는다」고 못박았고, 단말 번호·공정은 여전히 셸 몫이라
 * 사번만 흘려보내도 그쪽 화면은 열리지 않는다.
 *
 * ⭐ **화면 슬라이스에 두지 않는 이유.** 지정하는 곳은 `P-CO-01` 하나지만 **읽을 곳은 이
 * 화면 밖**이다 — 셸이 `pop-identity` 를 채울 때, 그리고 POP 쓰기 화면이 귀속을 물을 때다.
 * 한 화면이 소유하면 그 화면을 아무도 열지 않아도 값이 필요한 자리에서 화면을 가져다 쓰게
 * 된다.
 */

export interface WorkerSession {
  worker: WorkerResponse;
  /** 지정한 시각(표시용). 언제부터 이 사람으로 기록되는지가 화면의 정보다. */
  assignedAt: string;
  /** ⚠ 다른 공장 소속인가 — 막지 않고 표시만 한다(§6) */
  isOtherPlant: boolean;
}

let session: WorkerSession | null = null;

const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const setWorkerSession = (next: WorkerSession | null): void => {
  session = next;
  emit();
};

/** 지금 지정된 작업자. 아무도 지정되지 않았으면 `null`. */
export const useWorkerSession = (): WorkerSession | null =>
  useSyncExternalStore(subscribe, () => session);
