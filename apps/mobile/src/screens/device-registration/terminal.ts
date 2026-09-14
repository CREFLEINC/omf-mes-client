import type { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

/** 이 앱이 등록할 수 있는 단말 유형. POP 단말의 등록 코드는 받지 않는다. */
export const MOBILE_TERMINAL_TYPE = 'MOBILE';

/** 등록이 가리키는 단말. 코드는 없을 수 있다 — 계약이 토큰 클레임을 아직 정의하지 않는다. */
export interface RegisteredTerminal {
  terminalId: number;
  terminalCode: string | null;
  plantId: number;
}

/** 서버가 이 등록 코드의 단말이라고 답한 것. */
export interface VerifiedTerminal {
  terminalId: number;
  terminalTypeCode: string;
}

/**
 * 이 등록 코드로 서버에 단말을 묻는다 — 기기에 보관하기 **전에**.
 *
 * 등록이 온라인 전용인 이유가 이것이다(M-CO-01 §6). 확인하지 않으면 등록은 성공한 것처럼
 * 보이고, 현장에 들어간 뒤 화면마다 401 이 난다. 실패는 등록 시점에 나는 편이 낫다.
 *
 * ⭐ **단말 유형까지 본다.** 토큰에는 유형이 없어, 작업자 목록 조회로 확인하던 동안 POP 단말의
 * 코드도 그대로 받아 등록을 끝냈다 — 서버에는 POP 단말이 모바일 기기로 「등록 완료」가 됐다
 * (REG-ALL-01 S18). POP 화면이 같은 조회로 `wrong-type` 을 막는 것과 짝을 맞춘다.
 *
 * 종전에는 이 조회를 모바일 토큰으로 부르면 서버가 POP 전용으로 두어 401 이 났고, 그래서 열린
 * 작업자 목록 조회로 우회했다. 서버가 자기 단말 상세를 MOBILE 에도 열었다(통합 결정 D6).
 *
 * 아직 보관하지 않은 코드라 인증 헤더를 직접 싣는다. 미등록 기기에는 보관된 토큰이 없어 요청
 * 가로채기가 덮어쓰지 않는다.
 */
export const verifyTerminalToken = (
  client: Client,
  terminalId: number,
  token: string,
): Promise<VerifiedTerminal> =>
  runRequest(() =>
    client.GET('/mdm/terminals/{terminalId}', {
      params: { path: { terminalId } },
      headers: { Authorization: `Bearer ${token}` },
    }),
  ).then((data) => ({ terminalId: data.terminalId, terminalTypeCode: data.terminalTypeCode }));
