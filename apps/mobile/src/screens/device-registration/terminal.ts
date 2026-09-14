import type { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

/** 등록이 가리키는 단말. 코드는 없을 수 있다 — 계약이 토큰 클레임을 아직 정의하지 않는다. */
export interface RegisteredTerminal {
  terminalId: number;
  terminalCode: string | null;
  plantId: number;
}

/**
 * 서버가 이 토큰을 받아 주는지 확인한다.
 *
 * 등록이 온라인 전용인 이유가 이것이다(M-CO-01 §6). 확인하지 않으면 등록은 성공한 것처럼
 * 보이고, 현장에 들어간 뒤 화면마다 401 이 난다. 실패는 등록 시점에 나는 편이 낫다.
 *
 * 어느 조회든 상관없다 — 토큰은 서버가 서명했고 매 호출마다 검증하므로 200 자체가 수락의
 * 증명이다. 작업자 목록을 쓰는 것은 등록 직후 어차피 받아야 하는 것이라서다.
 *
 * 단말 상세는 묻지 않는다. `GET /mdm/terminals/{terminalId}` 를 모바일 단말 토큰으로 부르면
 * 401 이 오고(실측), 그 실패로 등록이 통째로 막혔다.
 */
export const verifyTerminalToken = (client: Client, plantId: number): Promise<void> =>
  runRequest(() =>
    client.GET('/mdm/workers', { params: { query: { plantId, page: 1, size: 1 } } }),
  ).then(() => undefined);
