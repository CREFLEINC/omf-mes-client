import { AlertBanner, Button, Card, Chip, TextArea, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { displayNameOf, useCodeValues } from '../../patterns/code-values';
import { useScannedLot } from '../../patterns/lots';
import { useItem, useUomCodes } from '../../patterns/masters';
import { formatMaterialLotNo } from '../../patterns/material-lot-no';
import { useOutbox } from '../../patterns/outbox';
import { ScanReplaceDialog } from '../../patterns/scan-replace-dialog';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  APPROVAL_REQUEST_STATUS,
  useMyRequests,
  usePendingRequest,
  type ApprovalRequest,
} from './queries';
import { hasReason, isInspectionPending, isRouteMissing, toOutboxDraft } from './request';
import './screen.css';

const t = messages.iqcSkipRequest;
const required = messages.common.required;
const RECORD_LABEL = t.record;

/**
 * 요청이 어디까지 갔는가.
 *
 * 담긴 것을 요청됨으로 보이지 않는다. 긴급이라는 이름 때문에 담긴 것을 갔다고 읽으면,
 * 기다리면 처리된다고 믿는 동안 아무에게도 가 있지 않다.
 */
type Outcome = 'queued' | 'sent' | 'rejected';

const when = (iso: string): string => {
  const at = new Date(iso);

  if (Number.isNaN(at.getTime())) {
    return iso;
  }

  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

const MyRequests = ({
  requests,
  statuses,
}: {
  requests: ApprovalRequest[];
  statuses: { code: string; name: string }[];
}) => (
  <ul className="iqc-skip__requests">
    {requests.map((request) => (
      <li key={request.approvalRequestId}>
        <Card bordered>
          <Card.Body className="card-body iqc-skip__request">
            {/*
             * 표시명은 서버가 갖는다. 코드 문자열을 그대로 보이면 현장이 영문을 읽는다 -
             * 아직 못 받았으면 코드로 물러나되 지어내지는 않는다.
             */}
            <Chip>{displayNameOf(statuses, request.statusCode)}</Chip>
            <span className="iqc-skip__request-name">
              {formatMaterialLotNo(request.target.displayName)}
            </span>
            <span className="iqc-skip__request-when">
              {t.mine.requestedAt(when(request.requestedAt))}
            </span>
          </Card.Body>
        </Card>
      </li>
    ))}
  </ul>
);

export const IqcSkipRequestScreen = () => {
  useScreenTitle(t.title);

  const { countPending, enqueue, flush, isRejected } = useOutbox();
  const { worker } = useWorkerSession();

  const [scanned, setScanned] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 두 건이 담기고, 같은 면제 요청이 두 번 선다.
   */
  const inFlight = useRef(false);
  const [noRoute, setNoRoute] = useState(false);
  const reasonSection = useRef<HTMLDivElement | null>(null);

  const scanField = useScanField({ onScan: setScanned, applied: scanned });

  const lot = useScannedLot(scanned);
  const found = lot.data ?? null;
  const item = useItem(found?.itemId ?? null);
  const uoms = useUomCodes(found !== null);
  const pending = usePendingRequest(found?.lotId ?? null);
  const mine = useMyRequests(worker?.workerNo ?? null);
  const statuses = useCodeValues(APPROVAL_REQUEST_STATUS);

  const inspectionPending = isInspectionPending(found);
  const canSubmit = found !== null && inspectionPending && hasReason(reason) && worker !== null;

  /*
   * 아직 나가지 않은 요청. 이 화면은 이름에 긴급이 붙어 있어, 담긴 것을 요청된 것으로 읽으면
   * 기다리면 되는 줄 알고 아무에게도 안 간다(공유계약 C-7).
   */
  const queuedCount = countPending(RECORD_LABEL);

  /* 세로 화면이라 채운 구획이 자리를 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(found !== null, reasonSection);

  /* 뒤로가기는 스캔한 LOT 을 먼저 놓는다. 두지 않으면 한 번에 작업 목록까지 나간다. */
  useBackStep(found !== null, () => {
    /* 적어 둔 사유는 남긴다 - 손으로 친 것을 뒤로가기 한 번에 버리면 다시 쳐야 한다. */
    setScanned(null);
    scanField.focus();
  });

  const request = async () => {
    if (found === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    setNoRoute(false);

    const draft = toOutboxDraft(found.lotId, reason, new Date().toISOString(), worker.workerNo);

    try {
      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 요청된 줄 안다. */
      try {
        await enqueue(draft);
      } catch {
        setSaveFailed(true);
        return;
      }

      /*
       * 담은 뒤 곧바로 보내 본다. 긴급 요청이라 닿을 수 있으면 지금 보내는 편이 낫고, 못 닿으면
       * 담긴 채로 남아 다음 기회에 나간다.
       */
      const result = await flush().catch(() => null);
      const mineEntry = (entry: { idempotencyKey: string }) =>
        entry.idempotencyKey === draft.idempotencyKey;
      const returned = result?.rejected.find((item) => mineEntry(item.entry));

      if (returned !== undefined) {
        /* 결재선이 없으면 승인자가 정해지지 않아 요청이 설 자리가 없다. 다른 거부와 다른 말을 쓴다. */
        setNoRoute(isRouteMissing(returned.error));
        setOutcome('rejected');
        return;
      }

      /*
       * 자기가 부른 보내기의 결과만 보면 딸려 되돌아간 건을 놓친다 - 그 판정은 셸이 도는 다른
       * 회차에서 내려질 수 있고, 화면은 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      if (isRejected(draft.idempotencyKey)) {
        setOutcome('rejected');
        return;
      }

      setOutcome(result === null || result.remaining.some(mineEntry) ? 'queued' : 'sent');
      void mine.refetch();
    } finally {
      inFlight.current = false;
    }
  };

  const restart = () => {
    setScanned(null);
    setReason('');
    setOutcome(null);
    setNoRoute(false);
    scanField.focus();
  };

  if (outcome !== null) {
    return (
      <div className="iqc-skip">
        {outcome === 'sent' ? (
          <AlertBanner variant="success" title={t.sent.title}>
            {t.sent.description}
          </AlertBanner>
        ) : null}
        {outcome === 'queued' ? (
          <AlertBanner variant="warning" title={t.queued.title}>
            {`${t.queued.description} ${t.queued.urgent}`}
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {noRoute ? t.noRoute : t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <Button variant="filled" size="2xl" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="iqc-skip">
      {/*
       * 담긴 것을 요청된 것으로 읽으면 기다리면 되는 줄 알고 아무에게도 안 간다. 결과 화면을
       * 닫아도 남아 있으므로 화면이 계속 말한다(공유계약 C-7).
       */}
      {queuedCount === 0 ? null : (
        <AlertBanner variant="warning" title={t.queued.waiting(queuedCount)}>
          {t.queued.urgent}
        </AlertBanner>
      )}

      <section className="iqc-skip__section">
        <h2>{t.lot.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.lot.scanLabel}
          placeholder={t.lot.scanPlaceholder}
          size="xl"
          fullWidth
        />
        {/*
         * 스캔 칸 하나로 받는다. 스캐너를 기다리는 동안에는 키보드를 열지 않고, 직접
         * 입력을 누르면 그 칸이 열린다. 치는 도중 스캔이 오면 스캔값이 이긴다.
         */}
        {scanField.manual ? (
          <Button variant="outlined" size="xl" onClick={scanField.submitManual}>
            {t.lot.manualSubmit}
          </Button>
        ) : (
          <Button variant="text" size="xl" onClick={scanField.openManual}>
            {t.lot.manualLabel}
          </Button>
        )}
        {lot.isPending && scanned !== null ? <p role="status">{t.lot.loading}</p> : null}
        {lot.isError ? <AlertBanner variant="error" title={t.lot.loadFailed} /> : null}
        {scanned !== null && !lot.isPending && found === null && !lot.isError ? (
          <AlertBanner variant="warning" title={t.lot.notFound(formatMaterialLotNo(scanned))} />
        ) : null}
        {found === null ? null : (
          <Card bordered>
            <Card.Body className="card-body iqc-skip__lot">
              <strong>{formatMaterialLotNo(found.lotNo)}</strong>
              {item.data === undefined ? null : (
                <span>{`${item.data.itemCode} ${item.data.itemName}`}</span>
              )}
              <span>
                {t.lot.quantity(
                  String(found.initialQty),
                  uoms.data?.get(found.uomId) ?? String(found.uomId),
                )}
              </span>
              <Chip status={inspectionPending ? 'info' : 'warning'}>
                {inspectionPending ? t.lot.pending : t.lot.notPending}
              </Chip>
            </Card.Body>
          </Card>
        )}
        {/* 막지 않고 알린다. 취소가 없어 다시 올리는 것이 유일한 정정 경로다. */}
        {pending.data == null ? null : (
          <AlertBanner
            variant="info"
            title={t.lot.alreadyRequested(when(pending.data.requestedAt))}
          />
        )}
      </section>

      <section className="iqc-skip__section" ref={reasonSection}>
        <h2>{t.reason.legend}</h2>
        <TextArea
          label={required(t.reason.label)}
          placeholder={t.reason.placeholder}
          helperText={t.reason.hint}
          size="lg"
          fullWidth
          rows={3}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </section>

      <AlertBanner variant="info" title={t.expectation} />

      {saveFailed ? (
        <AlertBanner variant="error" title={t.saveFailed.title}>
          {t.saveFailed.description}
        </AlertBanner>
      ) : null}
      {worker === null ? <p className="iqc-skip__note">{t.noWorker}</p> : null}

      <div className="action-bar">
        <Button
          className="iqc-skip__wide"
          variant="filled"
          size="2xl"
          disabled={!canSubmit}
          onClick={() => void request()}
        >
          {t.submit}
        </Button>
      </div>

      <section className="iqc-skip__section">
        <h2>{t.mine.legend}</h2>
        {worker === null ? <p>{t.mine.noWorker}</p> : null}
        {worker !== null && mine.isPending ? <p role="status">{t.mine.loading}</p> : null}
        {mine.isError ? <AlertBanner variant="warning" title={t.mine.loadFailed} /> : null}
        {mine.data === undefined || mine.data.length > 0 ? null : <p>{t.mine.empty}</p>}
        {mine.data === undefined ? null : (
          <MyRequests requests={mine.data} statuses={statuses.data ?? []} />
        )}
      </section>

      <ScanReplaceDialog field={scanField} format={formatMaterialLotNo} />
    </div>
  );
};
