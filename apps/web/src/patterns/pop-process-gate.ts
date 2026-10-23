import type { ApiError, TerminalProcessForward, WorkOrderForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { soleProcessIdOf } from './pop-identity';
import type { TerminalProcessRow } from './pop-registration';
import { runRequest, toApiError } from './request';

/**
 * POP 단말 기능 판정 — **이 단말이 «이 작업지시의 공정»에서 이 기능을 할 수 있는가.**
 *
 * 단말에는 공정이 여럿 매핑될 수 있다(공유계약 F-4). 어느 공정으로 판정할지는 업무가 정하고,
 * 작업지시를 다루는 화면은 그 W/O 의 공정이다. 공정을 싣지 않는 서버면 단말의 유일한 공정으로
 * 판정한다 — 공정이 하나인 단말은 예전과 같게 동작한다.
 *
 * ⛔ 보안 경계가 아니다. 없는 기능의 버튼을 막아 오조작을 줄이는 장치이고 집행은 서버가 한다.
 * ⛔ 조회 실패를 통과로 처리하지 않는다 — 막되 「확인할 수 없다」고 말한다(F-6).
 * ⛔ 플래그는 `=== true` 일 때만 연다. 행이 없거나 필드가 없으면 닫힘이다(계약 「기본은 닫힘」).
 */

export type PopGateFlag =
  | 'canStartWork'
  | 'canCompleteWork'
  | 'canInputMaterial'
  | 'canInputResult'
  | 'canPrintLabel'
  | 'canCloseWorkOrder';

/**
 * | 값 | 뜻 |
 * | --- | --- |
 * | `allowed` | 이 공정에서 그 기능이 켜져 있다 |
 * | `denied` | 꺼져 있거나 그 공정 행이 없다 |
 * | `unavailable` | 매핑을 읽지 못했다 — 다시 시도할 수 있다 |
 * | `unidentified` | 단말이나 판정할 공정을 모른다 |
 * | `checking` | 매핑이나 작업지시를 읽는 중 |
 */
export type PopGateVerdict = 'allowed' | 'denied' | 'unavailable' | 'unidentified' | 'checking';

export interface PopProcessGate {
  verdict: PopGateVerdict;
  /** 판정한 공정의 이름. 막힘 문구에 쓴다. 모르면 null */
  processName: string | null;
  retry: () => void;
}

/** 판정할 공정 — W/O 의 공정, 없으면(옛 서버) 단말의 유일한 공정. */
export const popGateProcessId = (
  workOrderProcessId: number | null | undefined,
  processes: readonly TerminalProcessRow[] | null,
): number | null => workOrderProcessId ?? soleProcessIdOf(processes);

export const popProcessGateKeys = {
  terminal: (terminalId: number) => ['pop-terminal-processes', terminalId] as const,
};

export interface PopProcessGateInput {
  terminalId: number | null;
  processId: number | null;
  /** 공정을 정할 작업지시를 아직 읽는 중인가 — 그동안 「모른다」 대신 「확인 중」이다 */
  isProcessPending?: boolean;
  /** 매핑 행에 이름이 없을 때 쓸 이름(W/O 의 공정명) */
  fallbackProcessName?: string | null;
  flag: PopGateFlag;
}

export const usePopProcessGate = ({
  terminalId,
  processId,
  isProcessPending = false,
  fallbackProcessName = null,
  flag,
}: PopProcessGateInput): PopProcessGate => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: popProcessGateKeys.terminal(terminalId ?? 0),
    enabled: terminalId !== null,
    queryFn: async () => {
      if (terminalId === null) throw new Error('단말을 모르면 기능 구성을 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/mdm/terminals/{terminalId}/processes', {
          params: { path: { terminalId } },
        }),
      );

      return data.items as TerminalProcessForward[];
    },
  });

  const row =
    processId === null ? undefined : query.data?.find((item) => item.processId === processId);

  const verdict = ((): PopGateVerdict => {
    if (terminalId === null) return 'unidentified';
    if (processId === null) return isProcessPending ? 'checking' : 'unidentified';
    if (query.isError) return 'unavailable';
    /* 조회 중에는 막는다 — 답이 오기 전에 눌린 버튼이 판정을 지나친다. */
    if (query.isPending) return 'checking';

    return row?.[flag] === true ? 'allowed' : 'denied';
  })();

  return {
    verdict,
    processName: row?.processName ?? fallbackProcessName,
    retry: () => {
      void query.refetch();
    },
  };
};

/** 꺼져 있을 때의 문구 — 어느 공정의 무슨 기능이 꺼졌는지와 어디서 켜는지를 말한다. */
export const popGateDeniedText = (gate: Pick<PopProcessGate, 'processName'>, flag: PopGateFlag) => {
  const t = messages.popChrome.processGate;
  const feature = messages.terminalProcessMap.flags[flag];
  const menuPath = messages.terminalProcessMap.menuPath;

  return gate.processName === null
    ? t.deniedUnknownProcess(feature, menuPath)
    : t.denied(gate.processName, feature, menuPath);
};

export interface PopWorkOrderProcess {
  processId: number | null;
  processName: string | null;
  /** 작업지시를 읽지 못했을 때 서버가 준 이유. 막힘 문구 아래에 덧붙인다 */
  failureReason: string | null;
  /** 아직 답을 기다리는가. 작업지시가 없으면(묻지 않으면) false */
  isPending: boolean;
}

/** 판정에 쓸 작업지시의 공정. 공정을 싣지 않는 옛 서버면 null 이고, 판정은 단말의 유일한 공정으로 간다. */
export const usePopWorkOrderProcess = (workOrderId: number | null): PopWorkOrderProcess => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['pop-work-order-process', workOrderId ?? 0] as const,
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) throw new Error('작업지시가 없으면 공정을 조회하지 않습니다.');

      return (await runRequest(() =>
        client.GET('/production/work-orders/{workOrderId}', {
          params: { path: { workOrderId } },
        }),
      )) as WorkOrderForward;
    },
  });

  return {
    processId: query.data?.processId ?? null,
    processName: query.data?.processName ?? null,
    isPending: workOrderId !== null && query.isPending,
    failureReason: query.isError ? serverReasonOf(toApiError(query.error)) : null,
  };
};

/** 서버가 실어 준 문구. 없으면 null — 일반 문구로 지어내지 않는다. */
const serverReasonOf = (error: ApiError): string | null => {
  const lines =
    error.kind === 'validation' || error.kind === 'stateLocked'
      ? error.errors.map((item) => item.message)
      : (error.kind === 'http' || error.kind === 'conflict') && error.message !== undefined
        ? [error.message]
        : [];
  const text = lines
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' ');

  return text === '' ? null : text;
};

/**
 * 판정할 공정을 모를 때의 문구 — 화면의 원인·조치 뒤에 매핑을 확인할 곳을 더하고, 작업지시를
 * 읽지 못했으면 서버가 준 이유를 덧붙인다. 서버 문구만으로는 할 일이 보이지 않는다.
 */
export const popGateUnidentifiedText = (screenText: string, failureReason: string | null) => {
  const t = messages.popChrome.processGate;
  const parts = [screenText, t.checkMapping(messages.terminalProcessMap.menuPath)];
  if (failureReason !== null) parts.push(t.serverReason(failureReason));

  return parts.join(' ');
};
