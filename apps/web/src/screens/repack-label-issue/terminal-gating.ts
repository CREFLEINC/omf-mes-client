import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 단말 게이팅 — **이 단말이 이 공정에서 라벨을 발행할 수 있는가.**
 *
 * 스펙 §6 이 「출력 권한이 없으면 서버가 403 으로 막는다 — 화면 선차단은 단말 기능 구성으로
 * 한다」고 둔 자리다. 계약의 `TerminalProcess.canPrintLabel` 을 진입 시 읽어
 * 「발행·인쇄」를 선제 비활성한다. **기본이 닫힘**이므로 명시적 허용이 필요하다.
 *
 * ⛔ **이것은 보안 경계가 아니다.** 공유계약 F-1 이 이 플래그를 「인증이 아니라 기능 구성」으로
 * 못박았다 — 집행은 서버의 403 이다. 화면이 열어 준다고 통과하는 것이 아니고, 화면이 막는다고
 * 그것이 방어인 것도 아니다.
 *
 * ⛔ **「판정할 수 없음」을 「통과」로 처리하지 않는다**(F-6). 조회가 실패하면 막되 **「확인할 수
 * 없습니다」**라고 말한다 — 「권한이 없습니다」와 다른 문장이고, 앞의 것에만 다시 시도할 경로를
 * 준다(G-3).
 *
 * ⚠ **`P-02-09` 의 같은 파일을 사본으로 가져왔다 — 저장소에서 여섯 번째 사본이다**
 * (`downtime-register`·`identification-tag-issue`·`material-input-scan`·`packing-label-reprint`·
 * `production-result`). 사본이 이만큼 늘었으므로 **`patterns/` 로 올릴 때가 됐다** — 다만 그것은
 * 이 이슈의 일이 아니라 별도 정리 대상이고, 여기서 앞질러 옮기면 다섯 화면의 검증을 함께
 * 흔든다. 옮길 때 여섯을 한 번에 본다.
 *
 * ⛔ **사본이므로 원본이 바뀌어도 따라오지 않는다.** 판정 규칙이 바뀌면 두 파일을 함께 고친다.
 */

type Client = ApiClient['client'];

/**
 * 게이팅 판정.
 *
 * | 값 | 뜻 | 화면 |
 * | --- | --- | --- |
 * | `allowed` | 이 단말·공정에서 발행할 수 있다 | 발행을 연다 |
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

export const repackGatingKeys = {
  /*
   * ⛔ **공정까지 키에 넣는다.** 이 조회의 결과는 「이 단말의 구성」이 아니라 「이 단말이 이
   * 공정에서 발행할 수 있는가」라는 **불리언 하나**다. 단말만 키로 잡으면 같은 단말에서 공정이
   * 바뀌었을 때 앞 공정의 판정이 그대로 돌아온다.
   */
  processes: (terminalId: number, processId: number) =>
    ['repack-label-issue', 'terminal-processes', terminalId, processId] as const,
};

/**
 * 이 단말의 공정별 기능 구성을 읽어 라벨 발행 플래그만 꺼낸다.
 *
 * **행이 없으면 `false` 와 같이 다룬다** — 구성되지 않은 공정은 열려 있지 않다.
 */
const fetchCanPrintLabel = async (
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

  return row?.canPrintLabel ?? false;
};

export const useTerminalGate = (
  terminalId: number | null,
  processId: number | null,
): TerminalGate => {
  const { client } = useApiClient();

  const identified = terminalId !== null && processId !== null;

  const query = useQuery({
    queryKey: repackGatingKeys.processes(terminalId ?? 0, processId ?? 0),
    enabled: identified,
    queryFn: () => {
      if (terminalId === null || processId === null) {
        throw new Error('단말·공정을 모르면 게이팅을 조회하지 않습니다.');
      }

      return fetchCanPrintLabel(client, terminalId, processId);
    },
  });

  const verdict = ((): GateVerdict => {
    if (!identified) return 'unidentified';
    if (query.isError) return 'unavailable';
    /*
     * 조회 중에는 **막는다.** 여는 쪽으로 두면 답이 오기 전 찰나에 눌린 발행이 게이팅을
     * 지나친다 — 발행 기록은 되돌릴 수 없고, 이 화면은 그 위에 회차를 하나 더 쌓는다.
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
