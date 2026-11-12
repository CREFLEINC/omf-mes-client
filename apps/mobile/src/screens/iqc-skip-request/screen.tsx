import { AlertBanner, Chip, TextArea, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { Button } from '../../patterns/button';
import { Card } from '../../patterns/card';
import { displayNameOf, useCodeValues } from '../../patterns/code-values';
import { lifecycleNoticeOf, useScannedLot } from '../../patterns/lots';
import { uomLabelOf, useItem, useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { formatPackQty } from '../../patterns/package-qty';
import { plantShortDateTime } from '../../patterns/plant-time';
import { ScanReplaceDialog } from '../../patterns/scan-replace-dialog';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import {
  APPROVAL_REQUEST_STATUS,
  useMyRequests,
  usePendingRequest,
  type ApprovalRequest,
} from './queries';
import {
  approvalTargetIdOf,
  hasReason,
  inboundLotOfResponse,
  isInboundLotReceiving,
  isInspectionPending,
  isRouteMissing,
  toOutboxDraft,
} from './request';
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

/**
 * 「11-12 20:59」 — **공장 시각**(M-01-03 · 관리웹과 같다). 기기 시간대로 그리면 기기 설정에 따라
 * 시각이 달라진다(L-f — 공장 20:59 를 22:59 로 보였다).
 */
const when = (iso: string): string => plantShortDateTime(iso);

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
            <span className="iqc-skip__request-name">{request.target.displayName}</span>
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
  const failureText = useLoadFailure();

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
  /* 005 — 입하 중(마감 전) 입하 LOT 이라 되돌아왔다(FR-032 · 409). */
  const [receiving, setReceiving] = useState(false);
  /* 005 — 요청 응답의 입하 LOT 번호 · LOT 수(계약 §11). */
  const [sentInboundLot, setSentInboundLot] = useState<{
    inboundLotNo: string;
    lotCount: number;
  } | null>(null);
  const reasonSection = useRef<HTMLDivElement | null>(null);

  /*
   * 새 LOT 을 받으면 적어 둔 것을 비운다. 사유는 이 LOT 을 왜 급히 써야 하는가를 적는 자리라
   * 앞 LOT 을 위해 쓴 글이 다른 LOT 의 요청으로 올라간다 - 승인자는 그 사유만 보고 판단한다.
   *
   * 같은 LOT 을 다시 댄 것은 바꾸는 것이 아니므로 훅이 여기까지 오지 않는다.
   */
  const scanField = useScanField({
    applied: scanned,
    onScan: (value) => {
      setScanned(value);
      setReason('');
      setNoRoute(false);
      setSaveFailed(false);
    },
  });

  const lot = useScannedLot(scanned);
  const found = lot.data ?? null;
  const item = useItem(found?.itemId ?? null);
  const uoms = useUomCodes(found !== null);
  const uomOf = (uomId: number | null | undefined) => uomLabelOf(uoms.data, uomId);
  const pending = usePendingRequest(approvalTargetIdOf(found));
  const mine = useMyRequests(worker?.workerNo ?? null);
  const statuses = useCodeValues(APPROVAL_REQUEST_STATUS);

  const inspectionPending = isInspectionPending(found);
  /*
   * 대기 · 폐기 자재 관리 LOT 도 품질 축은 검사 대기다. 막지 않으면 아직 받지 않은 LOT 의 생략 요청이
   * 서버까지 갔다가 되돌아온다 — 그 전에 까닭을 말한다(US1-6).
   */
  const lifecycleNotice = lifecycleNoticeOf(found);
  const canSubmit =
    found !== null &&
    lifecycleNotice === null &&
    inspectionPending &&
    hasReason(reason) &&
    worker !== null;

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
    setReceiving(false);
    setSentInboundLot(null);

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
        setReceiving(isInboundLotReceiving(returned.error));
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

      setSentInboundLot(inboundLotOfResponse(result?.responses.get(draft.idempotencyKey)));
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
    setReceiving(false);
    setSentInboundLot(null);
    scanField.focus();
  };

  if (outcome !== null) {
    return (
      <div className="iqc-skip">
        {outcome === 'sent' ? (
          <AlertBanner variant="success" title={t.sent.title}>
            {sentInboundLot === null
              ? t.sent.description
              : `${t.sent.inboundLot(sentInboundLot.inboundLotNo, String(sentInboundLot.lotCount))} ${t.sent.description}`}
          </AlertBanner>
        ) : null}
        {outcome === 'queued' ? (
          <AlertBanner variant="warning" title={t.queued.title}>
            {`${t.queued.description} ${t.queued.urgent}`}
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {noRoute ? t.noRoute : receiving ? t.receiving : t.rejected.description}
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
          <AlertBanner variant="warning" title={t.lot.notFound(scanned)} />
        ) : null}
        {found === null ? null : (
          <Card bordered>
            <Card.Body className="card-body iqc-skip__lot">
              <strong>{found.lotNo}</strong>
              {item.data === undefined ? null : (
                <span>{`${item.data.itemCode} ${item.data.itemName}`}</span>
              )}
              <span>{t.lot.quantity(formatPackQty(found.initialQty), uomOf(found.uomId))}</span>
              {/* 005 — 상자 라벨 하나로 그 입하 LOT 전체를 요청한다(FR-032). */}
              {found.inboundLotNo === null || found.inboundLotNo === undefined ? null : (
                <>
                  <span>{t.lot.inboundLot(found.inboundLotNo)}</span>
                  <span className="iqc-skip__note">{t.lot.inboundLotNote}</span>
                </>
              )}
              <Chip status={inspectionPending ? 'info' : 'warning'}>
                {inspectionPending ? t.lot.pending : t.lot.notPending}
              </Chip>
            </Card.Body>
          </Card>
        )}
        {lifecycleNotice === null ? null : <AlertBanner variant="error" title={lifecycleNotice} />}
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
        {mine.isError ? (
          <FailureBanner variant="warning" title={failureText(mine.error, t.mine.loadFailed)} />
        ) : null}
        {mine.data === undefined || mine.data.length > 0 ? null : <p>{t.mine.empty}</p>}
        {mine.data === undefined ? null : (
          <MyRequests requests={mine.data} statuses={statuses.data ?? []} />
        )}
      </section>

      <ScanReplaceDialog field={scanField} />
    </div>
  );
};
