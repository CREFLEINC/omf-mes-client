import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 단말 게이팅 — **이 단말이 이 공정에서 자재를 투입할 수 있는가.**
 *
 * ⭐ **교체도 자재 투입이라 `P-02-03`과 같은 플래그를 쓴다**(스펙 §5-1). 별도 플래그를 만들지
 * 않는다 — 「교체는 투입의 한 형태」라는 것이 그 절의 판정이다.
 *
 * ⛔ **이것은 보안 경계가 아니다.** 공유계약 F-1 이 이 플래그를 「인증이 아니라 기능 구성」으로
 * 못박았다 — 없는 장비의 버튼을 감춰 오조작을 줄이는 장치다. **집행은 서버가 한다**(쓰기의
 * 403). 화면이 열어 준다고 통과하는 것이 아니고, 화면이 막는다고 그것이 방어인 것도 아니다.
 *
 * ⛔ **「판정할 수 없음」을 「통과」로 처리하지 않는다**(F-6). 조회가 실패하면 막되 **「확인할
 * 수 없습니다」**라고 말한다 — 「권한이 없습니다」와 다른 문장이고, 앞의 것에는 다시 시도할
 * 경로를 준다(G-3).
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 * 경로 리터럴도 여기에만 둔다.
 */

type Client = ApiClient['client'];

/**
 * 게이팅 판정.
 *
 * | 값 | 뜻 | 화면 |
 * | --- | --- | --- |
 * | `allowed` | 이 단말·공정에서 투입할 수 있다 | 교체 등록을 연다 |
 * | `denied` | 플래그가 닫혀 있거나 **그 공정 행이 아예 없다** | 막고 「권한이 없다」 |
 * | `unavailable` | 조회가 실패했다 | 막고 **「확인할 수 없다」** + 다시 시도 |
 * | `unidentified` | 단말·공정을 알 수 없다 | 막고 사유를 말한다 |
 * | `checking` | 조회 중 | 막는다 — 아직 모르는 것을 열어 두지 않는다 |
 */
export type GateVerdict = 'allowed' | 'denied' | 'unavailable' | 'unidentified' | 'checking';

export interface TerminalGate {
  verdict: GateVerdict;
  retry: () => void;
}

export const terminalGatingKeys = {
  /*
   * ⛔ **공정까지 키에 넣는다.** 이 조회의 결과는 「이 단말의 구성」이 아니라 「이 단말이 이
   * 공정에서 투입할 수 있는가」라는 **불리언 하나**다. 단말만 키로 잡으면 같은 단말에서 공정이
   * 바뀌었을 때 **앞 공정의 판정이 그대로 돌아온다** — 닫힌 공정이 열린 것으로 보인다.
   */
  processes: (terminalId: number, processId: number) =>
    ['running-change', 'terminal-processes', terminalId, processId] as const,
};

/**
 * 이 단말의 공정별 기능 구성을 읽어 자재 투입 플래그만 꺼낸다.
 *
 * **행이 없으면 `false`와 같이 다룬다** — 구성되지 않은 공정은 열려 있지 않다.
 */
const fetchCanInputMaterial = async (
  client: Client,
  terminalId: number,
  processId: number,
): Promise<boolean> => {
  const data = await runRequest(() =>
    client.GET('/mdm/terminals/{terminalId}/processes', {
      params: { path: { terminalId } },
    }),
  );

  const row = data.items.find((item) => item.processId === processId);

  return row?.canInputMaterial ?? false;
};

/**
 * 게이팅 훅.
 *
 * `terminalId`·`processId`가 `null`이면 조회하지 않는다 — 무엇을 물어야 할지 모르는 상태이고,
 * 그때 조회를 보내면 서버가 거절할 요청을 화면이 한 번 더 만든다.
 */
export const useTerminalGate = (
  terminalId: number | null,
  processId: number | null,
): TerminalGate => {
  const { client } = useApiClient();

  const identified = terminalId !== null && processId !== null;

  const query = useQuery({
    queryKey: terminalGatingKeys.processes(terminalId ?? 0, processId ?? 0),
    enabled: identified,
    queryFn: () => {
      if (terminalId === null || processId === null) {
        throw new Error('단말·공정을 모르면 게이팅을 조회하지 않습니다.');
      }

      return fetchCanInputMaterial(client, terminalId, processId);
    },
  });

  const verdict = ((): GateVerdict => {
    if (!identified) return 'unidentified';
    if (query.isError) return 'unavailable';
    /*
     * 조회 중에는 **막는다.** 여는 쪽으로 두면 답이 오기 전 찰나에 눌린 등록이 게이팅을
     * 지나친다 — 스캔을 마친 작업자는 그 버튼을 바로 누른다.
     */
    if (query.isPending) return 'checking';

    return query.data === true ? 'allowed' : 'denied';
  })();

  return {
    verdict,
    retry: () => {
      void query.refetch();
    },
  };
};
