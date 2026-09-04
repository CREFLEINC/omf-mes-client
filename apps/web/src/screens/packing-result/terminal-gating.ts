import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 단말 게이팅 — **이 단말이 이 공정에서 실적을 입력할 수 있는가.**
 *
 * ⭐ **포장 전용 플래그는 신설되지 않는다.** 서버 회신(`omf-mes-server#40`, 2026-08-31)이
 * 「신설하지 않는다」로 확정했고 기존 8플래그 재사용도 하지 않기로 했다 — 그래서
 * `canInputResult`(실적 입력)로 게이팅하는 것이 **물러난 결과가 아니라 확정된 형태**다
 * (스펙 §5-5 · 공유계약 F-1).
 *
 * ⛔ **이것은 보안 경계가 아니다.** 없는 기능의 버튼을 감춰 오조작을 줄이는 장치이고,
 * 집행은 서버의 403 이다. ⛔ **「판정할 수 없음」을 「통과」로 처리하지 않는다**(F-6).
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

export type GateVerdict = 'allowed' | 'denied' | 'unavailable' | 'unidentified' | 'checking';

export interface TerminalGate {
  verdict: GateVerdict;
  retry: () => void;
}

export const packingGatingKeys = {
  /**
   * ⛔ **공정까지 키에 넣는다.** 결과가 「이 단말의 구성」이 아니라 「이 단말이 이 공정에서
   * 실적을 넣을 수 있는가」라는 불리언 하나라, 단말만 키로 잡으면 공정이 바뀌었을 때 앞
   * 공정의 판정이 그대로 돌아온다.
   */
  processes: (terminalId: number, processId: number) =>
    ['packing-result', 'terminal-processes', terminalId, processId] as const,
};

/** 행이 없으면 `false` 와 같이 다룬다 — 구성되지 않은 공정은 열려 있지 않다. */
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

  return row?.canInputResult ?? false;
};

export const useTerminalGate = (
  terminalId: number | null,
  processId: number | null,
): TerminalGate => {
  const { client } = useApiClient();

  const identified = terminalId !== null && processId !== null;

  const query = useQuery({
    queryKey: packingGatingKeys.processes(terminalId ?? 0, processId ?? 0),
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
    /* 조회 중에는 막는다 — 답이 오기 전 찰나에 눌린 확정이 게이팅을 지나친다. */
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
