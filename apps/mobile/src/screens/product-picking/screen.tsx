import { AlertBanner, Button, Card, Chip, NumberPad, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';

import { useItem, useUomCodes } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { toApiError } from '../../patterns/request';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  toCandidates,
  useAvailableByLot,
  useLotPool,
  usePickLine,
  useTodayRequests,
} from './queries';
import {
  FEFO,
  FIFO,
  canPick,
  isRecommended,
  isConflict,
  isShelfLifeUnknown,
  lotProblem,
  qtyProblem,
  rankCandidates,
  remainingAllocated,
  remainingDays,
  sortFieldOf,
  type Candidate,
  type ShipmentRequest,
  type ShipmentRequestLine,
} from './picking';
import './screen.css';

const t = messages.productPicking;

interface Target {
  request: ShipmentRequest;
  line: ShipmentRequestLine;
}

const policyLabel = (policy: string): string => {
  if (policy === FEFO) {
    return t.candidates.fefo;
  }

  return policy === FIFO ? t.candidates.fifo : policy;
};

const CandidateCard = ({
  candidate,
  line,
  today,
  uoms,
  recommended,
  selected,
  onSelect,
}: {
  candidate: Candidate;
  line: ShipmentRequestLine;
  today: Date;
  uoms: Map<number, string> | undefined;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
}) => {
  const problem = lotProblem(candidate, line, today);
  const remaining = remainingDays(candidate.lot, today);
  const uom = uoms?.get(candidate.lot.uomId) ?? '';

  return (
    <Card bordered>
      <Card.Body className="picking__candidate">
        <div className="picking__candidate-head">
          <strong>{candidate.lot.lotNo}</strong>
          {recommended ? <Chip status="success">{t.candidates.recommended}</Chip> : null}
        </div>
        <p>{t.candidates.available(String(candidate.availableQty), uom)}</p>
        <p className="picking__note">
          {candidate.lot.expiryDate === null || candidate.lot.expiryDate === undefined
            ? t.candidates.noExpiry
            : `${t.candidates.expiry(candidate.lot.expiryDate)}${
                remaining === null ? '' : ` · ${t.candidates.remainingDays(remaining)}`
              }`}
        </p>

        {problem === 'shelfLifeShort' ? (
          <AlertBanner
            variant="error"
            title={t.lot.shelfLifeShort(line.minimumRemainingShelfLifeDays ?? 0, remaining ?? 0)}
          />
        ) : problem === null ? null : (
          <AlertBanner variant="error" title={t.lot[problem]} />
        )}

        {/* 셀 수 없는 것을 넉넉한 것으로 두지 않는다. 막지도 않는다 — 정본은 서버다. */}
        {problem === null && isShelfLifeUnknown(candidate, line, today) ? (
          <AlertBanner variant="warning" title={t.lot.shelfLifeUnknown} />
        ) : null}

        <Button
          className="picking__pick"
          variant={selected ? 'filled' : 'outlined'}
          size="xl"
          disabled={problem !== null}
          onClick={onSelect}
        >
          {t.candidates.choose}
        </Button>
      </Card.Body>
    </Card>
  );
};

export const ProductPickingScreen = () => {
  useScreenTitle(t.title);

  const online = useOnlineStatus();
  const { worker } = useWorkerSession();
  const today = useMemo(() => new Date(), []);

  const [target, setTarget] = useState<Target | null>(null);
  const [lotId, setLotId] = useState<number | null>(null);
  const [qty, setQty] = useState('');
  const [manual, setManual] = useState('');
  const [missed, setMissed] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const requests = useTodayRequests(today);
  const itemId = target?.line.itemId ?? null;
  const item = useItem(itemId);
  const uoms = useUomCodes(true);
  const pool = useLotPool(itemId);
  const available = useAvailableByLot(itemId);
  const pick = usePickLine();

  const candidates = useMemo(
    () =>
      pool.data === undefined || available.data === undefined
        ? []
        : toCandidates(pool.data, available.data),
    [available.data, pool.data],
  );

  const ranked = useMemo(
    () => rankCandidates(candidates, item.data?.fifoPolicyCode ?? ''),
    [candidates, item.data?.fifoPolicyCode],
  );

  const takeScan = (code: string) => {
    const found = candidates.find((each) => each.lot.lotNo === code);

    if (found === undefined) {
      setMissed(code);
      return;
    }

    setMissed(null);
    setLotId(found.lot.lotId);
    setQty('');
  };

  const scanField = useScanField({ onScan: takeScan });

  if (!online) {
    return (
      <div className="picking">
        <AlertBanner variant="warning" title={t.offline.title}>
          {t.offline.description}
        </AlertBanner>
      </div>
    );
  }

  const selected = candidates.find((each) => each.lot.lotId === lotId) ?? null;
  const problem = target === null || selected === null ? null : qtyProblem(selected, target.line, qty);

  const qtyMessage = (): string | undefined => {
    if (selected === null || target === null || problem === null) {
      return undefined;
    }

    if (problem === 'overAvailable') {
      return t.qty.overAvailable(String(selected.availableQty));
    }

    if (problem === 'overAllocated') {
      return t.qty.overAllocated(String(remainingAllocated(target.line)));
    }

    return t.qty[problem];
  };

  const restart = () => {
    setLotId(null);
    setQty('');
    setManual('');
    setMissed(null);
    setDone(false);
    scanField.focus();
  };

  const confirm = async () => {
    if (target === null || selected === null || worker === null) {
      return;
    }

    await pick
      .mutateAsync({
        shipmentRequestId: target.request.shipmentRequestId,
        line: target.line,
        candidate: selected,
        qty,
        workerNo: worker.workerNo,
      })
      .then(() => {
        setDone(true);
      })
      .catch(() => null);
  };

  if (done) {
    return (
      <div className="picking">
        <AlertBanner variant="success" title={t.done.title}>
          {t.done.description}
        </AlertBanner>
        <Button className="picking__pick" variant="filled" size="2xl" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  if (target === null) {
    return (
      <div className="picking">
        <section className="picking__section">
          <h2>{t.targets.legend}</h2>
          {requests.isPending ? <p role="status">{t.targets.loading}</p> : null}
          {requests.isError ? <AlertBanner variant="error" title={t.targets.loadFailed} /> : null}
          {requests.data !== undefined && requests.data.length === 0 ? (
            <p className="picking__note">{t.targets.none}</p>
          ) : null}
          <ul className="picking__targets">
            {(requests.data ?? []).flatMap((request) =>
              (request.lines ?? []).map((line) => {
                const left = remainingAllocated(line);

                return (
                  <li key={`${String(request.shipmentRequestId)}-${String(line.shipmentRequestLineId)}`}>
                    <Button
                      className="picking__pick"
                      variant="outlined"
                      size="xl"
                      onClick={() => {
                        setTarget({ request, line });
                        setLotId(null);
                        setQty('');
                        setMissed(null);
                      }}
                    >
                      <span className="picking__target-line">
                        <strong>{request.shipmentRequestNo}</strong>
                        <span>{t.targets.line(line.lineNo)}</span>
                        <span>
                          {t.targets.progress(String(line.allocatedQty), String(line.pickedQty))}
                        </span>
                        <span>{left <= 0 ? t.targets.complete : t.targets.remaining(String(left), '')}</span>
                      </span>
                    </Button>
                  </li>
                );
              }),
            )}
          </ul>
        </section>
      </div>
    );
  }

  const lineUom = uoms.data?.get(target.line.uomId) ?? '';

  return (
    <div className="picking">
      <section className="picking__section">
        <h2>{t.target.legend}</h2>
        <Card bordered>
          <Card.Body className="picking__card">
            <strong>{target.request.shipmentRequestNo}</strong>
            <p>{item.data === undefined ? '' : `${item.data.itemCode} ${item.data.itemName}`}</p>
            {item.isError ? <p className="picking__note">{t.target.itemFailed}</p> : null}
            <p>
              {t.targets.progress(String(target.line.allocatedQty), String(target.line.pickedQty))}
            </p>
            <p>{t.targets.remaining(String(remainingAllocated(target.line)), lineUom)}</p>
            {target.line.shippingInspectionRequired ? <Chip>{t.targets.inspection}</Chip> : null}
          </Card.Body>
        </Card>

        {/* 자유 텍스트다. 해석해 LOT 을 걸러내지 않고 그대로 크게 보인다. */}
        {target.line.customerLotRequirement === null ||
        target.line.customerLotRequirement === undefined ||
        target.line.customerLotRequirement.trim() === '' ? null : (
          <AlertBanner variant="info" title={t.target.customerRequirement}>
            {target.line.customerLotRequirement}
          </AlertBanner>
        )}

        {target.line.minimumRemainingShelfLifeDays === null ||
        target.line.minimumRemainingShelfLifeDays === undefined ? null : (
          <p className="picking__note">
            {t.target.minimumShelfLife(target.line.minimumRemainingShelfLifeDays)}
          </p>
        )}

        <Button
          className="picking__pick"
          variant="text"
          size="lg"
          onClick={() => {
            setTarget(null);
            setLotId(null);
            setQty('');
            setMissed(null);
          }}
        >
          {t.target.change}
        </Button>
      </section>

      <section className="picking__section">
        <h2>{t.scan.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.scan.label}
          placeholder={t.scan.placeholder}
          size="xl"
          fullWidth
          error={missed === null ? undefined : t.scan.notFound(missed)}
        />
        {/* 스캔이 실패했을 때 손으로 넣을 길을 함께 둔다. */}
        <div className="picking__manual">
          <TextField
            label={t.scan.manualLabel}
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
              takeScan(manual.trim());
            }}
          >
            {t.scan.manualSubmit}
          </Button>
        </div>
      </section>

      <section className="picking__section">
        <h2>{t.candidates.legend(policyLabel(item.data?.fifoPolicyCode ?? ''))}</h2>
        {pool.isPending || available.isPending ? <p role="status">{t.candidates.loading}</p> : null}
        {pool.isError || available.isError ? (
          <AlertBanner variant="error" title={t.candidates.loadFailed} />
        ) : null}
        {pool.data !== undefined && candidates.length === 0 ? (
          <AlertBanner variant="warning" title={t.candidates.none} />
        ) : null}

        {/* 모르는 정책으로 줄을 세운 척하면 엉뚱한 순서를 권장으로 낸다. */}
        {item.data !== undefined && sortFieldOf(item.data.fifoPolicyCode) === null ? (
          <AlertBanner variant="warning" title={t.candidates.unknownPolicy} />
        ) : null}

        <ul className="picking__candidates">
          {ranked.ordered.map((candidate) => (
            <li key={candidate.lot.lotId}>
              <CandidateCard
                candidate={candidate}
                line={target.line}
                today={today}
                uoms={uoms.data}
                recommended={isRecommended(ranked, candidate.lot.lotId)}
                selected={candidate.lot.lotId === lotId}
                onSelect={() => {
                  setLotId(candidate.lot.lotId);
                  setQty('');
                }}
              />
            </li>
          ))}
        </ul>

        {ranked.unordered.length === 0 ? null : (
          <>
            <h3 className="picking__subhead">{t.candidates.unorderedLegend}</h3>
            <ul className="picking__candidates">
              {ranked.unordered.map((candidate) => (
                <li key={candidate.lot.lotId}>
                  <CandidateCard
                    candidate={candidate}
                    line={target.line}
                    today={today}
                    uoms={uoms.data}
                    recommended={false}
                    selected={candidate.lot.lotId === lotId}
                    onSelect={() => {
                      setLotId(candidate.lot.lotId);
                      setQty('');
                    }}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {selected === null ? null : (
        <section className="picking__section">
          <h2>{t.qty.label}</h2>
          {/* 권장은 순서 제안이지 위치가 아니다. 경고하되 막지 않고 사유도 묻지 않는다. */}
          {isRecommended(ranked, selected.lot.lotId) ? null : (
            <AlertBanner variant="warning" title={t.lot.notRecommended} />
          )}
          <TextField
            label={t.qty.label}
            inputMode="decimal"
            size="xl"
            fullWidth
            value={qty}
            onChange={(event) => {
              setQty(event.target.value);
            }}
            error={qtyMessage()}
          />
          <NumberPad
            value={qty}
            onChange={setQty}
            max={Math.min(selected.availableQty, remainingAllocated(target.line))}
            allowDecimal
          />
          {worker === null ? <p className="picking__note">{t.noWorker}</p> : null}
          {pick.error === null || pick.error === undefined ? null : isConflict(
            toApiError(pick.error),
          ) ? (
            <AlertBanner variant="error" title={t.conflict} />
          ) : (
            <AlertBanner variant="error" title={t.failed} />
          )}
          <Button
            className="picking__pick"
            variant="filled"
            size="2xl"
            loading={pick.isPending}
            disabled={!canPick(selected, target.line, qty, worker !== null, today)}
            onClick={() => void confirm()}
          >
            {t.submit}
          </Button>
        </section>
      )}
    </div>
  );
};
