import { AlertBanner, Button, Card, Chip, NumberPad, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { useCodeValues } from '../../patterns/code-values';
import { playErrorTone } from '../../patterns/error-tone';
import { useIdempotencyKey } from '../../patterns/idempotency';
import { useScannedLot } from '../../patterns/lots';
import { useItem, useUomCodes } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { ScanReplaceDialog } from '../../patterns/scan-replace-dialog';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  canConfirm,
  completedQtyOf,
  fromWorkOrderIdOf,
  WORK_ORDER_STATUS,
  isNotStarted,
  statusLabelOf,
  lotProblemOf,
  qtyProblemOf,
} from './handover';
import { useConfirmHandover, useLotProgress, useSuccessors } from './queries';
import './screen.css';

const t = messages.wipHandover;

const WORK_LIST_PATH = '/screens';
/* 필수 표시는 화면마다 짓지 않는다. 같은 뜻이 여러 모양으로 갈린다. */
const required = messages.common.required;

interface Handed {
  key: string;
  lotNo: string;
  workOrderNo: string;
  qty: string;
}

export const WipHandoverScreen = () => {
  useScreenTitle(t.title);

  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { worker } = useWorkerSession();

  const [scanned, setScanned] = useState<string | null>(null);
  const [toWorkOrderId, setToWorkOrderId] = useState<number | null>(null);
  const [qty, setQty] = useState('');
  const [handed, setHanded] = useState<Handed[]>([]);
  const [scanSeq, setScanSeq] = useState(0);
  const nextSection = useRef<HTMLElement | null>(null);
  const qtySection = useRef<HTMLElement | null>(null);

  const lot = useScannedLot(scanned);
  const found = lot.data ?? null;
  const item = useItem(found?.itemId ?? null);
  const uoms = useUomCodes(found !== null);

  const problem = found === null ? null : lotProblemOf(found);
  const fromWorkOrderId = found === null ? null : fromWorkOrderIdOf(found);
  const successors = useSuccessors(fromWorkOrderId);
  const statusNames = useCodeValues(WORK_ORDER_STATUS);
  const statusNameOf = new Map((statusNames.data ?? []).map((value) => [value.code, value.name]));
  const progress = useLotProgress(found === null || problem !== null ? null : found.lotId);
  const completedQty = completedQtyOf(progress.data ?? null);

  const confirm = useConfirmHandover();
  /* 한 번의 확정에 키 하나. 재시도가 같은 키로 가야 서버가 중복을 막는다. */
  const idempotency = useIdempotencyKey();

  const scanField = useScanField({
    applied: scanned,
    onScan: (value) => {
      setScanned(value.trim());
      setToWorkOrderId(null);
      setQty('');
      /* 같은 라벨을 다시 스캔한 것도 한 회차다. 값만 보면 두 번째 스캔이 조용히 지나간다. */
      setScanSeq((seq) => seq + 1);
      /* 다른 LOT 을 적기 시작했다. 앞 시도의 키를 물려주면 서버가 이것을 그 시도로 본다. */
      idempotency.reset();
      confirm.reset();
    },
  });

  const chosen = successors.data?.find((each) => each.workOrderId === toWorkOrderId) ?? null;
  const uom = uoms.data?.get(found?.uomId ?? -1) ?? '';
  const ready = canConfirm(found, chosen, qty, worker !== null, completedQty);

  /* 넘긴 것은 그대로 두고 다음 LOT 만 비운다. 연속 작업이라 지금까지가 함께 보여야 한다. */
  const clearScan = () => {
    setScanned(null);
    setToWorkOrderId(null);
    setQty('');
    confirm.reset();
    idempotency.reset();
    scanField.focus();
  };

  /*
   * 스캔한 것을 찾지 못했다는 것을 소리로도 알린다(공유계약 D-2). 기기를 허리에 매단 채
   * 읽으므로 화면에만 적으면 사람은 통과한 줄 알고 다음 동작으로 넘어간다.
   */
  const scanMissed = scanned !== null && lot.isSuccess && lot.data === null;

  useEffect(() => {
    if (scanMissed) {
      playErrorTone();
    }
  }, [scanMissed, scanSeq]);

  /* 세로 화면이라 채운 구획이 자리를 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(found !== null && problem === null, nextSection);
  useAdvanceTo(chosen !== null, qtySection);

  /*
   * 뒤로가기는 고른 LOT 을 먼저 놓는다. 두지 않으면 수량을 적던 사람이 한 번에 작업 목록까지
   * 나가 LOT 을 다시 스캔해야 한다.
   */
  useBackStep(found !== null, clearScan);

  const submit = () => {
    /*
     * 다시 보내기도 여기로 온다. null 만 보고 넘기면 실패한 뒤 수량을 고쳐 놓고 눌렀을 때
     * 상한을 넘긴 값이 그대로 나간다 - 본 단추는 막혀 있는데 이 길만 열려 있었다.
     */
    if (
      !ready ||
      !online ||
      found === null ||
      chosen === null ||
      fromWorkOrderId === null ||
      worker === null
    ) {
      return;
    }

    confirm.mutate(
      {
        lot: found,
        fromWorkOrderId,
        toWorkOrderId: chosen.workOrderId,
        qty,
        workerNo: worker.workerNo,
        idempotencyKey: idempotency.current(),
      },
      {
        onSuccess: () => {
          setHanded((prev) => [
            ...prev,
            {
              key: idempotency.current(),
              lotNo: found.lotNo,
              workOrderNo: chosen.workOrderNo,
              qty: `${qty.trim()} ${uom}`,
            },
          ]);
          clearScan();
        },
      },
    );
  };

  /*
   * 들어올 때 끊겨 있으면 막는다. 스캔은 연속 작업이라, 다 해 놓고 저장에서 막히면 작업을
   * 통째로 버린다.
   *
   * 하다가 끊긴 것은 다르다 - 적은 것을 치우면 작업자는 사라진 줄 알고 처음부터 다시 한다.
   * 그때는 저장만 막고 화면은 그대로 둔다.
   */
  const startedWork = found !== null || handed.length > 0;

  if (!online && !startedWork) {
    return (
      <div className="handover">
        <AlertBanner variant="warning" title={t.offline.title}>
          {t.offline.description}
        </AlertBanner>
      </div>
    );
  }

  const qtyMessage = (): string | undefined => {
    if (found === null || qty.trim() === '') {
      return undefined;
    }

    if (completedQty === null) {
      return undefined;
    }

    const trouble = qtyProblemOf(qty, completedQty);

    if (trouble === null) {
      return undefined;
    }

    return trouble === 'overCompleted'
      ? t.qty.problem.overCompleted(`${String(completedQty)} ${uom}`)
      : t.qty.problem[trouble];
  };

  return (
    <div className="handover">
      {/* 하다가 끊긴 것은 다르다. 적은 것을 그대로 두고 저장만 막는다. */}
      {online ? null : <AlertBanner variant="warning" title={t.offline.duringWork} />}

      <section className="handover__section">
        <h2>{t.lot.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={required(t.lot.scanLabel)}
          placeholder={t.lot.scanPlaceholder}
          size="xl"
          fullWidth
        />
        {/* 스캐너가 못 읽는 라벨이 있다. 스캔 칸 자체를 열어 손으로 넣는다(공유계약 D-3). */}
        <Button
          className="handover__wide"
          variant={scanField.manual ? 'outlined' : 'text'}
          size="xl"
          onClick={scanField.manual ? scanField.submitManual : scanField.openManual}
        >
          {scanField.manual ? t.lot.manualSubmit : t.lot.manualLabel}
        </Button>

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
              <p>
                {completedQty === null
                  ? t.lot.qtyUnknown
                  : t.lot.qty(`${String(completedQty)} ${uom}`)}
              </p>
            </Card.Body>
          </Card>
        )}

        {problem === null ? null : (
          <AlertBanner variant="error" title={t.lot.problem[problem]}>
            {problem === 'held' ? t.lot.problem.heldWhy : null}
            {scanned === null ? null : <p>{t.lot.scannedWas(scanned)}</p>}
          </AlertBanner>
        )}
      </section>

      {found === null || problem !== null ? null : (
        <>
          <section className="handover__section" ref={nextSection}>
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
                    label: t.next.option(
                      each.workOrderNo,
                      each.routingOperationName ?? '',
                      statusLabelOf(each.statusCode, statusNameOf),
                    ),
                  }))}
                />
              </div>
            ) : null}
            {chosen !== null && isNotStarted(chosen) ? (
              <AlertBanner variant="warning" title={t.next.notStarted} />
            ) : null}
          </section>

          <section className="handover__section" ref={qtySection}>
            {/*
             * 장갑을 끼고 한 손으로 조작한다. 단말 키보드는 키가 촘촘하고, 올라오면 다음 공정
             * 선택과 확정 단추를 덮는다(설계 §7 · 공유계약 G-6).
             */}
            <TextField
              label={required(t.qty.label)}
              size="xl"
              fullWidth
              inputMode="none"
              value={qty}
              onChange={(event) => {
                setQty(event.target.value);
              }}
              error={qtyMessage()}
            />
            <NumberPad value={qty} onChange={setQty} max={completedQty ?? undefined} allowDecimal />
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
              disabled={!ready || !online}
              loading={confirm.isPending}
              onClick={submit}
            >
              {t.submit}
            </Button>
          </section>
        </>
      )}

      {handed.length === 0 ? null : (
        <section className="handover__section">
          <h2>{t.done.count(String(handed.length))}</h2>
          {/* 받는 쪽 화면이 없다. 기다릴 것이 없다는 것을 한 번 말한다. */}
          <p className="handover__note">{t.sent.description}</p>
          <ul className="handover__done">
            {handed.map((each) => (
              <li key={each.key}>
                <span>{t.done.row(each.lotNo, each.workOrderNo, each.qty)}</span>
                <Chip status="success">{t.sent.title}</Chip>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 넘긴 것이 쌓이면 마침 단추가 접힌 자리로 밀린다(설계 §3 액션 72). */}
      <div className="action-bar">
        <Button
          className="handover__wide"
          variant="outlined"
          size="2xl"
          disabled={handed.length === 0}
          onClick={() => {
            void navigate(WORK_LIST_PATH);
          }}
        >
          {t.done.submit}
        </Button>
      </div>

      <ScanReplaceDialog field={scanField} />
    </div>
  );
};
