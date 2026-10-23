import { AlertBanner, Button, Dialog, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { EffectList } from '../../patterns/process-page';
import { forecastStatus, type BulkKind, type BulkTarget, type ForecastEntry } from './bulk-actions';

const t = messages.erpWorkOrderFlow.bulk;

export interface WorklistBulkDialogProps {
  kind: BulkKind;
  targets: BulkTarget[];
  /** 일괄 배포 예고(실행과 같은 판정). 일괄 재실행은 쓰지 않는다. */
  forecast: (targets: readonly BulkTarget[]) => Promise<ForecastEntry[]>;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * C-18 실행 전 확인: 대상 건수, 반영 사항, 건너뛰는 조건, 예고. 일괄 배포의 예고는 실행과 같은 판정으로 계산하고,
 * 모든 대상이 건너뛸 것이면 [배포]를 잠그고 이유를 적는다.
 */
export const WorklistBulkDialog = ({
  kind,
  targets,
  forecast,
  onCancel,
  onConfirm,
}: WorklistBulkDialogProps) => {
  const copy = kind === 'release' ? t.releaseDialog : t.autoPlanDialog;
  const reasonId = useId();
  const [entries, setEntries] = useState<ForecastEntry[] | null>(null);
  useEffect(() => {
    if (kind !== 'release') return;
    let active = true;
    void forecast(targets).then((result) => {
      if (active) setEntries(result);
    });
    return () => {
      active = false;
    };
  }, [forecast, kind, targets]);

  const counts = { processed: 0, partial: 0, skipped: 0, failed: 0 };
  let workOrders = 0;
  for (const entry of entries ?? []) {
    counts[forecastStatus(entry)] += 1;
    workOrders += entry.forecast?.ready ?? 0;
  }
  const forecasting = kind === 'release' && entries === null;
  const nothing = kind === 'release' && entries !== null && counts.processed + counts.partial === 0;
  const blockedReason = forecasting
    ? t.releaseDialog.forecasting
    : nothing
      ? t.releaseDialog.nothing
      : null;
  const notReady = (entries ?? []).filter((entry) => forecastStatus(entry) !== 'processed');

  return (
    <Dialog
      open
      title={copy.title}
      closeOnBackdropClick={false}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outlined" onClick={onCancel}>
            {messages.common.cancel}
          </Button>
          <Button
            disabled={blockedReason !== null}
            aria-describedby={blockedReason === null ? undefined : reasonId}
            onClick={onConfirm}
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="bulk-dialog-body">
        <p className="bulk-dialog-target">{copy.target(targets.length)}</p>
        <EffectList task={copy.task} items={copy.effects.map((label) => ({ key: label, label }))} />
        <section aria-label={copy.skipTitle}>
          <h3 className="effect-list-title">{copy.skipTitle}</h3>
          <ul className="erp-wo-plain-list">
            {copy.skipConditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </section>
        {kind === 'release' &&
          (entries === null ? (
            <SkeletonText lines={2} />
          ) : (
            <section aria-label={t.releaseDialog.forecastTitle}>
              <h3 className="effect-list-title">{t.releaseDialog.forecastTitle}</h3>
              <p className="dialog-text">
                {t.releaseDialog.forecast(
                  counts.processed,
                  counts.partial,
                  counts.skipped + counts.failed,
                  workOrders,
                )}
              </p>
              {notReady.length > 0 && (
                <ul className="erp-wo-plain-list">
                  {notReady.map((entry) => (
                    <li key={entry.productionOrderId}>
                      {entry.productionOrderNo}{' '}
                      {entry.error ??
                        (entry.forecast?.firstBlocked === null || entry.forecast === null
                          ? t.outcomeReasons.noWorkOrders
                          : `${entry.forecast.firstBlocked.workOrderNo} ${entry.forecast.firstBlocked.reason}`)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        {blockedReason !== null && (
          <p id={reasonId} className="dialog-text dialog-reason">
            {blockedReason}
          </p>
        )}
        {kind === 'release' && (
          <AlertBanner variant="info">{t.releaseDialog.irreversible}</AlertBanner>
        )}
      </div>
    </Dialog>
  );
};
