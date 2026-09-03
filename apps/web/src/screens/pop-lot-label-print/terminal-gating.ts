import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 단말 게이팅 — **이 단말이 이 공정에서 라벨을 발행할 수 있는가**(스펙 §5-1 · §6).
 *
 * `can_print_label` 은 `P-01-01`·`P-02-05`·`P-02-07` **세 화면이 같이 쓰는** 플래그다.
 * ⚠ 그래도 이 파일을 공용으로 올리지 않는다 — 화면 슬라이스는 사본으로 소유하는 것이 이
 * 저장소의 관례다. 세 번째 사용처가 이것이므로 공용화는 별건으로 판단한다.
 *
 * ⛔ **이것은 보안 경계가 아니다.** 공유계약 F-1 이 이 플래그를 「인증이 아니라 기능 구성」으로
 * 못박았다 — 집행은 서버의 **403** 이다(스펙 §6).
 *
 * ⛔ **「판정할 수 없음」을 「통과」로 처리하지 않는다**(F-6). 조회가 실패하면 막되 **「확인할 수
 * 없습니다」**라고 말한다 — 「권한이 없습니다」와 다른 문장이고, 앞의 것에만 다시 시도할 경로를
 * 준다.
 *
 * ⚠ **목록을 막지 않는다.** 이 판정은 출력·재출력 액션에만 건다 — 목록까지 막으면 「완료 LOT 이
 * 없다」와 구분되지 않는다.
 */

type Client = ApiClient['client'];

/**
 * | 값 | 뜻 | 화면 |
 * | --- | --- | --- |
 * | `allowed` | 이 단말·공정에서 발행할 수 있다 | 출력을 연다 |
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

export const lotLabelGatingKeys = {
  /*
   * ⛔ **공정까지 키에 넣는다.** 이 조회의 결과는 「이 단말의 구성」이 아니라 「이 단말이 이
   * 공정에서 발행할 수 있는가」라는 **불리언 하나**다. 단말만 키로 잡으면 같은 단말에서 공정이
   * 바뀌었을 때 앞 공정의 판정이 그대로 돌아온다.
   */
  processes: (terminalId: number, processId: number) =>
    ['pop-lot-label-print', 'terminal-processes', terminalId, processId] as const,
};

/**
 * 이 단말의 공정별 기능 구성을 읽어 라벨 발행 플래그만 꺼낸다.
 *
 * **행이 없으면 `false` 와 같이 다룬다** — 구성되지 않은 공정은 열려 있지 않다.
 *
 * ⚠ 플래그 이름은 `canPrintLabel` 이다 — 변경 통지 #547 의 6종 개명에서 **이 이름만 그대로**다.
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
    queryKey: lotLabelGatingKeys.processes(terminalId ?? 0, processId ?? 0),
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
    /* 조회 중에는 막는다 — 여는 쪽으로 두면 답이 오기 전 찰나에 눌린 발행이 게이팅을 지나친다. */
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

/** `guardIssue` 가 받는 세 값으로 좁힌다 — 「모른다」는 통과가 아니다. */
export const toGuardGate = (verdict: GateVerdict): 'allowed' | 'denied' | 'unknown' => {
  if (verdict === 'allowed') return 'allowed';
  if (verdict === 'denied') return 'denied';

  return 'unknown';
};
