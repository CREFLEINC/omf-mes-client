import { createContext, useContext, type ReactNode } from 'react';

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
  /** 게이팅 판정의 대상 공정. 단말 하나가 여러 공정을 갖는다. */
  processId: number | null;
  /** 귀속 사번. 쓰기의 `X-Worker-No` 헤더에 실린다. **인증이 아니라 귀속이다.** */
  workerNo: string | null;
}

/** 아무것도 모르는 상태. **이것이 기본값이다** — 채우는 곳이 아직 없다. */
export const UNKNOWN_POP_IDENTITY: PopIdentity = {
  terminalId: null,
  processId: null,
  workerNo: null,
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
