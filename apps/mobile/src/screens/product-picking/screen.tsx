import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { AlertBanner, Button, Card, Chip, NumberPad, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useRef, useState } from 'react';

import { useBackStep } from '../../patterns/back-step';
import { useCodeValues } from '../../patterns/code-values';
import { playErrorTone } from '../../patterns/error-tone';
import { useScannedLot } from '../../patterns/lots';
import { useIdempotencyKey } from '../../patterns/idempotency';
import { useCustomerNames, useItem, useUomCodes } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { toApiError } from '../../patterns/request';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  toCandidates,
  useAvailableByLot,
  useHoldReason,
  useLotPool,
  usePickLine,
  useTodayRequests,
  type LotHold,
} from './queries';
import {
  CANDIDATE_PREVIEW,
  FEFO,
  FIFO,
  LOT_HOLD_REASON,
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

/** 보류 사유와 해제 조건. 서버가 여러 건을 낼 수 있어 그대로 늘어놓는다. */
const HoldReason = ({
  holds,
  reasonNames,
}: {
  holds: UseQueryResult<LotHold[]>;
  reasonNames: Map<string, string>;
}) => {
  if (holds.isPending) {
    return <p className="picking__note">{t.lot.heldReasonLoading}</p>;
  }

  if (holds.isError) {
    return <p className="picking__note">{t.lot.heldReasonFailed}</p>;
  }

  return (
    <>
      {(holds.data ?? []).map((hold) => (
        <p key={hold.lotHoldId}>
          {reasonNames.has(hold.reasonCode)
            ? t.lot.heldReason(reasonNames.get(hold.reasonCode) ?? '')
            : t.lot.heldReasonUnknown(hold.reasonCode)}
          {hold.releaseCondition === null || hold.releaseCondition === undefined
            ? ''
            : ` · ${t.lot.heldRelease(hold.releaseCondition)}`}
        </p>
      ))}
    </>
  );
};

const CandidateCard = ({
  candidate,
  line,
  today,
  uoms,
  recommended,
  holds,
  reasonNames,
}: {
  candidate: Candidate;
  line: ShipmentRequestLine;
  today: Date;
  uoms: Map<number, string> | undefined;
  recommended: boolean;
  holds: UseQueryResult<LotHold[]> | null;
  reasonNames: Map<string, string>;
}) => {
  const problem = lotProblem(candidate, line, today);
  const remaining = remainingDays(candidate.lot, today);
  const uom = uoms?.get(candidate.lot.uomId) ?? '';

  return (
    <Card bordered>
      <Card.Body className="card-body picking__candidate">
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
          <AlertBanner variant="error" title={t.lot[problem]}>
            {/*
             * 막는 것만으로는 무엇을 하면 풀리는지 알 수 없다. 사유는 고른 것 하나만 따로
             * 물어 오므로 그 답이 있을 때만 적는다.
             */}
            {problem === 'held' && holds !== null ? (
              <HoldReason holds={holds} reasonNames={reasonNames} />
            ) : null}
          </AlertBanner>
        )}

        {/* 셀 수 없는 것을 넉넉한 것으로 두지 않는다. 막지도 않는다 — 정본은 서버다. */}
        {problem === null && isShelfLifeUnknown(candidate, line, today) ? (
          <AlertBanner variant="warning" title={t.lot.shelfLifeUnknown} />
        ) : null}
      </Card.Body>
    </Card>
  );
};

export const ProductPickingScreen = () => {
  useScreenTitle(t.title);

  const online = useOnlineStatus();
  const { worker } = useWorkerSession();
  const today = useMemo(() => new Date(), []);

  /*
   * 어느 요청의 어느 라인인가만 들고 있는다. 대상 자체를 굳혀 두면 확정 뒤에도 옛 피킹량이
   * 남아 남은 배정이 줄지 않고, 배정보다 많이 집을 수 있다 - 되돌릴 수 없는 예약 소진이다.
   */
  const [chosen, setChosen] = useState<{ requestId: number; lineId: number } | null>(null);
  const [lotId, setLotId] = useState<number | null>(null);
  const [qty, setQty] = useState('');
  const [missed, setMissed] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [listView, setListView] = useState(false);
  /*
   * 보내는 동안 잠근다. 상태로 두면 React 가 두 이벤트 사이에 커밋하지 못한 경우를 막지 못한다 -
   * 셋이 잇달아 들어오면 셋 다 갱신 전의 값을 보고 통과한다. 즉시 바뀌는 자리에 둔다. 단추를
   * 흐리게 하는 것은 DS 단추의 loading 이 이미 한다.
   */
  const inFlight = useRef(false);

  const requests = useTodayRequests(today);
  /* 화면이 보는 값은 늘 새 조회에서 나온다. 상태에 굳은 사본을 두지 않는다. */
  const target: Target | null = (() => {
    if (chosen === null) {
      return null;
    }

    const request = requests.data?.find((each) => each.shipmentRequestId === chosen.requestId);
    const line = request?.lines?.find((each) => each.shipmentRequestLineId === chosen.lineId);

    return request === undefined || line === undefined ? null : { request, line };
  })();
  const itemId = target?.line.itemId ?? null;
  const item = useItem(itemId);
  const uoms = useUomCodes(true);
  const customers = useCustomerNames(target !== null);
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
      /* 화면을 보고 있지 않을 수 있다. 소리로도 알린다(공유계약 D-2). */
      playErrorTone();
      setMissed(code);
      return;
    }

    setMissed(null);
    setLotId(found.lot.lotId);
    setQty('');
  };

  const queries = useQueryClient();

  const retry = () => {
    void queries.refetchQueries({ predicate: (query) => query.state.status === 'error' });
  };

  /*
   * 뒤로가기는 화면 안 단계를 먼저 되돌린다. 라우터 이력에는 이 화면 하나뿐이라, 두지
   * 않으면 대상을 고르고 스캔하던 사람이 한 번에 작업 목록까지 나간다.
   */
  useBackStep(listView, () => {
    setListView(false);
  });
  useBackStep(!listView && chosen !== null, () => {
    setChosen(null);
    setLotId(null);
    setQty('');
    setMissed(null);
  });

  const scanField = useScanField({ onScan: takeScan });
  /*
   * 빗나간 값이 없는 번호인지 다른 품목의 LOT 인지 가른다. 후보는 이 품목으로 걸러 와,
   * 목록에 없다는 것만으로는 둘을 구별할 수 없다.
   */
  const missedLot = useScannedLot(missed);
  /*
   * 보류 사유는 고른 것 하나만 묻는다. 목록 전체에 물으면 후보 수만큼 호출이 나가고,
   * 스펙이 요구한 자리도 스캔한 한 건이다.
   */
  const heldPick = candidates.find((each) => each.lot.lotId === lotId)?.held === true;
  const holdReason = useHoldReason(heldPick ? lotId : null);
  /* 사유 코드를 그대로 보이면 무엇이 걸렸는지 알 수 없다. 표시명은 마스터가 갖는다. */
  const holdReasonCodes = useCodeValues(LOT_HOLD_REASON);
  const holdReasonNames = new Map(
    (holdReasonCodes.data ?? []).map((value) => [value.code, value.name]),
  );

  /*
   * 한 번의 확정에 키 하나. 무엇을 적는 중인지를 함께 넘겨 대상이 바뀌면 스스로 비워지게 한다.
   * 이 화면은 후보 LOT 을 바꿔 가며 고르는 것이 주된 조작이라, 요청·라인·후보·수량이 다 들어가야
   * 한다. 수량은 친 문자열이 아니라 실제로 보낼 값으로 짓는다.
   *
   * 조기 반환보다 위에 둔다. 아래에 두면 연결이 끊겼다 붙는 순간 훅 수가 달라져 화면이 통째로
   * 던진다.
   */
  const idempotency = useIdempotencyKey(
    [
      String(target?.request.shipmentRequestId),
      String(target?.line.shipmentRequestLineId),
      String(lotId),
      String(Number(qty.trim())),
    ].join(':'),
  );

  if (!online) {
    return (
      <div className="picking">
        <AlertBanner variant="warning" title={t.offline.title}>
          {t.offline.description}
        </AlertBanner>
        {/* 연결이 돌아온 것을 단말이 놓칠 수 있다. 사람이 다시 물을 길을 둔다. */}
        <Button className="picking__pick" variant="outlined" size="xl" onClick={retry}>
          {t.offline.retry}
        </Button>
      </div>
    );
  }

  const selected = candidates.find((each) => each.lot.lotId === lotId) ?? null;
  const problem =
    target === null || selected === null ? null : qtyProblem(selected, target.line, qty);

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
    setMissed(null);
    setDone(false);
    scanField.focus();
  };

  const confirm = async () => {
    if (target === null || selected === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;

    try {
      await pick
        .mutateAsync({
          shipmentRequestId: target.request.shipmentRequestId,
          line: target.line,
          candidate: selected,
          qty,
          workerNo: worker.workerNo,
          idempotencyKey: idempotency.current(),
        })
        .then(() => {
          idempotency.reset();
          setDone(true);
        })
        .catch(() => null);
    } finally {
      inFlight.current = false;
    }
  };

  if (done) {
    return (
      <div className="picking">
        <AlertBanner variant="success" title={t.done} />
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
          {/* 고르던 라인이 빠졌으면 말없이 나가지 않는다. 남겨 두면 나중에 예고 없이 되돌아간다. */}
          {chosen !== null ? <AlertBanner variant="warning" title={t.targets.dropped} /> : null}
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
                  <li
                    key={`${String(request.shipmentRequestId)}-${String(line.shipmentRequestLineId)}`}
                  >
                    <Card
                      bordered
                      interactive
                      onClick={() => {
                        setChosen({
                          requestId: request.shipmentRequestId,
                          lineId: line.shipmentRequestLineId,
                        });
                        setLotId(null);
                        setQty('');
                        setMissed(null);
                      }}
                    >
                      <Card.Body className="card-body picking__target">
                        <strong>{request.shipmentRequestNo}</strong>
                        <p>{t.targets.line(line.lineNo)}</p>
                        <p>
                          {t.targets.progress(String(line.allocatedQty), String(line.pickedQty))}
                        </p>
                        <p>
                          {left <= 0 ? t.targets.complete : t.targets.remaining(String(left), '')}
                        </p>
                      </Card.Body>
                    </Card>
                  </li>
                );
              }),
            )}
          </ul>
        </section>
      </div>
    );
  }

  /*
   * 피킹 화면에는 권장 순서 앞엣것만 세운다. 후보 카드가 130~210px 이라 그 위는 첫 화면에
   * 들어오지 않는다. 전부 보려면 목록 화면으로 넘어간다.
   */
  const shownCandidates = ranked.ordered.slice(0, CANDIDATE_PREVIEW);
  const allCandidates = ranked.ordered.length + ranked.unordered.length;

  const candidateItem = (candidate: Candidate, recommended: boolean) => (
    <li key={candidate.lot.lotId}>
      <CandidateCard
        candidate={candidate}
        line={target.line}
        today={today}
        uoms={uoms.data}
        recommended={recommended}
        holds={candidate.lot.lotId === lotId ? holdReason : null}
        reasonNames={holdReasonNames}
      />
    </li>
  );

  if (listView) {
    return (
      <div className="picking">
        <section className="picking__section">
          <h2>{t.candidates.listLegend}</h2>
          <p className="picking__note">
            {t.candidates.legend(policyLabel(item.data?.fifoPolicyCode ?? ''))}
          </p>

          <ul className="picking__candidates">
            {ranked.ordered.map((candidate) =>
              candidateItem(candidate, isRecommended(ranked, candidate.lot.lotId)),
            )}
          </ul>

          {ranked.unordered.length === 0 ? null : (
            <>
              <h3 className="picking__subhead">{t.candidates.unorderedLegend}</h3>
              <ul className="picking__candidates">
                {ranked.unordered.map((candidate) => candidateItem(candidate, false))}
              </ul>
            </>
          )}

          <div className="picking__action-bar">
            <Button
              className="picking__pick"
              variant="filled"
              size="xl"
              onClick={() => {
                setListView(false);
              }}
            >
              {t.candidates.back}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const scanMessage = (): string | undefined => {
    if (missed === null) {
      return undefined;
    }

    const other = missedLot.data ?? null;

    return other !== null && other.itemId !== target.line.itemId
      ? t.scan.otherItem(missed)
      : t.scan.notFound(missed);
  };

  const lineUom = uoms.data?.get(target.line.uomId) ?? '';
  /* 이름을 못 받았으면 식별자를 대신 보이지 않는다. 작업자가 대조할 수 없는 값이다. */
  const customerName = customers.data?.get(target.request.customerId) ?? null;

  return (
    <div className="picking">
      <section className="picking__section">
        <h2>{t.target.legend}</h2>
        <Card bordered>
          <Card.Body className="card-body picking__card">
            <strong>{target.request.shipmentRequestNo}</strong>
            {customerName === null ? null : <p>{t.target.customer(customerName)}</p>}
            <p>{t.target.shipDate(target.request.requestedShipDate)}</p>
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
            setChosen(null);
            setLotId(null);
            setQty('');
            setMissed(null);
          }}
        >
          {t.target.change}
        </Button>
        {/*
          이 화면이 보이는 남은 배정은 목록 조회에서 나온다. 그것이 늙은 채로 굳으면 확정 전
          값이 그대로 남아 배정을 다 채우고도 한 번 더 집게 된다 - 조용히 두지 않는다.
        */}
        {requests.isError ? <AlertBanner variant="error" title={t.targets.loadFailed} /> : null}
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
          {shownCandidates.map((candidate) =>
            candidateItem(candidate, isRecommended(ranked, candidate.lot.lotId)),
          )}
        </ul>

        {allCandidates <= shownCandidates.length ? null : (
          <Button
            className="picking__pick"
            variant="outlined"
            size="lg"
            onClick={() => {
              setListView(true);
            }}
          >
            {t.candidates.list(allCandidates)}
          </Button>
        )}
      </section>

      <section className="picking__section">
        <h2>{t.scan.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.scan.label}
          placeholder={t.scan.placeholder}
          size="xl"
          fullWidth
          error={scanMessage()}
        />
        {/*
         * 스캔 칸 하나로 받는다. 스캐너를 기다리는 동안에는 키보드를 열지 않고, 직접
         * 입력을 누르면 그 칸이 열린다. 치는 도중 스캔이 오면 스캔값이 이긴다.
         */}
        {scanField.manual ? (
          <Button
            className="picking__pick"
            variant="outlined"
            size="xl"
            onClick={scanField.submitManual}
          >
            {t.scan.manualSubmit}
          </Button>
        ) : (
          <Button className="picking__pick" variant="text" size="xl" onClick={scanField.openManual}>
            {t.scan.manualLabel}
          </Button>
        )}
        {selected === null ? null : <p>{t.scan.picked(selected.lot.lotNo)}</p>}
      </section>

      {/*
       * 집을 수 없는 LOT 에는 수량칸을 열지 않는다. 열어 두면 「집을 수 없습니다」 옆에
       * 「집을 수 있습니다」가 나란히 서고, 확정 단추만 잠긴 채 이유가 어긋난다.
       */}
      {selected === null || lotProblem(selected, target.line, today) !== null ? null : (
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
            /* 남은 배정이 음수로 오면 상한이 음수가 된다. 서버 값이 그럴 수 있다. */
            max={Math.max(0, Math.min(selected.availableQty, remainingAllocated(target.line)))}
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
