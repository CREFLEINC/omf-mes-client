import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 단말 게이팅 — **이 단말이 이 공정에서 실적을 입력할 수 있는가.**
 *
 * 스펙 §5-1 이 저장 활성 조건으로 둔 자리다. 계약의 `TerminalProcess.canInputResult` 를 진입
 * 시 읽어 「저장」을 선제 비활성한다. 8플래그는 전부 `required` 가 아니고 **기본이 닫힘**이라,
 * 명시적 허용(`=== true`)이 있을 때만 연다.
 *
 * ⛔ **`flag !== false` 로 쓰지 않는다.** 값이 없을 때 통과한다.
 *
 * ⛔ **이것은 보안 경계가 아니다.** 공유계약 F-1 이 이 플래그를 「인증이 아니라 기능 구성」으로
 * 못박았다 — 집행은 서버의 403 이다. 화면이 열어 준다고 통과하는 것이 아니고, 화면이 막는다고
 * 그것이 방어인 것도 아니다. **반대로 걸지 않으면 없는 장비의 버튼이 현장에서 잘못 눌린다.**
 *
 * ⛔ **「판정할 수 없음」을 「통과」로 처리하지 않는다**(F-6). 조회가 실패하면 막되 **「확인할 수
 * 없습니다」**라고 말한다 — 「권한이 없습니다」와 다른 문장이고, 앞의 것에만 다시 시도할 경로를
 * 준다.
 *
 * ⚠ **계약 설명의 「0건이 정상인 단말이 있다」는 이 화면 이야기가 아니다** — 그것은 공정 행이
 * 애초에 없는 창고 전용 단말 조항이다. `P-02-04` 는 생산 단말이라 게이팅 범위 안이고, 이
 * 공정의 행이 없으면 **닫힘**이다.
 *
 * ⚠ **같은 형태를 여러 POP 화면이 쓴다.** 그래도 공용으로 올리지 않는다 — 화면 슬라이스를
 * 사본으로 소유하는 것이 이 저장소의 관례다(전례 `P-02-05`).
 */

type Client = ApiClient['client'];

/**
 * 게이팅 판정.
 *
 * | 값 | 뜻 | 화면 |
 * | --- | --- | --- |
 * | `allowed` | 이 단말·공정에서 실적을 입력할 수 있다 | 저장을 연다 |
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

export const productionResultGatingKeys = {
  /*
   * ⛔ **공정까지 키에 넣는다.** 이 조회의 결과는 「이 단말의 구성」이 아니라 「이 단말이 이
   * 공정에서 실적을 넣을 수 있는가」라는 **불리언 하나**다. 단말만 키로 잡으면 같은 단말에서
   * 공정이 바뀌었을 때 앞 공정의 판정이 그대로 돌아온다.
   */
  processes: (terminalId: number, processId: number) =>
    ['production-result', 'terminal-processes', terminalId, processId] as const,
};

/**
 * 이 단말의 공정별 기능 구성을 읽어 실적 입력 플래그만 꺼낸다.
 *
 * **행이 없으면 `false` 와 같이 다룬다** — 구성되지 않은 공정은 열려 있지 않다.
 */
const fetchCanInputResult = async (
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

  return row?.canInputResult === true;
};

export const useTerminalGate = (
  terminalId: number | null,
  processId: number | null,
): TerminalGate => {
  const { client } = useApiClient();

  const identified = terminalId !== null && processId !== null;

  const query = useQuery({
    queryKey: productionResultGatingKeys.processes(terminalId ?? 0, processId ?? 0),
    enabled: identified,
    queryFn: () => {
      if (terminalId === null || processId === null) {
        throw new Error('단말·공정을 모르면 게이팅을 조회하지 않습니다.');
      }

      return fetchCanInputResult(client, terminalId, processId);
    },
  });

  const verdict = ((): GateVerdict => {
    if (!identified) return 'unidentified';
    if (query.isError) return 'unavailable';
    /*
     * 조회 중에는 **막는다.** 여는 쪽으로 두면 답이 오기 전 찰나에 눌린 저장이 게이팅을
     * 지나친다 — 실적은 정정 실적을 따로 만들어야 지워지는 기록이다.
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
