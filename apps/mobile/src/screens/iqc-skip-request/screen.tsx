import { AlertBanner, Button, Card, Chip, TextArea, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';
import { Link } from 'react-router';

import { useScannedLot } from '../../patterns/lots';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  useItemName,
  useMyRequests,
  usePendingRequest,
  useUomCodes,
  type ApprovalRequest,
} from './queries';
import { hasReason, isInspectionPending, isRouteMissing, toOutboxDraft } from './request';
import './screen.css';

const t = messages.iqcSkipRequest;

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

const MyRequests = ({ requests }: { requests: ApprovalRequest[] }) => (
  <ul className="iqc-skip__requests">
    {requests.map((request) => (
      <li key={request.approvalRequestId}>
        <Card bordered>
          <Card.Body className="iqc-skip__request">
            {/* 상태 문자열은 공통코드 소관이라 화면이 값을 지어내지 않고 받은 것을 그대로 보인다. */}
            <Chip>{request.statusCode}</Chip>
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

  const { enqueue, flush } = useOutbox();
  const { worker } = useWorkerSession();

  const [scanned, setScanned] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [noRoute, setNoRoute] = useState(false);

  const scanField = useScanField({ onScan: setScanned });

  const lot = useScannedLot(scanned);
  const found = lot.data ?? null;
  const item = useItemName(found?.itemId ?? null);
  const uoms = useUomCodes(found !== null);
  const pending = usePendingRequest(found?.lotId ?? null);
  const mine = useMyRequests();

  const inspectionPending = isInspectionPending(found);
  const canSubmit = found !== null && inspectionPending && hasReason(reason) && worker !== null;

  const request = async () => {
    if (found === null || worker === null) {
      return;
    }

    setNoRoute(false);

    const draft = toOutboxDraft(found.lotId, reason, new Date().toISOString(), worker.workerNo);

    await enqueue(draft);

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

    setOutcome(result === null || result.remaining.some(mineEntry) ? 'queued' : 'sent');
    void mine.refetch();
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
        <Button variant="filled" size="lg" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="iqc-skip">
      <section className="iqc-skip__section">
        <h2>{t.lot.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.lot.scanLabel}
          placeholder={t.lot.scanPlaceholder}
          size="lg"
          fullWidth
        />
        {lot.isPending && scanned !== null ? <p role="status">{t.lot.loading}</p> : null}
        {lot.isError ? <AlertBanner variant="error" title={t.lot.loadFailed} /> : null}
        {scanned !== null && !lot.isPending && found === null && !lot.isError ? (
          <AlertBanner variant="warning" title={t.lot.notFound(scanned)} />
        ) : null}
        {found === null ? null : (
          <Card bordered>
            <Card.Body className="iqc-skip__lot">
              <strong>{found.lotNo}</strong>
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

      <section className="iqc-skip__section">
        <h2>{t.reason.legend}</h2>
        <TextArea
          label={t.reason.label}
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

      {worker === null ? <p className="iqc-skip__note">{t.noWorker}</p> : null}

      <Button variant="filled" size="lg" disabled={!canSubmit} onClick={() => void request()}>
        {t.submit}
      </Button>

      <section className="iqc-skip__section">
        <h2>{t.mine.legend}</h2>
        {mine.isPending ? <p role="status">{t.mine.loading}</p> : null}
        {mine.isError ? <AlertBanner variant="warning" title={t.mine.loadFailed} /> : null}
        {mine.data === undefined || mine.data.length > 0 ? null : <p>{t.mine.empty}</p>}
        {mine.data === undefined ? null : <MyRequests requests={mine.data} />}
      </section>
    </div>
  );
};
