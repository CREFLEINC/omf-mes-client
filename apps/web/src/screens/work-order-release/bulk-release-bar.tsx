import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import type { BulkReleaseOutcome } from './bulk-release';

const t = messages.workOrderRelease.bulk;

export interface BulkReleaseBarProps {
  selectedCount: number;
  isRunning: boolean;
  outcomes: BulkReleaseOutcome[] | null;
  onRun: () => void;
  onCloseResult: () => void;
}

/** 확인 창을 거친다 — 배포는 LOT 번호와 자재 출고요청을 만들어 되돌릴 수 없다. */
export const BulkReleaseBar = ({
  selectedCount,
  isRunning,
  outcomes,
  onRun,
  onCloseResult,
}: BulkReleaseBarProps) => {
  const [confirming, setConfirming] = useState(false);
  const count = (status: BulkReleaseOutcome['status']) =>
    outcomes?.filter((item) => item.status === status).length ?? 0;

  return (
    <div className="work-order-release-bulk">
      <Button
        variant="tonal"
        disabled={selectedCount === 0 || isRunning}
        loading={isRunning}
        onClick={() => setConfirming(true)}
      >
        {isRunning ? t.running : t.action(selectedCount)}
      </Button>
      {outcomes !== null && (
        <AlertBanner
          variant={count('failed') > 0 ? 'warning' : 'info'}
          title={t.resultTitle(count('released'), count('skipped'), count('failed'))}
          action={
            <Button size="sm" variant="outlined" onClick={onCloseResult}>
              {t.close}
            </Button>
          }
        >
          <ul className="work-order-release-bulk-result">
            {outcomes.map((item) => (
              <li key={item.workOrderId}>
                {`${item.workOrderNo} · ${t.status[item.status]}${item.reason === null ? '' : ` — ${item.reason}`}`}
              </li>
            ))}
          </ul>
        </AlertBanner>
      )}
      {confirming && (
        <Dialog
          open
          size="sm"
          title={t.dialogTitle(selectedCount)}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setConfirming(false)}>
                {t.cancel}
              </Button>
              <Button
                onClick={() => {
                  setConfirming(false);
                  onRun();
                }}
              >
                {t.confirm}
              </Button>
            </>
          }
        >
          <p>{t.dialogBody}</p>
        </Dialog>
      )}
    </div>
  );
};
