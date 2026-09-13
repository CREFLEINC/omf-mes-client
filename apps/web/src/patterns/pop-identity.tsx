import { createContext, useContext, type ReactNode } from 'react';

import type { TerminalProcessRow } from './pop-registration';

/**
 * POP 단말이 자기 자신과 지금 선 작업자를 아는 자리.
 *
 * ## 왜 화면이 아니라 여기인가
 *
 * 이 값들은 **셸이 아는 것**이다. 단말 번호는 요청을 인증한 단말 토큰의 주체이고, 사번은
 * 사번 경량 인증 화면이 단말 메모리에 두는 값이다. 화면이 어느 것도 스스로 알 수 없다.
 *
 * 그런데 화면은 그 둘이 **필요하다** — 게이팅 조회가 경로에 단말 번호를 요구하고(스펙 §5-1),
 * 쓰기가 헤더에 사번을 요구한다(귀속 조항 D-5). 그래서 **받는 자리만 여기 세우고 채우는 것은
 * 셸에 맡긴다.**
 *
 * ⛔ **화면이 출처를 정하지 않는다.** 주소·저장소·토큰 어디서 오는지는 설계가 정할 자리이고,
 * 이 저장소에는 아직 채우는 곳이 없다 — 그래서 기본값이 **전부 없음**이고 화면은 막힌다.
 * 「모르는 것」을 「통과」로 처리하지 않는다(공유계약 F-6).
 *
 * ⚠ **채우는 곳이 생기면 이 파일 하나에 공급자가 붙는다.** 화면은 바뀌지 않는다.
 *
 * `patterns/`에 두는 이유는 허용 의존 규칙이 `screens/`에서 `app/`을 참조하는 것을 막기
 * 때문이다 — 셸과 화면이 함께 읽는 값이 설 수 있는 자리가 여기뿐이다(`api-context`·
 * `session`이 같은 사정으로 같은 자리에 있다).
 */
export interface PopIdentity {
  /** 이 단말의 번호. 게이팅 조회가 경로로 요구한다. */
  terminalId: number | null;
  /**
   * 이 단말에 구성된 **공정 전부**. 셸이 받은 그대로 들고 있는다.
   *
   * ⛔ **한 값으로 좁히지 않는다**(공유계약 F-4 — 「셸은 전체 `items` 를 공급하며 전역 단일
   *    공정을 만들지 않는다」). `terminal_process` 는 (단말, 공정) 행렬이라 여러 행이 정상이고,
   *    **어느 행으로 판정하는가는 업무가 정한다** — 작업지시는 `WorkOrder.processId`, 라벨은
   *    `requiredProcessIds`, 비가동은 설비의 소속 공정이다.
   *
   * ⛔ **첫 행을 고르거나 플래그를 OR 로 합산하지 않는다.** 그렇게 열린 버튼은 서버에서
   *    403 으로 되돌아오고, 작업자에게는 고장으로 보인다.
   *
   * ⚠ **`null` 과 빈 배열은 다르다.** `null` 은 「아직 받지 못했다」이고, 빈 배열은 「이
   *    단말에 구성된 공정이 없다」 — 창고 단말에서는 그것이 **정상**이다(F-1).
   */
  processes: readonly TerminalProcessRow[] | null;
  /**
   * **이 단말이 붙어 있는 설비.** 단말 상세가 답하는 값 그대로다(계약 `/mdm/terminals/{id}`).
   *
   * ⚠ **`null` 은 「설비에 붙어 있지 않다」와 「아직 등록되지 않았다」 둘 다다** — 가르는 것은
   *    `terminalId` 다. 창고·검사 단말처럼 설비가 없는 것이 **정상**인 단말이 있다.
   *
   * ⛔ **화면이 이 값을 기억해 두지 않는다.** 단말이 재등록돼 설비가 바뀌면 여기서 바뀌어야
   *    하고, 화면이 따로 들고 있으면 **남의 설비에 기록이 붙는다.**
   */
  equipment: PopEquipment | null;
  /** 귀속 사번. 쓰기의 `X-Worker-No` 헤더에 실린다. **인증이 아니라 귀속이다.** */
  workerNo: string | null;
}

/** 단말에 붙은 설비. 이름·코드는 **표시용**이고 판정에 쓰는 것은 번호다. */
export interface PopEquipment {
  equipmentId: number;
  equipmentCode: string | null;
  equipmentName: string | null;
}

/** 아무것도 모르는 상태. **이것이 기본값이다** — 등록을 마치기 전까지 여기 머문다. */
export const UNKNOWN_POP_IDENTITY: PopIdentity = {
  terminalId: null,
  processes: null,
  equipment: null,
  workerNo: null,
};

/**
 * **업무가 정한 공정**의 구성 행을 찾는다.
 *
 * ⛔ 못 찾으면 `null` 이고, 그것을 「허용」으로 읽지 않는다(F-6) — 구성되지 않은 공정은
 *    열려 있지 않다. 부르는 쪽이 「판정할 수 없음」과 「막힘」을 갈라 말한다.
 */
/**
 * **공정이 하나뿐이면** 그 공정. 여럿이면 `null` 이다.
 *
 * ⚠ **이것은 「첫 행 고르기」가 아니다.** 행이 하나면 고를 것이 없으므로 선택이 일어나지
 *    않는다 — 설계가 금지한 것은 여럿 중 **임의로 하나를 집는 것**이다(F-4).
 *
 * ⛔ **임시 다리다.** 설계는 업무별 실제 공정의 출처를 정했지만(작업지시 `WorkOrder.processId`
 *    · 라벨 `requiredProcessIds` · 비가동은 설비 상세), **고정한 계약에 그 필드들이 아직
 *    없다** — 그 필드는 2026-09-10·11 설계 커밋에 들어왔고, 계약 생성물을 그 시점으로
 *    올리면 이 저장소의 «모바일» 이 타입 검사에서 깨진다(T1 소관이라 우리가 고칠 수 없다).
 *    그래서 공정이 여럿인 단말에서는 판정을 **보류**하고, 계약이 올라오는 날 이 함수를
 *    부르는 자리들이 각자의 실제 공정으로 갈아탄다. 그때 이 함수는 사라진다.
 */
export const soleProcessIdOf = (processes: readonly TerminalProcessRow[] | null): number | null => {
  if (processes === null || processes.length !== 1) return null;

  return processes[0]?.processId ?? null;
};

/** 지금 단말의 공정이 하나뿐일 때 그 번호. 화면이 게이팅 조회에 쓴다. */
export const usePopProcessId = (): number | null => soleProcessIdOf(usePopIdentity().processes);

export const processRowOf = (
  processes: readonly TerminalProcessRow[] | null,
  processId: number | null,
): TerminalProcessRow | null => {
  if (processes === null || processId === null) return null;

  return processes.find((row) => row.processId === processId) ?? null;
};

const PopIdentityContext = createContext<PopIdentity>(UNKNOWN_POP_IDENTITY);

export interface PopIdentityProviderProps {
  value: PopIdentity;
  children: ReactNode;
}

export const PopIdentityProvider = ({ value, children }: PopIdentityProviderProps) => (
  <PopIdentityContext.Provider value={value}>{children}</PopIdentityContext.Provider>
);

/**
 * 지금 단말·작업자.
 *
 * 공급자가 없으면 **전부 `null`**이다 — 그것이 오류가 아니라 「아직 모른다」의 표현이고,
 * 화면은 그 상태를 사유와 함께 보인다.
 */
export const usePopIdentity = (): PopIdentity => useContext(PopIdentityContext);
