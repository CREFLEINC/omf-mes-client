import { useQueryClient } from '@tanstack/react-query';
import { AlertBanner, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useRef, useState } from 'react';

import { useBackStep } from '../../patterns/back-step';
import { Button } from '../../patterns/button';
import { Card } from '../../patterns/card';
import { ConfirmDialog } from '../../patterns/confirm-dialog';
import { playErrorTone } from '../../patterns/error-tone';
import { uomLabelOf, useCustomerNames, useItemLabels, useUomCodes } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { createIdempotencyKey } from '../../patterns/outbox';
import { toApiError } from '../../patterns/request';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { CodeSheet } from './code-sheet';
import { LotRow, ReplacedRow, type CodeFieldState, type CodeMode } from './lot-row';
import {
  activeLots,
  canReplace,
  codeProblem,
  isNotRejected,
  lineTiles,
  partiesText,
  pickRejectionOf,
  replaceEffect,
  replacedLots,
  type PickRejection,
  type ShipmentLotPickResult,
  type ShipmentLotReplaceResult,
  type ShipmentRequest,
  type ShipmentRequestLine,
  type ShipmentRequestLot,
} from './picking';
import {
  LocalPickRejection,
  PickLineError,
  usePickLot,
  useReplaceLot,
  useSaveManagementCode,
  useTodayRequests,
} from './queries';
import './screen.css';

const t = messages.productPicking;

/** 스캔 칸 아래 한 자리에 하나만 뜨는 결과. */
type Notice =
  | { kind: 'picked'; result: ShipmentLotPickResult }
  | {
      kind: 'rejected';
      lotNo: string;
      line: ShipmentRequestLine | null;
      rejection: PickRejection | { kind: 'notFound' | 'noLine' };
    }
  | { kind: 'replaced'; lotNo: string; result: ShipmentLotReplaceResult }
  | { kind: 'replaceRefused'; lotNo: string; notRejected: boolean };

interface CodeTarget {
  lotId: number;
  mode: CodeMode;
  draft: string;
}

/**
 * 같은 쓰기를 다시 보낼 때 같은 멱등 키를 쓴다. 응답이 온 뒤(성공이든 거절이든)에만 키를 버린다 —
 * 연결이 끊겨 답을 못 받은 경우만 같은 키로 다시 간다(두 번 기록되지 않는다).
 */
const useKeyRing = () => {
  const ring = useRef(new Map<string, string>());

  return {
    take: (target: string): string => {
      const found = ring.current.get(target);

      if (found !== undefined) {
        return found;
      }

      const key = createIdempotencyKey();
      ring.current.set(target, key);

      return key;
    },
    settle: (target: string, error?: unknown) => {
      if (error === undefined || toApiError(error).kind !== 'network') {
        ring.current.delete(target);
      }
    },
  };
};

const NoticeBanner = ({
  notice,
  uomOf,
  onRetry,
}: {
  notice: Notice;
  uomOf: (uomId: number) => string;
  /** 전송 실패 띠의 [다시 시도] — 그 LOT 을 같은 멱등 키로 다시 보낸다. */
  onRetry: (lotNo: string) => void;
}) => {
  if (notice.kind === 'picked') {
    const { pickedLot, line } = notice.result;
    const tiles = lineTiles(line);

    return (
      <AlertBanner
        variant="success"
        title={t.picked.title(pickedLot.lotNo, String(pickedLot.pickedQty), uomOf(pickedLot.uomId))}
      >
        {tiles.kind === 'remaining'
          ? t.picked.remaining(line.lineNo, String(tiles.value))
          : tiles.value > 0
            ? t.picked.reachedOver(line.lineNo, String(tiles.target), String(tiles.value))
            : t.picked.reached(line.lineNo, String(tiles.target))}
      </AlertBanner>
    );
  }

  if (notice.kind === 'replaced') {
    const { line, nonconformanceNo, replacedLot } = notice.result;
    const tiles = lineTiles(line);

    return (
      <AlertBanner variant="success" title={t.replace.done(notice.lotNo)}>
        {nonconformanceNo === null ? null : <p>{t.replace.nonconformance(nonconformanceNo)}</p>}
        {tiles.kind === 'remaining' ? (
          <p>{t.replace.receiveMore(line.lineNo, String(tiles.value), uomOf(replacedLot.uomId))}</p>
        ) : null}
      </AlertBanner>
    );
  }

  if (notice.kind === 'replaceRefused') {
    return notice.notRejected ? (
      <AlertBanner variant="error" title={t.replace.notRejected}>
        <p>{notice.lotNo}</p>
        <p>{t.replace.notRejectedDetail}</p>
      </AlertBanner>
    ) : (
      <AlertBanner variant="error" title={t.replace.failed}>
        <p>{notice.lotNo}</p>
      </AlertBanner>
    );
  }

  const { rejection } = notice;
  const title =
    rejection.kind === 'code'
      ? t.rejected[rejection.code]
      : rejection.kind === 'server'
        ? rejection.message
        : rejection.kind === 'failed'
          ? t.rejected.failed
          : rejection.kind === 'notFound'
            ? t.rejected.notFound
            : t.rejected.NO_LINE_FOR_ITEM;

  return (
    <AlertBanner variant="error" title={title} role="alert" aria-label={title}>
      <p>{notice.lotNo}</p>
      {rejection.kind === 'code' &&
      rejection.code === 'LOT_TARGET_REACHED' &&
      notice.line !== null ? (
        <p>
          {t.rejected.targetReachedDetail(
            notice.line.lineNo,
            String(notice.line.allocatedQty),
            String(notice.line.pickedQty),
          )}
        </p>
      ) : null}
      {rejection.kind === 'code' && rejection.code === 'LOT_ALREADY_RESERVED' ? (
        <p>{t.rejected.reservedDetail}</p>
      ) : null}
      {rejection.kind === 'notFound' ? <p>{t.rejected.notFoundDetail}</p> : null}
      {rejection.kind === 'failed' ? (
        <>
          <p>{t.rejected.failedDetail}</p>
          <Button variant="outlined" onClick={() => onRetry(notice.lotNo)}>
            {t.rejected.retry}
          </Button>
        </>
      ) : (
        <p>{t.rejected.notPicked}</p>
      )}
    </AlertBanner>
  );
};

/** 라인 머리의 목표 · 피킹 · 남음(또는 초과). */
const LineTiles = ({ line, label }: { line: ShipmentRequestLine; label: string }) => {
  const tiles = lineTiles(line);

  return (
    <div className="picking__tiles" role="group" aria-label={label}>
      <div className="picking__tile">
        <span>{t.line.target}</span>
        <strong>{String(tiles.target)}</strong>
      </div>
      <div className="picking__tile">
        <span>{t.line.picked}</span>
        <strong>{String(tiles.picked)}</strong>
      </div>
      <div className={`picking__tile picking__tile--${tiles.kind}`}>
        <span>{tiles.kind === 'remaining' ? t.line.remaining : t.line.over}</span>
        <strong>{String(tiles.value)}</strong>
      </div>
    </div>
  );
};

export const ProductPickingScreen = () => {
  useScreenTitle(t.title);

  const online = useOnlineStatus();
  const { worker } = useWorkerSession();
  const today = useMemo(() => new Date(), []);
  const queries = useQueryClient();

  /* 어느 지시서인가만 들고 있는다. 화면이 보는 값은 늘 새 조회에서 나온다. */
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [freshLotId, setFreshLotId] = useState<number | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<{
    lot: ShipmentRequestLot;
    line: ShipmentRequestLine;
  } | null>(null);
  const [codeTarget, setCodeTarget] = useState<CodeTarget | null>(null);
  const [codeFailedLotId, setCodeFailedLotId] = useState<number | null>(null);
  const [, setRetried] = useState(0);
  /* 보내는 동안 잠근다 — 스캐너가 같은 값을 잇달아 보내도 한 건만 나간다. */
  const inFlight = useRef(false);
  const keys = useKeyRing();

  const requests = useTodayRequests(today);
  const pick = usePickLot();
  const replace = useReplaceLot();
  const saveCode = useSaveManagementCode();

  const target: ShipmentRequest | null =
    chosenId === null
      ? null
      : (requests.data?.find((each) => each.shipmentRequestId === chosenId) ?? null);
  const lines = target?.lines ?? [];
  const itemIds = (chosenId === null ? (requests.data ?? []) : target === null ? [] : [target])
    .flatMap((request) => request.lines ?? [])
    .map((line) => line.itemId);
  const items = useItemLabels(itemIds);
  const uoms = useUomCodes(true);
  const uomOf = (uomId: number) => uomLabelOf(uoms.data, uomId);
  const customers = useCustomerNames(true);
  const itemCodeOf = (itemId: number) => items.get(itemId)?.itemCode ?? `#${String(itemId)}`;

  const allLots = lines.flatMap((line) => line.lots);
  const codeLot =
    codeTarget === null
      ? null
      : (allLots.find((lot) => lot.shipmentRequestLotId === codeTarget.lotId) ?? null);

  const submitCode = async (lot: ShipmentRequestLot, value: string) => {
    if (worker === null || codeProblem(value) !== null) {
      return;
    }

    const ring = `code:${String(lot.shipmentRequestLotId)}:${value.trim()}`;
    setCodeFailedLotId(null);

    await saveCode
      .mutateAsync({
        lot,
        managementCode: value,
        workerNo: worker.workerNo,
        idempotencyKey: keys.take(ring),
      })
      .then(() => {
        keys.settle(ring);
        setCodeTarget(null);
      })
      .catch((error: unknown) => {
        keys.settle(ring, error);
        setCodeFailedLotId(lot.shipmentRequestLotId);
      });
  };

  const pickScanned = async (lotNo: string) => {
    if (target === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    const ring = `pick:${String(target.shipmentRequestId)}:${lotNo}`;

    try {
      const result = await pick.mutateAsync({
        request: target,
        lotNo,
        workerNo: worker.workerNo,
        idempotencyKey: keys.take(ring),
      });

      keys.settle(ring);
      setFreshLotId(result.pickedLot.shipmentRequestLotId);
      setNotice({ kind: 'picked', result });
    } catch (error: unknown) {
      const cause = error instanceof PickLineError ? error.cause : error;
      keys.settle(ring, cause);
      /* 화면을 보고 있지 않을 수 있다. 소리로도 알린다(공유계약 D-2). */
      playErrorTone();
      setNotice({
        kind: 'rejected',
        lotNo,
        line: error instanceof PickLineError ? error.line : null,
        rejection:
          error instanceof LocalPickRejection
            ? { kind: error.reason }
            : pickRejectionOf(toApiError(cause)),
      });
    } finally {
      inFlight.current = false;
    }
  };

  const takeScan = (value: string) => {
    /* 코드 칸이 스캔을 받는 중이면 그 LOT 코드로 바로 저장한다 — LOT 피킹은 쉰다. */
    if (codeTarget?.mode === 'scan' && codeLot !== null) {
      void submitCode(codeLot, value);
      return;
    }

    void pickScanned(value);
  };

  const scanField = useScanField({ onScan: takeScan });

  const confirmReplace = async () => {
    if (replaceTarget === null || target === null || worker === null) {
      return;
    }

    const { lot } = replaceTarget;
    const ring = `replace:${String(lot.shipmentRequestLotId)}`;
    setReplaceTarget(null);

    await replace
      .mutateAsync({
        shipmentRequestId: target.shipmentRequestId,
        lot,
        workerNo: worker.workerNo,
        idempotencyKey: keys.take(ring),
      })
      .then((result) => {
        keys.settle(ring);
        setNotice({ kind: 'replaced', lotNo: lot.lotNo, result });
      })
      .catch((error: unknown) => {
        keys.settle(ring, error);
        playErrorTone();
        setNotice({
          kind: 'replaceRefused',
          lotNo: lot.lotNo,
          notRejected: isNotRejected(toApiError(error)),
        });
      });
  };

  const leave = () => {
    setChosenId(null);
    setNotice(null);
    setCodeTarget(null);
    setFreshLotId(null);
  };

  /*
   * 뒤로가기는 화면 안 단계를 먼저 되돌린다. 라우터 이력에는 이 화면 하나뿐이라, 두지
   * 않으면 지시서를 열고 스캔하던 사람이 한 번에 작업 목록까지 나간다.
   */
  useBackStep(qrOpen, () => {
    setQrOpen(false);
  });
  useBackStep(!qrOpen && chosenId !== null, leave);

  const retry = () => {
    setRetried((count) => count + 1);
    void queries.refetchQueries({ predicate: (query) => query.state.status === 'error' });
  };

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

  const customerOf = (partnerId: number) => customers.data?.get(partnerId) ?? null;
  /* 단말은 거래처 마스터를 못 읽는다 — 지시서 응답의 이름을 먼저 쓰고, 없을 때만 조회값을 쓴다. */
  const namesOf = (request: ShipmentRequest) => ({
    customer: request.customer?.partnerName ?? customerOf(request.customerId),
    shipTo: request.shipTo?.partnerName ?? customerOf(request.shipToPartnerId),
  });

  if (target === null) {
    return (
      <div className="picking">
        <section className="picking__section">
          <h2>{t.requests.legend}</h2>
          {chosenId !== null && requests.isSuccess ? (
            <AlertBanner variant="warning" title={t.requests.dropped} />
          ) : null}
          {requests.isPending ? <p role="status">{t.requests.loading}</p> : null}
          {requests.isError ? <AlertBanner variant="error" title={t.requests.loadFailed} /> : null}
          {requests.isSuccess && requests.data.length === 0 ? (
            <AlertBanner variant="info" title={t.requests.none}>
              {t.requests.completedHidden}
            </AlertBanner>
          ) : null}
          <ul className="picking__targets">
            {(requests.data ?? []).map((request) => {
              const lotCount = (request.lines ?? []).reduce(
                (sum, line) => sum + activeLots(line).length,
                0,
              );
              const { customer, shipTo } = namesOf(request);

              return (
                <li key={request.shipmentRequestId}>
                  <Card
                    bordered
                    interactive
                    onClick={() => {
                      setChosenId(request.shipmentRequestId);
                      setNotice(null);
                      setCodeTarget(null);
                    }}
                  >
                    <Card.Body className="card-body picking__target">
                      <strong>{request.shipmentRequestNo}</strong>
                      {customer === null ? null : <p>{partiesText(customer, shipTo)}</p>}
                      <p className="picking__note">
                        {`${
                          request.salesOrderNo === null
                            ? t.requests.noSalesOrder
                            : t.requests.salesOrder(request.salesOrderNo)
                        }, ${t.requests.shipDate(request.requestedShipDate)}`}
                      </p>
                      {(request.lines ?? []).map((line) => (
                        <p key={line.shipmentRequestLineId}>
                          {t.requests.lineSummary(
                            line.lineNo,
                            itemCodeOf(line.itemId),
                            String(line.pickedQty),
                            String(line.allocatedQty),
                          )}
                        </p>
                      ))}
                      <Chip status={lotCount === 0 ? 'idle' : 'info'}>
                        {lotCount === 0 ? t.requests.notStarted : t.requests.pickingLots(lotCount)}
                      </Chip>
                    </Card.Body>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    );
  }

  const { customer: customerName, shipTo: shipToName } = namesOf(target);

  if (qrOpen) {
    return (
      <CodeSheet
        request={target}
        customerName={customerName === null ? null : partiesText(customerName, shipToName)}
        onClose={() => {
          setQrOpen(false);
        }}
      />
    );
  }

  const rejectedLot = lines
    .flatMap((line) => activeLots(line).map((lot) => ({ line, lot })))
    .find(({ lot }) => canReplace(lot));

  const codeStateOf = (lot: ShipmentRequestLot): CodeFieldState => ({
    mode: codeTarget?.lotId === lot.shipmentRequestLotId ? codeTarget.mode : null,
    draft: codeTarget?.lotId === lot.shipmentRequestLotId ? codeTarget.draft : '',
    saving:
      saveCode.isPending &&
      saveCode.variables.lot.shipmentRequestLotId === lot.shipmentRequestLotId,
    failed: codeFailedLotId === lot.shipmentRequestLotId,
  });

  return (
    <div className="picking">
      <section className="picking__section">
        <Card bordered>
          <Card.Body className="card-body picking__card">
            <strong>{target.shipmentRequestNo}</strong>
            <dl className="picking__facts">
              {customerName === null ? null : (
                <>
                  <dt>{t.request.customer}</dt>
                  <dd>{customerName}</dd>
                </>
              )}
              {shipToName === null ? null : (
                <>
                  <dt>{t.request.shipTo}</dt>
                  <dd>{shipToName}</dd>
                </>
              )}
              <dt>{t.request.salesOrder}</dt>
              <dd>{target.salesOrderNo ?? t.requests.noSalesOrder}</dd>
              <dt>{t.request.shipDate}</dt>
              <dd>{target.requestedShipDate}</dd>
            </dl>
            <Button
              className="picking__pick"
              variant="outlined"
              size="lg"
              onClick={() => {
                setQrOpen(true);
              }}
            >
              {t.request.showCode}
            </Button>
          </Card.Body>
        </Card>
        {requests.isError ? <AlertBanner variant="error" title={t.requests.loadFailed} /> : null}
      </section>

      <section className="picking__section">
        <TextField
          ref={scanField.ref}
          label={t.scan.label}
          placeholder={t.scan.placeholder}
          helperText={codeTarget?.mode === 'scan' ? t.scan.paused : t.scan.hint}
          size="xl"
          fullWidth
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
        {pick.isPending ? <p role="status">{t.scan.pending(pick.variables.lotNo)}</p> : null}
        {notice === null ? null : (
          <NoticeBanner
            notice={notice}
            uomOf={uomOf}
            onRetry={(lotNo) => void pickScanned(lotNo)}
          />
        )}
        {rejectedLot === undefined || notice?.kind === 'replaced' ? null : (
          <AlertBanner variant="error" title={t.replace.rejectedNotice}>
            {t.line.title(rejectedLot.line.lineNo, itemCodeOf(rejectedLot.line.itemId))},{' '}
            {rejectedLot.lot.lotNo}
          </AlertBanner>
        )}
      </section>

      {lines.map((line) => {
        const label = t.line.title(line.lineNo, itemCodeOf(line.itemId));
        const item = items.get(line.itemId);
        const live = activeLots(line);
        const gone = replacedLots(line);
        const reached = lineTiles(line).kind === 'over';

        return (
          <section key={line.shipmentRequestLineId} className="picking__section picking__line">
            <div className="picking__line-head">
              <h2>{label}</h2>
              <Chip status={line.shippingInspectionRequired ? 'info' : 'idle'}>
                {line.shippingInspectionRequired ? t.line.inspection : t.line.noInspection}
              </Chip>
              {reached ? <Chip status="success">{t.line.reached}</Chip> : null}
            </div>
            {item === undefined ? null : (
              <p className="picking__note">
                {item.itemName}, {uomOf(line.uomId)}
              </p>
            )}
            {line.customerLotRequirement === null ||
            line.customerLotRequirement === undefined ||
            line.customerLotRequirement.trim() === '' ? null : (
              <AlertBanner variant="info" title={t.line.customerRequirement}>
                {line.customerLotRequirement}
              </AlertBanner>
            )}
            {line.minimumRemainingShelfLifeDays === null ||
            line.minimumRemainingShelfLifeDays === undefined ? null : (
              <p className="picking__note">
                {t.line.minimumShelfLife(line.minimumRemainingShelfLifeDays)}
              </p>
            )}
            <LineTiles line={line} label={label} />

            {live.length === 0 && gone.length === 0 ? (
              <p className="picking__note">{t.line.noLots}</p>
            ) : (
              <ul className="picking__lots">
                {live.map((lot) => (
                  <LotRow
                    key={lot.shipmentRequestLotId}
                    lot={lot}
                    uom={uomOf(lot.uomId)}
                    fresh={lot.shipmentRequestLotId === freshLotId}
                    code={codeStateOf(lot)}
                    onReplace={() => {
                      setReplaceTarget({ lot, line });
                    }}
                    onCodeScan={() => {
                      setCodeFailedLotId(null);
                      setCodeTarget({ lotId: lot.shipmentRequestLotId, mode: 'scan', draft: '' });
                      scanField.focus();
                    }}
                    onCodeType={() => {
                      setCodeFailedLotId(null);
                      setCodeTarget({
                        lotId: lot.shipmentRequestLotId,
                        mode: 'type',
                        draft: lot.managementCode ?? '',
                      });
                    }}
                    onCodeDraft={(value) => {
                      setCodeTarget({
                        lotId: lot.shipmentRequestLotId,
                        mode: 'type',
                        draft: value,
                      });
                    }}
                    onCodeCancel={() => {
                      setCodeTarget(null);
                      scanField.focus();
                    }}
                    onCodeSave={() => {
                      void submitCode(lot, codeTarget?.draft ?? '');
                    }}
                  />
                ))}
                {gone.map((lot) => (
                  <ReplacedRow key={lot.shipmentRequestLotId} lot={lot} uom={uomOf(lot.uomId)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <Button className="picking__pick" variant="text" size="lg" onClick={leave}>
        {t.request.change}
      </Button>

      {replaceTarget === null ? null : (
        <ConfirmDialog
          open
          title={t.replace.confirmTitle(replaceTarget.lot.lotNo)}
          cancelLabel={t.replace.cancel}
          proceedLabel={t.replace.proceed}
          onCancel={() => {
            setReplaceTarget(null);
          }}
          onProceed={() => void confirmReplace()}
        >
          {(() => {
            const effect = replaceEffect(replaceTarget.line, replaceTarget.lot);
            const uom = uomOf(replaceTarget.lot.uomId);

            return (
              <ul className="picking__effects">
                <li>
                  {t.replace.effectPicked(
                    String(replaceTarget.lot.pickedQty),
                    uom,
                    replaceTarget.line.lineNo,
                    String(effect.before),
                    String(effect.after),
                  )}
                </li>
                <li>{t.replace.effectDefect}</li>
                {effect.receive > 0 ? (
                  <li>
                    {t.replace.effectReceive(
                      replaceTarget.line.lineNo,
                      String(effect.receive),
                      uom,
                    )}
                  </li>
                ) : null}
                <li>{t.replace.irreversible}</li>
              </ul>
            );
          })()}
        </ConfirmDialog>
      )}
    </div>
  );
};
