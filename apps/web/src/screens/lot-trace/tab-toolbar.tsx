import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { ExportState } from './use-export';

const t = messages.lotTrace;

export interface TabToolbarProps {
  /** 조건 칩(C-17). 없으면 비운다. */
  chips?: ReactNode;
  exportState: ExportState;
  total: number;
  onExport: () => void;
  onCancelExport: () => void;
  onDismissExport: () => void;
}

/**
 * 탭 머리 줄: 왼쪽에 조건 칩, 오른쪽에 [엑셀 내보내기](현재 조건 전체).
 * 받는 동안은 그 자리에 「N건 중 M건 받는 중」과 [취소]. 줄이 0이면 사유와 함께 잠근다(C-4).
 */
export const TabToolbar = ({
  chips,
  exportState,
  total,
  onExport,
  onCancelExport,
  onDismissExport,
}: TabToolbarProps) => {
  const reasonId = useId();
  return (
    <>
      <div className="lot-trace-toolbar">
        <div className="lot-trace-toolbar-start">{chips}</div>
        {exportState.phase === 'running' ? (
          <div className="lot-trace-export">
            <span className="lot-trace-export-progress" role="status">
              {t.export.progress(exportState.progress.total, exportState.progress.received)}
            </span>
            <Button variant="outlined" onClick={onCancelExport}>
              {t.export.cancel}
            </Button>
          </div>
        ) : (
          <div className="lot-trace-export">
            {total === 0 && (
              <span id={reasonId} className="lot-trace-export-reason">
                {t.export.noRows}
              </span>
            )}
            <Button
              variant="outlined"
              disabled={total === 0}
              aria-describedby={total === 0 ? reasonId : undefined}
              onClick={onExport}
            >
              {t.export.action}
            </Button>
          </div>
        )}
      </div>
      {exportState.phase === 'failed' && (
        <AlertBanner
          variant="error"
          action={
            <Button size="sm" variant="outlined" onClick={onDismissExport}>
              {messages.common.close}
            </Button>
          }
        >
          {t.export.failed}
        </AlertBanner>
      )}
    </>
  );
};
