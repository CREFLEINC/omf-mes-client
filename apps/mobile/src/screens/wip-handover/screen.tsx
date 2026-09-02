import { AlertBanner, Button, Card, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useScannedLot } from '../../patterns/lots';
import { useItem, useUomCodes } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  canConfirm,
  fromWorkOrderIdOf,
  isUnreleased,
  lotProblemOf,
  qtyProblemOf,
} from './handover';
import { useConfirmHandover, useSuccessors } from './queries';
import './screen.css';

const t = messages.wipHandover;

export const WipHandoverScreen = () => {
  useScreenTitle(t.title);

  const online = useOnlineStatus();
  const { worker } = useWorkerSession();

  const [scanned, setScanned] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [toWorkOrderId, setToWorkOrderId] = useState<number | null>(null);
  const [qty, setQty] = useState('');
  const [done, setDone] = useState(false);

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
      setToWorkOrderId(null);
      setQty('');
    },
  });

  const lot = useScannedLot(scanned);
  const found = lot.data ?? null;
  const item = useItem(found?.itemId ?? null);
  const uoms = useUomCodes(found !== null);

  const problem = found === null ? null : lotProblemOf(found);
  const fromWorkOrderId = found === null ? null : fromWorkOrderIdOf(found);
  const successors = useSuccessors(fromWorkOrderId);

  const confirm = useConfirmHandover();

  const chosen = successors.data?.find((each) => each.workOrderId === toWorkOrderId) ?? null;
  const uom = uoms.data?.get(found?.uomId ?? -1) ?? '';
  const ready = canConfirm(found, chosen, qty, worker !== null);

  const restart = () => {
    setScanned(null);
    setManual('');
    setToWorkOrderId(null);
    setQty('');
    setDone(false);
    confirm.reset();
    scanField.focus();
  };

  const submit = () => {
    if (found === null || chosen === null || fromWorkOrderId === null || worker === null) {
      return;
    }

    confirm.mutate(
      {
        lot: found,
        fromWorkOrderId,
        toWorkOrderId: chosen.workOrderId,
        qty,
        workerNo: worker.workerNo,
      },
      { onSuccess: () => { setDone(true); } },
    );
  };

  /*
   * 연결이 끊기면 진입 자체를 막는다. 스캔은 연속 작업이라, 다 해 놓고 저장에서 막히면
   * 작업을 통째로 버린다.
   */
  if (!online) {
    return (
      <div className="handover">
        <AlertBanner variant="warning" title={t.offline.title}>
          {t.offline.description}
        </AlertBanner>
      </div>
    );
  }

  if (done) {
    return (
      <div className="handover">
        <AlertBanner variant="success" title={t.sent.title}>
          {t.sent.description}
        </AlertBanner>
        <Button variant="filled" size="2xl" className="handover__wide" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  const qtyMessage = (): string | undefined => {
    if (found === null || qty.trim() === '') {
      return undefined;
    }

    const trouble = qtyProblemOf(qty, found.initialQty);

    if (trouble === null) {
      return undefined;
    }

    return trouble === 'overCompleted'
      ? t.qty.problem.overCompleted(`${String(found.initialQty)} ${uom}`)
      : t.qty.problem[trouble];
  };

  return (
    <div className="handover">
      <section className="handover__section">
        <h2>{t.lot.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.lot.scanLabel}
          placeholder={t.lot.scanPlaceholder}
          size="xl"
          fullWidth
        />
        {/* 스캔 칸은 스캐너 전용이다. 스캔이 실패했을 때 손으로 넣을 길을 함께 둔다. */}
        <div className="handover__row">
          <TextField
            label={t.lot.manualLabel}
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
              setToWorkOrderId(null);
              setQty('');
              setManual('');
            }}
          >
            {t.lot.manualSubmit}
          </Button>
        </div>

        {scanned !== null && lot.isPending ? <p role="status">{t.lot.loading}</p> : null}
        {lot.isError ? <AlertBanner variant="warning" title={t.lot.loadFailed} /> : null}
        {scanned !== null && lot.data === null ? (
          <AlertBanner variant="error" title={t.lot.notFound(scanned)} />
        ) : null}

        {found === null ? null : (
          <Card bordered>
            <Card.Header>{found.lotNo}</Card.Header>
            <Card.Body className="card-body">
              <p>{item.data?.itemName ?? ''}</p>
              <p>{t.lot.qty(`${String(found.initialQty)} ${uom}`)}</p>
            </Card.Body>
          </Card>
        )}

        {problem === null ? null : (
          <AlertBanner variant="error" title={t.lot.problem[problem]}>
            {problem === 'held' ? t.lot.problem.heldWhy : null}
          </AlertBanner>
        )}
      </section>

      {found === null || problem !== null ? null : (
        <>
          <section className="handover__section">
            <h2>{t.next.legend}</h2>
            {successors.isPending ? <p role="status">{t.next.loading}</p> : null}
            {successors.isError ? (
              <AlertBanner variant="warning" title={t.next.loadFailed} />
            ) : null}
            {successors.data !== undefined && successors.data.length === 0 ? (
              <AlertBanner variant="info" title={t.next.none} />
            ) : null}
            {successors.data !== undefined && successors.data.length > 0 ? (
              <div className="handover__field">
                <label htmlFor="handover-next">{t.next.label}</label>
                <Select
                  id="handover-next"
                  placeholder={t.next.placeholder}
                  size="xl"
                  value={toWorkOrderId === null ? null : String(toWorkOrderId)}
                  onChange={(value) => {
                    setToWorkOrderId(Number(value));
                  }}
                  options={successors.data.map((each) => ({
                    value: String(each.workOrderId),
                    label: t.next.option(each.workOrderNo, each.routingOperationName ?? ''),
                  }))}
                />
              </div>
            ) : null}
            {chosen !== null && isUnreleased(chosen) ? (
              <AlertBanner variant="warning" title={t.next.unreleased} />
            ) : null}
          </section>

          <section className="handover__section">
            <TextField
              label={t.qty.label}
              size="xl"
              fullWidth
              inputMode="numeric"
              value={qty}
              onChange={(event) => {
                setQty(event.target.value);
              }}
              error={qtyMessage()}
            />
          </section>

          <section className="handover__section">
            {worker === null ? <p className="handover__note">{t.noWorker}</p> : null}
            {confirm.isError ? (
              <AlertBanner variant="error" title={t.failed.title}>
                <Button variant="text" onClick={submit}>
                  {t.failed.retry}
                </Button>
              </AlertBanner>
            ) : null}
            <Button
              className="handover__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              loading={confirm.isPending}
              onClick={submit}
            >
              {t.submit}
            </Button>
          </section>
        </>
      )}
    </div>
  );
};
