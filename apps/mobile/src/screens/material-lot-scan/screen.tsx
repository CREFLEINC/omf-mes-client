import { AlertBanner, Button, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useItemLabels } from '../../patterns/masters';
import { formatMaterialLotNo } from '../../patterns/material-lot-no';
import { useOutbox } from '../../patterns/outbox';
import { currentPlantId } from '../../patterns/plant';
import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { playErrorTone } from '../../patterns/error-tone';
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
/* 필수 표시는 화면마다 짓지 않는다. 같은 뜻이 여러 모양으로 갈린다. */
const required = messages.common.required;

type Outcome = 'held' | 'sent' | 'rejected';

interface Registered {
  lotNo: string;
  qty: number;
  inboundReceiptLineId: number;
  /** 되돌아온 건을 알아보려고 든다. 오프라인 등록은 그 판정이 늦게 선다. */
  idempotencyKey: string;
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
  const [registered, setRegistered] = useState<Registered[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 같은 라인에 LOT 이 둘 생긴다.
   */
  const inFlight = useRef(false);
  const lineSection = useRef<HTMLElement | null>(null);
  const scanSection = useRef<HTMLElement | null>(null);

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

  /* 이 회차에 보낸 번호는 큐에 없다. 다시 스캔하면 서버가 400 으로 되돌린다. */
  const usedLotNos = [...queuedLotNos, ...registered.map((each) => each.lotNo)];
  const lineItemCode = line === null ? undefined : itemLabels.data?.get(line.itemId)?.itemCode;
  const problem = scanned.trim() === '' ? null : scanProblemOf(scanned, usedLotNos, lineItemCode);
  const labelQty = labelQtyOf(scanned);
  const ready =
    loaded &&
    canRegister(line, scanned, worker !== null, plantId, usedLotNos, filled, lineItemCode);

  const scanField = useScanField({
    onScan: (value) => {
      const taken = value.trim();
      setScanned(taken);

      /* 화면을 보고 있지 않을 수 있다. 소리로도 알린다(공유계약 D-2). */
      if (scanProblemOf(taken, usedLotNos, lineItemCode) !== null) {
        playErrorTone();
      }
    },
  });

  /* 세로 화면이라 채운 구획이 자리를 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(receiptId !== null, lineSection);
  useAdvanceTo(lineId !== null, scanSection);

  /*
   * 뒤로가기는 화면 안 단계를 먼저 되돌린다. 라우터 이력에는 이 화면 하나뿐이라, 두지 않으면
   * 입하 건을 고르고 스캔하던 사람이 한 번에 작업 목록까지 나간다.
   */
  useBackStep(lineId !== null, () => {
    setLineId(null);
    setScanned('');
  });
  useBackStep(lineId === null && receiptId !== null, () => {
    setReceiptId(null);
  });

  const restart = () => {
    setReceiptId(null);
    setLineId(null);
    setScanned('');
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
          idempotencyKey: draft.idempotencyKey,
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

  /*
   * 서버를 부르지 않는다. 건별로 이미 담겼고 이 단추는 화면을 닫는 행위다.
   *
   * 되돌아온 것이 있는지 여기서 다시 본다 - 오프라인에서 담은 건의 판정은 셸이 도는 다른
   * 회차에 서고, 그때 화면은 이미 등록됨을 보이고 있다.
   */
  const finish = () => {
    if (registered.some((each) => isRejected(each.idempotencyKey))) {
      setOutcome('rejected');
      return;
    }

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
        <section className="material-lot-scan__section" ref={lineSection}>
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
          <section className="material-lot-scan__section" ref={scanSection}>
            <h2>{t.scan.legend}</h2>
            {/* 라벨과 눈으로 대조할 값이다. 라인 번호만으로는 무엇을 집는지 알 수 없다. */}
            <p>
              {t.line.pickedLine(
                String(line.lineNo),
                itemLabels.data?.get(line.itemId)?.itemCode ?? '',
                String(line.receivedQty),
              )}
            </p>
            <TextField
              ref={scanField.ref}
              label={required(t.scan.scanLabel)}
              placeholder={t.scan.scanPlaceholder}
              size="xl"
              fullWidth
            />
            {/*
             * 스캔 칸 하나로 받는다. 스캐너를 기다리는 동안에는 키보드를 열지 않고, 직접
             * 입력을 누르면 그 칸이 열린다. 치는 도중 스캔이 오면 스캔값이 이긴다.
             */}
            {scanField.manual ? (
              <Button
                className="material-lot-scan__wide"
                variant="outlined"
                size="xl"
                onClick={scanField.submitManual}
              >
                {t.scan.manualSubmit}
              </Button>
            ) : (
              <Button
                className="material-lot-scan__wide"
                variant="text"
                size="xl"
                onClick={scanField.openManual}
              >
                {t.scan.manualLabel}
              </Button>
            )}

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
          {/* 연속 작업이라 마침 단추가 목록 아래로 밀린다. 설계가 이 자리를 하단으로 잡았다. */}
          <div className="action-bar">
            <Button
              className="material-lot-scan__wide"
              variant="outlined"
              size="2xl"
              onClick={finish}
            >
              {t.done}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};
