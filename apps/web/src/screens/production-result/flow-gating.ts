import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

export type FlowGateVerdict = 'allowed' | 'denied' | 'unavailable' | 'unidentified' | 'checking';

export interface FlowGates {
  input: FlowGateVerdict;
  print: FlowGateVerdict;
  complete: FlowGateVerdict;
  retry: () => void;
}

/** 통합 화면은 같은 단말·공정 행에서 세 단계를 한 번만 읽는다. */
export const useFlowGates = (terminalId: number | null, processId: number | null): FlowGates => {
  const { client } = useApiClient();
  const isIdentified = terminalId !== null && processId !== null;

  const query = useQuery({
    queryKey: ['production-flow', 'terminal-process', terminalId ?? 0, processId ?? 0] as const,
    enabled: isIdentified,
    queryFn: async () => {
      if (terminalId === null || processId === null) {
        throw new Error('단말·공정을 모르면 기능 구성을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/terminals/{terminalId}/processes', {
          params: { path: { terminalId } },
        }),
      );

      return data.items.find((item) => item.processId === processId) ?? null;
    },
  });

  const verdict = (flag: boolean | undefined): FlowGateVerdict => {
    if (!isIdentified) return 'unidentified';
    if (query.isError) return 'unavailable';
    if (query.isPending) return 'checking';

    return flag === true ? 'allowed' : 'denied';
  };

  return {
    input: verdict(query.data?.canInputResult),
    print: verdict(query.data?.canPrintLabel),
    complete: verdict(query.data?.canCompleteWork),
    retry: () => {
      void query.refetch();
    },
  };
};
