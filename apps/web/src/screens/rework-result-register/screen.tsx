import { AlertBanner, Button, Card, NumberPad, Progress, Select, TextField } from '@crefle/web-ui';
import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { usePopIdentity } from '../../patterns/pop-identity';
import { drainReworkResults, enqueueReworkResult, pendingReworkResultCount } from './outbox';
import {
  useDispositionDecisions,
  useResultGate,
  useReworkSource,
  useReworkWorkOrders,
} from './queries';
import {
  EMPTY_QUANTITIES,
  quantityTotal,
  quantityVerdict,
  reworkDispositionProgress,
  toProductionResult,
  type QuantityDrafts,
  type QuantityKey,
} from './result';

const quantityKeys: QuantityKey[] = ['goodQty', 'defectQty', 'holdQty', 'scrapQty'];

export const ReworkResultRegisterScreen = () => {
  const t = messages.reworkResultRegister;
  const { client } = useApiClient();
  const identity = usePopIdentity();
  const workOrders = useReworkWorkOrders();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeKey, setActiveKey] = useState<QuantityKey>('goodQty');
  const [drafts, setDrafts] = useState<QuantityDrafts>(EMPTY_QUANTITIES);
  const [queued, setQueued] = useState(false);
  const [queueError, setQueueError] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [pendingCount, setPendingCount] = useState(pendingReworkResultCount);
  const [isOnline, setIsOnline] = useState(() => globalThis.navigator.onLine);

  const selected = workOrders.data?.items.find((row) => row.workOrderId === selectedId) ?? null;
  const nonconformanceId = selected?.reworkSourceNonconformanceId ?? null;
  const source = useReworkSource(nonconformanceId);
  const dispositions = useDispositionDecisions(nonconformanceId);
  const gate = useResultGate(identity.terminalId, identity.processId);
  const progress = reworkDispositionProgress(dispositions.data?.items ?? []);
  const total = quantityTotal(drafts);
  const verdict = quantityVerdict(total, progress.remaining);
  const remaining = Math.max(0, progress.remaining - total);
  useEffect(() => {
    setDrafts(EMPTY_QUANTITIES);
    setQueued(false);
    setQueueError(false);
    setRejected(false);
  }, [selectedId]);
  useEffect(() => {
    const drain = () => {
      setIsOnline(true);
      void drainReworkResults(client)
        .then((result) => {
          setPendingCount(pendingReworkResultCount());
          setRejected(result.rejected > 0);
          if (result.rejected > 0) setQueued(false);
        })
        .catch(() => setPendingCount(pendingReworkResultCount()));
    };
    const offline = () => setIsOnline(false);
    if (globalThis.navigator.onLine) drain();
    globalThis.addEventListener('online', drain);
    globalThis.addEventListener('offline', offline);
    return () => {
      globalThis.removeEventListener('online', drain);
      globalThis.removeEventListener('offline', offline);
    };
  }, [client]);
  const gateReason = gate.unidentified
    ? t.gateUnidentified
    : gate.checking
      ? t.gateChecking
      : gate.unavailable
        ? t.gateUnavailable
        : !gate.allowed
          ? t.gateDenied
          : identity.workerNo === null
            ? t.workerMissing
            : null;
  const canSave =
    selected !== null &&
    source.isSuccess &&
    dispositions.isSuccess &&
    progress.remaining > 0 &&
    (verdict === 'partial' || verdict === 'complete') &&
    gateReason === null &&
    !queued;
  const save = () => {
    if (!canSave || selected === null || identity.workerNo === null) return;
    try {
      enqueueReworkResult(identity.workerNo, toProductionResult(selected, drafts, new Date()));
    } catch {
      setQueueError(true);
      return;
    }
    setQueueError(false);
    setPendingCount(pendingReworkResultCount());
    setQueued(true);
    if (globalThis.navigator.onLine) {
      void drainReworkResults(client)
        .then((result) => {
          setPendingCount(pendingReworkResultCount());
          setRejected(result.rejected > 0);
          if (result.rejected > 0) setQueued(false);
        })
        .catch(() => setPendingCount(pendingReworkResultCount()));
    }
  };
  const reset = () => {
    setDrafts(EMPTY_QUANTITIES);
    setQueued(false);
    setQueueError(false);
    setRejected(false);
  };
  return (
    <main className="pop-shell rework-result-screen" aria-labelledby="rework-result-title">
      <header className="pop-header">
        <h1 className="pop-title" id="rework-result-title">
          {t.title}
        </h1>
        <p className="pop-context">{selected?.workOrderNo ?? t.selectWorkOrder}</p>
        <p className="pop-context pop-context-right">
          <span>{identity.workerNo ?? '—'}</span>
          <Chip variant="status" size="sm" status={isOnline ? 'success' : 'warning'}>
            {isOnline ? messages.common.connection.online : messages.common.connection.offline}
          </Chip>
          <span>{t.pending(pendingCount)}</span>
        </p>
      </header>

      <div className="pop-panes">
        <section className="pane" aria-label={t.workOrders}>
          <h2 className="pane-title">{t.workOrders}</h2>
          {workOrders.isError && <AlertBanner variant="error">{t.loadError}</AlertBanner>}
          {workOrders.isSuccess && workOrders.data.items.length === 0 && (
            <AlertBanner variant="info">{t.empty}</AlertBanner>
          )}
          <ul className="pop-card-list">
            {(workOrders.data?.items ?? []).map((row) => (
              <li key={row.workOrderId}>
                <Card
                  interactive
                  bordered
                  surface={row.workOrderId === selectedId ? 'high' : 'low'}
                  onClick={() => setSelectedId(row.workOrderId)}
                >
                  <Card.Body>
                    <strong>{row.workOrderNo}</strong>
                    <p className="field-note">
                      {row.itemCode ?? `#${row.itemId}`} · {row.orderQty}
                    </p>
                  </Card.Body>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section className="pane rework-result-pane" aria-label={t.target}>
          {selected === null ? (
            <AlertBanner variant="info">{t.selectWorkOrder}</AlertBanner>
          ) : (
            <>
              <Card bordered className="rework-target-card">
                <Card.Body>
                  <h2 className="pane-title">{t.target}</h2>
                  {(source.isError || dispositions.isError) && (
                    <AlertBanner variant="error">{t.loadError}</AlertBanner>
                  )}
                  <dl className="pop-figures">
                    <div>
                      <dt>{t.sourceLot}</dt>
                      <dd>{selected.reworkSourceLotId ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>{t.sourceWorkOrder}</dt>
                      <dd>{selected.reworkSourceWorkOrderId ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>{t.nonconformance}</dt>
                      <dd>
                        {source.data
                          ? `${source.data.nonconformanceNo} · ${source.data.description}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>{t.disposition}</dt>
                      <dd>{progress.target}</dd>
                    </div>
                  </dl>
                </Card.Body>
              </Card>

              <div className="rework-result-input">
                <div className="rework-result-fields">
                  <h2 className="pane-title">{t.quantities.title}</h2>
                  {quantityKeys.map((key) => (
                    <TextField
                      key={key}
                      label={t.quantities[key]}
                      value={drafts[key]}
                      inputMode="decimal"
                      readOnly
                      fullWidth
                      onFocus={() => setActiveKey(key)}
                    />
                  ))}
                  <label>{t.defectCode}</label>
                  <Select
                    aria-label={t.defectCode}
                    options={[]}
                    placeholder={t.defectCodePlaceholder}
                    disabled
                  />
                  <p className="field-note">{t.defectCodeReason}</p>
                  <p className="field-note">
                    {t.reworkHint} {t.lotHint}
                  </p>
                </div>
                <NumberPad
                  value={drafts[activeKey]}
                  allowDecimal
                  max={progress.remaining}
                  onChange={(value) => setDrafts((current) => ({ ...current, [activeKey]: value }))}
                  size="lg"
                />
              </div>

              <section className="rework-result-summary" aria-label={t.total}>
                <Progress
                  max={Math.max(progress.target, 1)}
                  tone={
                    verdict === 'exceeded'
                      ? 'error'
                      : verdict === 'complete'
                        ? 'success'
                        : 'warning'
                  }
                  value={progress.completed + total}
                  valueText={`${t.total} ${progress.completed + total} / ${progress.target}`}
                  showValue
                />
                <p>
                  {t.total} {progress.completed + total} / {progress.target} · {t.remaining}{' '}
                  {remaining}
                </p>
                {verdict === 'empty' && (
                  <AlertBanner variant="error">{t.emptyQuantity}</AlertBanner>
                )}
                {verdict === 'exceeded' && (
                  <AlertBanner variant="error">{t.exceeded(progress.remaining)}</AlertBanner>
                )}
                {verdict === 'partial' && (
                  <AlertBanner variant="warning">{t.partial(remaining)}</AlertBanner>
                )}
                {queued && <AlertBanner variant="success">{t.queued}</AlertBanner>}
                {queueError && <AlertBanner variant="error">{t.queueError}</AlertBanner>}
                {rejected && <AlertBanner variant="error">{t.rejected}</AlertBanner>}
              </section>

              <div className="pop-action-bar">
                <div className="pop-action-note">{gateReason && <p>{gateReason}</p>}</div>
                <Button size="2xl" variant="outlined" onClick={reset}>
                  {t.reset}
                </Button>
                <Button size="2xl" disabled={!canSave} onClick={save}>
                  {t.save}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
};
