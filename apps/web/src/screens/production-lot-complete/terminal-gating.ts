import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 단말 게이팅 — **이 단말이 이 공정에서 작업을 완료할 수 있는가.**
 *
 * 스펙 §5-1 이 ★로 둔 자리다. 계약의 `TerminalProcess.canCompleteWork` 를 진입 시 한 번 읽어
 * 「완료 처리」·「미달 마감」을 선제 비활성한다. 착수 통지가 이 호출을 빠뜨렸다가 2026-08-31 에
 * ⛔ 로 정정했다 — **게이팅을 안 걸면 버튼이 항상 열린 채로 굳고, 화면은 정상으로 보인다.**
 *
 * ⛔ **`flag !== false` 로 쓰지 않는다.** 8개 불리언은 `required` 가 아니라서 값이 없을 때
 * 통과한다. **`=== true` 일 때만** 연다.
 *
 * ⛔ **조회 실패를 통과로 처리하지 않는다**(F-6). 문구도 「**확인할 수 없습니다**」이며
 * 「없습니다」와 구분한다 — 앞의 것에만 다시 시도할 경로를 준다(G-3).
 *
 * ⚠ **계약 설명의 「0건이 정상인 단말이 있다」는 이 화면 이야기가 아니다** — 그것은 공정 행이
 * 애초에 없는 **창고 전용 단말** 조항이다. `P-02-06` 은 생산 단말이라 게이팅 범위 안이고,
 * 행이 없으면 **닫힘**이다(통지 2026-08-31).
 *
 * ⭐ **보안 경계가 아니다.** 단말은 이 판정 «이전에» 토큰으로 인증을 마쳤고 최종 차단은 서버가
 * 한다. 이 게이팅은 「없는 장비의 버튼을 숨겨 오조작을 줄이는」 장치다.
 */

type Client = ApiClient['client'];

/**
 * 게이팅 판정.
 *
 * | 값 | 뜻 | 화면 |
 * | --- | --- | --- |
 * | `allowed` | 이 단말·공정에서 완료할 수 있다 | 두 버튼을 연다 |
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

export const lotCompleteGatingKeys = {
  /*
   * ⛔ **공정까지 키에 넣는다.** 이 조회의 결과는 「이 단말의 구성」이 아니라 「이 단말이 이
   * 공정에서 완료할 수 있는가」라는 **불리언 하나**다. 단말만 키로 잡으면 같은 단말에서 공정이
   * 바뀌었을 때 앞 공정의 판정이 그대로 돌아온다.
   */
  processes: (terminalId: number, processId: number) =>
    ['production-lot-complete', 'terminal-processes', terminalId, processId] as const,
};

/**
 * 이 단말의 공정별 기능 구성을 읽어 완료 플래그만 꺼낸다.
 *
 * **행이 없으면 `false` 와 같이 다룬다** — 구성되지 않은 공정은 열려 있지 않다.
 */
const fetchCanCompleteWork = async (
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

  /*
   * ⚠ **설계 문서는 `can_complete_work` 로 적지만 계약·응답은 `canCompleteWork` 다**(통지
   * 2026-08-31). 코드는 계약 쪽을 따른다.
   */
  return row?.canCompleteWork === true;
};

export const useTerminalGate = (
  terminalId: number | null,
  processId: number | null,
): TerminalGate => {
  const { client } = useApiClient();

  const identified = terminalId !== null && processId !== null;

  const query = useQuery({
    queryKey: lotCompleteGatingKeys.processes(terminalId ?? 0, processId ?? 0),
    enabled: identified,
    queryFn: () => {
      if (terminalId === null || processId === null) {
        throw new Error('단말·공정을 모르면 게이팅을 조회하지 않습니다.');
      }

      return fetchCanCompleteWork(client, terminalId, processId);
    },
  });

  const verdict = ((): GateVerdict => {
    if (!identified) return 'unidentified';
    if (query.isError) return 'unavailable';
    /*
     * 조회 중에는 **막는다.** 여는 쪽으로 두면 답이 오기 전 찰나에 눌린 완료가 게이팅을
     * 지나친다 — 완료는 되돌리는 화면이 없다(스펙 §8-5).
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
