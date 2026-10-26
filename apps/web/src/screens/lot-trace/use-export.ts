import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { exportFileName, fetchAllMovements, saveCsv, toCsv, type ExportProgress } from './export';
import type { LotTraceFilters } from './filters';
import { fetchMovementPage } from './queries';

export type ExportState =
  { phase: 'idle' } | { phase: 'running'; progress: ExportProgress } | { phase: 'failed' };

/**
 * 엑셀 내보내기 실행. 받는 동안 진행(「N건 중 M건」)을 알리고 [취소]로 멈춘다.
 * 취소는 실패가 아니다 — 아무 표시 없이 처음 상태로 돌아간다. 화면을 떠나면 받던 요청을 끊는다.
 */
export const useMovementExport = (statusName: (code: string) => string) => {
  const { client } = useApiClient();
  const [state, setState] = useState<ExportState>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(
    async (filters: LotTraceFilters, total: number) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setState({ phase: 'running', progress: { total, received: 0 } });
      try {
        const rows = await fetchAllMovements(
          (page, size, signal) => fetchMovementPage(client, filters, page, size, signal),
          abort.signal,
          (progress) => setState({ phase: 'running', progress }),
        );
        saveCsv(exportFileName(filters), toCsv(filters.kind, rows, statusName));
        setState({ phase: 'idle' });
      } catch {
        if (abort.signal.aborted) return;
        setState({ phase: 'failed' });
      } finally {
        if (controller.current === abort) controller.current = null;
      }
    },
    [client, statusName],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ phase: 'idle' });
  }, []);

  const dismiss = useCallback(() => setState({ phase: 'idle' }), []);

  return { state, start, cancel, dismiss };
};
