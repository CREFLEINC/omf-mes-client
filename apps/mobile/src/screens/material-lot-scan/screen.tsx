import { AlertBanner, Button, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useItemLabels } from '../../patterns/masters';
import { formatMaterialLotNo } from '../../patterns/material-lot-no';
import { useOutbox } from '../../patterns/outbox';
import { currentPlantId } from '../../patterns/plant';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useFillableLines, useSupplierLotReceipts } from './queries';
import {
  LOT_LABEL,
  LOT_NO_LENGTH,
  canRegister,
  labelQtyOf,
  queuedLineIdsOf,
  queuedLotNosOf,
  scanProblemOf,
  toLotDraft,
} from './lot';
import './screen.css';

const t = messages.materialLotScan;

type Outcome = 'held' | 'sent' | 'rejected';

interface Registered {
  lotNo: string;
  qty: number;
  inboundReceiptLineId: number;
}

/** 목록에 보이는 수량은 실제로 담긴 본문의 것이다. 다시 세면 화면과 기록이 갈릴 수 있다. */
const initialQtyOf = (draft: { body: unknown }): number =>
  (draft.body as { initialQty: number }).initialQty;

export const MaterialLotScanScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();

  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [lineId, setLineId] = useState<number | null>(null);
  const [scanned, setScanned] = useState('');
  const [manual, setManual] = useState('');
  const [registered, setRegistered] = useState<Registered[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 같은 라인에 LOT 이 둘 생긴다.
   */
  const inFlight = useRef(false);

  const receipts = useSupplierLotReceipts();
  const lines = useFillableLines(receiptId);

  const itemLabels = useItemLabels((lines.data ?? []).length > 0);
  const plantId = currentPlantId();

  /*
   * 큐에 담긴 것은 서버 응답에 없다. 읽기 전에는 담긴 것이 없는 것과 구별되지 않아 같은
   * 라벨을 두 번 담게 되므로, 읽기 전에는 등록을 막아 둔다.
   */
  const queued = loaded ? pendingOf(LOT_LABEL) : [];
  const queuedLotNos = queuedLotNosOf(queued);
  const queuedLineIds = queuedLineIdsOf(queued);

  /*
   * 이 화면이 이미 채운 라인은 목록에서 뺀다.
   *
   * 큐만 보면 모자란다 - 연결돼 있으면 담자마자 빠져 나가 큐가 비고, 서버 목록은 이 화면이
   * 다시 묻기 전까지 그 라인을 여전히 비어 있는 것으로 준다.
   */
  const filled = [...queuedLineIds, ...registered.map((each) => each.inboundReceiptLineId)];
  const openLines = (lines.data ?? []).filter(
    (each) => !filled.includes(each.inboundReceiptLineId),
  );
  const line = openLines.find((each) => each.inboundReceiptLineId === lineId) ?? null;

  const problem = scanned.trim() === '' ? null : scanProblemOf(scanned, queuedLotNos);
  const labelQty = labelQtyOf(scanned);
  const ready =
    loaded && canRegister(line, scanned, worker !== null, plantId, queuedLotNos, filled);

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
    },
  });

  const restart = () => {
    setReceiptId(null);
    setLineId(null);
    setScanned('');
    setManual('');
    setRegistered([]);
    setOutcome(null);
    setSaveFailed(false);
  };

  const register = async () => {
    if (line === null || worker === null || plantId === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const draft = toLotDraft(line, scanned, plantId, new Date(), worker.workerNo);

      if (draft === null) {
        return;
      }

      /* 담기지 못하면 등록이 어디에도 없다. 말하지 않으면 사람은 등록된 줄 안다. */
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
       * 자기가 부른 보내기의 결과만 보면 셸이 도는 다른 회차에서 되돌려진 건을 놓친다 -
       * 화면은 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(draft.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      setRegistered((current) => [
        {
          lotNo: scanned.trim(),
          qty: initialQtyOf(draft),
          inboundReceiptLineId: line.inboundReceiptLineId,
        },
        ...current,
      ]);
      /* 라인 하나에 LOT 은 하나다. 다음 라인을 고르는 자리로 돌아간다. */
      setScanned('');
      setLineId(null);
    } finally {
      inFlight.current = false;
    }
  };

  /* 서버를 부르지 않는다. 건별로 이미 담겼고 이 단추는 화면을 닫는 행위다. */
  const finish = () => {
    setOutcome(pendingOf(LOT_LABEL).length > 0 ? 'held' : 'sent');
  };

  if (outcome !== null) {
    return (
      <div className="material-lot-scan">
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
        <Button variant="filled" size="2xl" className="material-lot-scan__wide" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="material-lot-scan">
      <section className="material-lot-scan__section">
        <h2>{t.receipt.legend}</h2>
        {receipts.isPending ? <p role="status">{t.receipt.loading}</p> : null}
        {receipts.isError ? <AlertBanner variant="error" title={t.receipt.loadFailed} /> : null}
        {receipts.data?.length === 0 ? <p>{t.receipt.none}</p> : null}
        <label htmlFor="material-lot-scan-receipt">{t.receipt.pick}</label>
        <Select
          id="material-lot-scan-receipt"
          placeholder={t.receipt.pickPlaceholder}
          size="xl"
          value={receiptId === null ? null : String(receiptId)}
          onChange={(value) => {
            setReceiptId(Number(value));
            setLineId(null);
            setScanned('');
          }}
          options={(receipts.data ?? []).map((each) => ({
            value: String(each.inboundReceiptId),
            label: t.receipt.item(each.inboundReceiptNo, each.receiptDatetime.slice(0, 10)),
          }))}
        />
      </section>

      {receiptId === null ? null : (
        <section className="material-lot-scan__section">
          <h2>{t.line.legend}</h2>
          {lines.isPending ? <p role="status">{t.line.loading}</p> : null}
          {lines.isError ? <AlertBanner variant="error" title={t.line.loadFailed} /> : null}
          {lines.data !== undefined && openLines.length === 0 ? (
            <AlertBanner variant="warning" title={t.line.none} />
          ) : null}
          <label htmlFor="material-lot-scan-line">{t.line.pick}</label>
          <Select
            id="material-lot-scan-line"
            placeholder={t.line.pickPlaceholder}
            size="xl"
            value={lineId === null ? null : String(lineId)}
            onChange={(value) => {
              setLineId(Number(value));
              setScanned('');
            }}
            options={openLines.map((each) => ({
              value: String(each.inboundReceiptLineId),
              label: t.line.item(
                String(each.lineNo),
                itemLabels.data?.get(each.itemId)?.itemCode ?? '',
                String(each.receivedQty),
              ),
            }))}
          />
        </section>
      )}

      {line === null ? null : (
        <>
          <section className="material-lot-scan__section">
            <h2>{t.scan.legend}</h2>
            <p>{t.line.picked(String(line.lineNo))}</p>
            <TextField
              ref={scanField.ref}
              label={t.scan.scanLabel}
              placeholder={t.scan.scanPlaceholder}
              size="xl"
              fullWidth
            />
            {/* 스캔 칸은 스캐너 전용이다. 스캐너가 죽었을 때 손으로 넣을 길을 함께 둔다. */}
            <div className="material-lot-scan__row">
              <TextField
                label={t.scan.manualLabel}
                size="xl"
                fullWidth
                inputMode="numeric"
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
                {t.scan.manualSubmit}
              </Button>
            </div>

            {scanned.trim() === '' ? null : (
              <p className="material-lot-scan__counter">
                {t.scan.counter(String(scanned.trim().length), String(LOT_NO_LENGTH))}
              </p>
            )}
            {problem === null ? null : (
              <AlertBanner
                variant="error"
                title={
                  problem === 'length'
                    ? t.scan.problem.length(String(scanned.trim().length), String(LOT_NO_LENGTH))
                    : t.scan.problem[problem]
                }
              />
            )}
            {problem === null && scanned.trim() !== '' ? (
              <p className="material-lot-scan__scanned">{formatMaterialLotNo(scanned.trim())}</p>
            ) : null}
            {/* 라벨 수량은 최초 납품 스냅샷이라 라인 수량과 다를 수 있다. 막지 않는다. */}
            {problem === null && labelQty !== null && labelQty !== line.receivedQty ? (
              <AlertBanner
                variant="warning"
                title={t.qtyDiffers(String(labelQty), String(line.receivedQty))}
              />
            ) : null}
          </section>

          <section className="material-lot-scan__section">
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="material-lot-scan__note">{t.noWorker}</p> : null}
            {plantId === null ? <p className="material-lot-scan__note">{t.noPlant}</p> : null}
            <Button
              className="material-lot-scan__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void register()}
            >
              {t.register}
            </Button>
          </section>
        </>
      )}

      {registered.length === 0 ? null : (
        <section className="material-lot-scan__section">
          <h2>{t.registered.legend(String(registered.length))}</h2>
          <ul className="material-lot-scan__list">
            {registered.map((each) => (
              <li key={each.lotNo}>
                {t.registered.item(formatMaterialLotNo(each.lotNo), String(each.qty))}
              </li>
            ))}
          </ul>
          <Button
            className="material-lot-scan__wide"
            variant="outlined"
            size="2xl"
            onClick={finish}
          >
            {t.done}
          </Button>
        </section>
      )}
    </div>
  );
};
