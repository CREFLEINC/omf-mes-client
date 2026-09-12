import type { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

/** 등록이 가리키는 단말. 토큰은 번호만 싣고 오므로 나머지는 서버가 준다. */
export interface RegisteredTerminal {
  terminalId: number;
  terminalCode: string;
  plantId: number;
}

/**
 * 토큰이 가리키는 단말을 받는다.
 *
 * ⭐ **이 호출이 토큰 검증을 겸한다.** 요청에는 방금 저장한 단말 토큰이 실리므로, 서버가
 * 받아 주지 않으면 여기서 거절로 떨어진다 — 등록을 세우기 전에 알 수 있다.
 *
 * ⛔ **코드를 토큰에서 읽지 않는다.** 토큰의 값은 서명을 보지 않은 값이고, 작업자가 관리자와
 * 맞춰 보는 것은 «서버가 말한» 코드여야 한다.
 */
export const fetchTerminal = (client: Client, terminalId: number): Promise<RegisteredTerminal> =>
  runRequest(() =>
    client.GET('/mdm/terminals/{terminalId}', { params: { path: { terminalId } } }),
  ).then((data) => ({
    terminalId: data.terminalId,
    terminalCode: data.terminalCode,
    plantId: data.plantId,
  }));
