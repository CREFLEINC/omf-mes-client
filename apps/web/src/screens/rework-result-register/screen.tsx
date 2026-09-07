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
    <main className="pop-shell pop-ui rework-result-screen" aria-labelledby="rework-result-title">
      <header className="pop-header">
        <h1 className="pop-title" id="rework-result-title">
          {t.title}
        </h1>
        <p className="pop-context">{selected?.workOrderNo ?? t.selectWorkOrder}</p>
        <p className="pop-context pop-context-right">
          <span>{identity.workerNo ?? '—'}</span>
          <Chip variant="status" size="md" status={isOnline ? 'success' : 'warning'}>
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

                  {/*
                   * ⭐ **네 칸을 2×2 로 세운다** — 스펙 §3 ②의 「양품 [ ] 불량 [ ] / 보류 [ ]
                   *    폐기 [ ]」 배치다. 세로로 넷을 쌓으면 ② 구획이 280px 예산을 넘어 아래의
                   *    ③·④가 밀린다(§3-1 슬랙 0).
                   */}
                  <div className="rework-qty-grid">
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
                  </div>

                  {/*
                   * ⭐ **합계는 ② 안이다** — 스펙 §3 ②의 「합계 160 / 160」. 이번 입력의 몫이고,
                   *    ④의 진행은 이 W/O 의 누계다. 둘을 한 자리에 두면 어느 숫자가 방금 친
                   *    것인지 알 수 없다.
                   */}
                  <p className="rework-qty-total">
                    {t.total} {total} / {progress.remaining}
                  </p>
                  {/*
                   * ⭐ **스펙 §3 ②가 이 안내를 구획 «안»에 둔다** — 「재작업 후 다시 불량이면
                   *    「불량」입니다」. §7 이 안내를 `AlertBanner`(info)로 지정하므로 보조
                   *    문구(`field-note`)가 아니라 배너로 세운다. ⛔ 결과 LOT 이야기는 여기서
                   *    빼고 ③ 구획이 맡는다 — 스펙이 그 둘을 다른 구획으로 갈랐다.
                   */}
                  <AlertBanner variant="info">{t.reworkHint}</AlertBanner>

                  <label>{t.defectCode}</label>
                  {/* ⚠ 크기를 넘긴다 — 안 넘기면 DS 기본(40)에 POP 규칙이 트리거만 늘려 칸이 넘친다. */}
                  <Select
                    aria-label={t.defectCode}
                    size="xl"
                    options={[]}
                    placeholder={t.defectCodePlaceholder}
                    disabled
                  />
                  <p className="field-note">{t.defectCodeReason}</p>
                </div>
                <NumberPad
                  value={drafts[activeKey]}
                  allowDecimal
                  max={progress.remaining}
                  onChange={(value) => setDrafts((current) => ({ ...current, [activeKey]: value }))}
                  size="lg"
                />
              </div>

              {/*
               * ③ 결과 LOT — **스펙 §3 이 독립 구획으로 둔 자리다.** 재작업은 같은 물건을
               * 고치는 것이라 LOT 이 갈리지 않는데(§5-4), 그 사실을 넣은 수량으로 즉시 보인다.
               * ⛔ 접지 않는다 — 수량을 넣으면 바로 바뀌어야 한다(§3 ⚠ E-4).
               */}
              <section className="rework-result-lot" aria-label={t.resultLot.title}>
                <h2 className="pane-title">{t.resultLot.title}</h2>
                <p>
                  {t.resultLot.good(drafts.goodQty === '' ? '0' : drafts.goodQty)} ·{' '}
                  {t.resultLot.keep}
                </p>
                <p>
                  {t.resultLot.rest(
                    drafts.defectQty === '' ? '0' : drafts.defectQty,
                    drafts.holdQty === '' ? '0' : drafts.holdQty,
                  )}
                </p>
              </section>

              {/* ④ 진행 — 이 W/O 의 누계다. ②의 합계가 이번 입력이라면 이쪽은 지금까지의 몫이다. */}
              <section className="rework-result-summary" aria-label={t.progress.title}>
                <h2 className="pane-title">{t.progress.title}</h2>
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
                  valueText={`${t.progress.line(
                    String(progress.completed + total),
                    String(progress.target),
                  )} · ${t.remaining} ${String(remaining)}`}
                  showValue
                />
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
            </>
          )}
        </section>
      </div>

      {/*
       * ⭐ **액션바는 화면 바닥에 붙는 띠다**(스펙 §3 — 헤더 64 + 본문 616 + 액션바 88 = 768).
       *
       * ⛔ 구획 «안»에 두면 그 띠가 서지 않는다 — POP 규격의 액션바 규칙은 화면의 **최상위
       *    자식**만 겨냥한다(`.pop-ui > [class*='action']`). 앞선 판은 오른쪽 구획 안에 있어
       *    본문의 일부로 흘렀고, 고르기 전에는 아예 없었다.
       *
       * ⭐ **고르기 전에도 자리를 지킨다** — 조작이 사라졌다 나타나면 본문이 그만큼 움직인다.
       */}
      <div className="pop-action-bar">
        <div className="pop-action-note">{gateReason && <p>{gateReason}</p>}</div>
        <Button size="2xl" variant="outlined" disabled={selected === null} onClick={reset}>
          {t.reset}
        </Button>
        <Button size="2xl" disabled={!canSave} onClick={save}>
          {t.save}
        </Button>
      </div>
    </main>
  );
};
