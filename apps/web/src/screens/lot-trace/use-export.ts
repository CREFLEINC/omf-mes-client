import { useCallback, useEffect, useRef, useState } from 'react';

import { saveCsv } from '../../patterns/csv';
import { fetchAllRows, type ExportProgress, type RowPage } from './export';

export type ExportState =
  { phase: 'idle' } | { phase: 'running'; progress: ExportProgress } | { phase: 'failed' };

export interface ExportJob<Row> {
  total: number;
  fetchPage: (page: number, size: number, signal: AbortSignal) => Promise<RowPage<Row>>;
  /** 받은 줄 전부로 파일 이름과 내용을 만든다. */
  build: (rows: Row[]) => { fileName: string; content: string };
}

/**
 * 엑셀 내보내기 실행(현재 조건 전체). 받는 동안 진행(「N건 중 M건」)을 알리고 [취소]로 멈춘다.
 * 취소는 실패가 아니다 — 아무 표시 없이 처음 상태로 돌아간다. 화면을 떠나면 받던 요청을 끊는다.
 */
export const useAllPagesExport = () => {
  const [state, setState] = useState<ExportState>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(async <Row>(job: ExportJob<Row>) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setState({ phase: 'running', progress: { total: job.total, received: 0 } });
    try {
      const rows = await fetchAllRows(job.fetchPage, abort.signal, (progress) =>
        setState({ phase: 'running', progress }),
      );
      const file = job.build(rows);
      saveCsv(file.fileName, file.content);
      setState({ phase: 'idle' });
    } catch {
      if (abort.signal.aborted) return;
      setState({ phase: 'failed' });
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ phase: 'idle' });
  }, []);

  const dismiss = useCallback(() => setState({ phase: 'idle' }), []);

  return { state, start, cancel, dismiss };
};
