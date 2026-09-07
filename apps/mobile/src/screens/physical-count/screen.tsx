import { AlertBanner, Button, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useLocationByCode } from '../../patterns/locations';
import { useItemLabels } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useCountLines, useOpenCounts } from './queries';
import {
  COUNT_LABEL,
  canSubmit,
  qtyProblemOf,
  queuedForLocationOf,
  toCountDraft,
  type DraftLine,
} from './count';
import './screen.css';

const t = messages.physicalCount;

type Outcome = 'held' | 'sent' | 'rejected';

export const PhysicalCountScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();

  const [countId, setCountId] = useState<number | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 같은 위치를 두 번 치환한다.
   */
  const inFlight = useRef(false);

  const counts = useOpenCounts();
  const count = (counts.data ?? []).find((each) => each.inventoryCountId === countId) ?? null;
  const location = useLocationByCode(count?.warehouseId ?? null, scanned);
  const at = location.data ?? null;
  const planned = useCountLines(countId, at?.locationId ?? null);

  const itemLabels = useItemLabels(lines.length > 0);

  /*
   * 큐에 담긴 것은 서버 응답에 없다. 읽기 전에는 담긴 것이 없는 것과 구별되지 않아 그 사이에
   * 다시 보내게 되므로, 읽기 전에는 담긴 것으로 세어 막아 둔다.
   */
  const queuedForLocation =
    countId === null || at === null
      ? 0
      : loaded
        ? queuedForLocationOf(pendingOf(COUNT_LABEL), countId, at.locationId)
        : 1;

  const ready = canSubmit(at, lines, worker !== null, queuedForLocation);

  /*
   * 위치의 라인을 화면이 적을 자리로 옮긴다. 수량은 비워 둔다 - 비어 있는 것이 아직 세지
   * 않았다는 뜻이고, 서버가 이미 센 것으로 보는 줄이라도 이번에 다시 세어야 값이 선다.
   */
  useEffect(() => {
    const rows = planned.data;

    if (rows === undefined) {
      return;
    }

    setLines(
      rows.map((row) => ({
        inventoryCountLineId: row.inventoryCountLineId,
        locationId: row.locationId,
        itemId: row.itemId,
        lotId: row.lotId ?? null,
        uomId: row.uomId,
        /* 블라인드 실사에서는 서버가 장부를 내려보내지 않는다. */
        systemQty: row.systemQty ?? null,
        counted: row.counted,
        previousQty: row.counted ? row.countedQty : null,
        qty: '',
      })),
    );
  }, [planned.data]);

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
    },
  });

  const nameOf = (line: DraftLine): string =>
    t.lines.name(
      itemLabels.data?.get(line.itemId)?.itemCode ?? '',
      /* LOT 번호표는 이 슬라이스에 없다. 대리키라도 없는 것보다 낫다. */
      line.lotId === null ? '' : String(line.lotId),
    );

  const restart = () => {
    setScanned(null);
    setManual('');
    setLines([]);
    setOutcome(null);
    setSaveFailed(false);
    scanField.focus();
  };

  const submit = async () => {
    if (count === null || at === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const draft = toCountDraft(count, at.locationId, lines, new Date(), worker.workerNo);

      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 센 줄 안다. */
      try {
        await enqueue(draft);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === draft.idempotencyKey;

      /*
       * 자기가 부른 보내기의 결과만 보면 셸이 도는 다른 회차에서 되돌려진 건을 놓친다 - 화면은
       * 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(draft.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      setOutcome(result === null || result.remaining.some(mine) ? 'held' : 'sent');
    } finally {
      inFlight.current = false;
    }
  };

  if (outcome !== null) {
    return (
      <div className="physical-count">
        {outcome === 'sent' ? <AlertBanner variant="success" title={t.sent.title} /> : null}
        {outcome === 'held' ? (
          <AlertBanner variant="warning" title={t.held.title}>
            {t.held.description}
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <Button variant="filled" size="2xl" className="physical-count__wide" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="physical-count">
      <section className="physical-count__section">
        <h2>{t.plan.legend}</h2>
        {counts.isPending ? <p role="status">{t.plan.loading}</p> : null}
        {counts.isError ? <AlertBanner variant="error" title={t.plan.loadFailed} /> : null}
        {counts.data?.length === 0 ? <p>{t.plan.none}</p> : null}
        <label htmlFor="physical-count-plan">{t.plan.pick}</label>
        <Select
          id="physical-count-plan"
          placeholder={t.plan.pickPlaceholder}
          size="xl"
          value={countId === null ? null : String(countId)}
          onChange={(value) => {
            setCountId(Number(value));
            setScanned(null);
            setLines([]);
          }}
          options={(counts.data ?? []).map((each) => ({
            value: String(each.inventoryCountId),
            label: t.plan.item(each.inventoryCountNo, each.plannedDate),
          }))}
        />
        {/* 장부를 감춘 실사다. 작업자가 장부 수를 보고 그대로 적는 것을 막는다. */}
        {count?.blindCount === true ? <AlertBanner variant="info" title={t.plan.blind} /> : null}
      </section>

      {count === null ? null : (
        <section className="physical-count__section">
          <h2>{t.location.legend}</h2>
          <TextField
            ref={scanField.ref}
            label={t.location.scanLabel}
            placeholder={t.location.scanPlaceholder}
            size="xl"
            fullWidth
          />
          {/* 스캔 칸은 스캐너 전용이다. 스캔이 실패했을 때 손으로 넣을 길을 함께 둔다. */}
          <div className="physical-count__row">
            <TextField
              label={t.location.manualLabel}
              size="xl"
              fullWidth
              value={manual}
              onChange={(event) => {
                setManual(event.target.value);
              }}
            />
            <Button
              variant="outlined"
              size="xl"
              onClick={() => {
                setScanned(manual.trim());
                setManual('');
              }}
            >
              {t.location.manualSubmit}
            </Button>
          </div>

          {scanned !== null && location.isPending ? (
            <p role="status">{t.location.loading}</p>
          ) : null}
          {scanned !== null && location.data === null ? (
            <AlertBanner variant="error" title={t.location.notFound(scanned)} />
          ) : null}
          {at !== null ? <p>{t.location.picked(at.locationCode)}</p> : null}
          {planned.isError ? <AlertBanner variant="error" title={t.location.loadFailed} /> : null}
          {at !== null && planned.data?.length === 0 ? (
            <AlertBanner variant="warning" title={t.location.empty} />
          ) : null}
        </section>
      )}

      {lines.length === 0 ? null : (
        <>
          <section className="physical-count__section">
            <h2>{t.lines.legend}</h2>
            {/* 0 과 빈 칸이 다르다는 것을 말한다. 안 밝히면 안 센 것을 0 으로 적는다. */}
            <p className="physical-count__note">{t.lines.zeroHint}</p>

            {lines.map((line, index) => {
              const problem = qtyProblemOf(line);

              return (
                <div key={line.inventoryCountLineId} className="physical-count__line">
                  <TextField
                    label={t.lines.qtyLabel(nameOf(line))}
                    size="xl"
                    fullWidth
                    inputMode="numeric"
                    value={line.qty}
                    onChange={(event) => {
                      const next = event.target.value;
                      setLines((current) =>
                        current.map((each, at2) => (at2 === index ? { ...each, qty: next } : each)),
                      );
                    }}
                    error={problem === null ? undefined : t.lines.problem[problem]}
                  />
                  {/* 블라인드가 아닐 때만 장부가 온다. */}
                  {line.systemQty === null ? null : (
                    <p className="physical-count__system">
                      {t.lines.systemQty(String(line.systemQty))}
                    </p>
                  )}
                  {/* 안 센 것과 0 으로 센 것을 화면이 갈라 말한다. */}
                  {line.counted ? (
                    <p className="physical-count__previous">
                      {t.lines.already(String(line.previousQty ?? 0))}
                    </p>
                  ) : (
                    <p className="physical-count__previous">{t.lines.uncounted}</p>
                  )}
                </div>
              );
            })}
          </section>

          <section className="physical-count__section">
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="physical-count__note">{t.noWorker}</p> : null}
            <Button
              className="physical-count__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void submit()}
            >
              {t.submit}
            </Button>
          </section>
        </>
      )}
    </div>
  );
};
