import { usePopProcessGate } from '../../patterns/pop-process-gate';

export type FlowGateVerdict = 'allowed' | 'denied' | 'unavailable' | 'unidentified' | 'checking';

export interface FlowGates {
  input: FlowGateVerdict;
  print: FlowGateVerdict;
  complete: FlowGateVerdict;
  /** 작업지시 마감. 서버가 칸을 싣지 않으면(옛 서버) 마감도 열지 않는다 */
  close: FlowGateVerdict;
  retry: () => void;
}

/** 통합 화면은 같은 단말·공정 행에서 여러 기능을 함께 본다 — 매핑은 단말마다 한 번 읽는다. */
export const useFlowGates = (terminalId: number | null, processId: number | null): FlowGates => {
  const input = usePopProcessGate({ terminalId, processId, flag: 'canInputResult' });
  const print = usePopProcessGate({ terminalId, processId, flag: 'canPrintLabel' });
  const complete = usePopProcessGate({ terminalId, processId, flag: 'canCompleteWork' });
  const close = usePopProcessGate({ terminalId, processId, flag: 'canCloseWorkOrder' });

  return {
    input: input.verdict,
    print: print.verdict,
    complete: complete.verdict,
    close: close.verdict,
    retry: input.retry,
  };
};
