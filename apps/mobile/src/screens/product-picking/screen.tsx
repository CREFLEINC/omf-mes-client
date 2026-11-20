import { useQueryClient } from '@tanstack/react-query';
import { AlertBanner, Chip, IconButton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useRef, useState } from 'react';

import { useBackStep } from '../../patterns/back-step';
import { Button } from '../../patterns/button';
import { Card } from '../../patterns/card';
import { ConfirmDialog } from '../../patterns/confirm-dialog';
import { playErrorTone } from '../../patterns/error-tone';
import { signal } from '../../patterns/scan-feedback';
import { ScanZone } from '../../patterns/scan-zone';
import { uomLabelOf, useCustomerNames, useItemLabels, useUomCodes } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { createIdempotencyKey } from '../../patterns/outbox';
import { toApiError } from '../../patterns/request';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { CodeSheet } from './code-sheet';
import { LineSheet } from './line-sheet';
import { LineTally } from './line-tally';
import type { CodeFieldState } from './lot-row';
import { PickResult, type PickNotice } from './pick-result';
import {
  activeLots,
  codeProblem,
  inTerminalScope,
  isNotRejected,
  terminalShareDone,
  warehouseTagOf,
  partiesText,
  pickRejectionOf,
  replaceEffect,
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

/** ✎ 로 연 출하 관리 코드 칸 — 시트 안 그 LOT 줄에 선다. */
interface CodeTarget {
  lotId: number;
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

export const ProductPickingScreen = () => {
  useScreenTitle(t.title);

  const online = useOnlineStatus();
  const { worker } = useWorkerSession();
  const today = useMemo(() => new Date(), []);
  const queries = useQueryClient();

  /* 어느 지시서인가만 들고 있는다. 화면이 보는 값은 늘 새 조회에서 나온다. */
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [notice, setNotice] = useState<PickNotice | null>(null);
  /* 라인 시트로 연 라인. */
  const [viewLineId, setViewLineId] = useState<number | null>(null);
  /* 결과가 바뀔 때마다 하나씩 — 표가 강조한 줄로 옮겨 간다. */
  const [noticeKey, setNoticeKey] = useState(0);
  const [replaceTarget, setReplaceTarget] = useState<{
    lot: ShipmentRequestLot;
    line: ShipmentRequestLine;
  } | null>(null);
  const [codeTarget, setCodeTarget] = useState<CodeTarget | null>(null);
  const [codeFailedLotId, setCodeFailedLotId] = useState<number | null>(null);
  /*
   * 두 창고에 걸쳐 줄 창고 몫만 집은 LOT 의 「다른 창고에 n 남음」(피처 012 Edge) — 피킹 응답에만 오므로 이 회차에 집은 것만
   * 기억해 라인 시트의 LOT 줄에도 적는다.
   */
  const [otherQtyByLot, setOtherQtyByLot] = useState<ReadonlyMap<number, number>>(new Map());
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

  const itemOf = (line: ShipmentRequestLine) => {
    const found = items.get(line.itemId);

    return {
      itemCode: found?.itemCode ?? line.itemCode,
      itemName: found?.itemName ?? line.itemName,
    };
  };

  /** 이 지시서에 이미 피킹한(교체로 빠지지 않은) LOT 이 들어 있는 라인. */
  const lineOfLot = (lotNo: string): ShipmentRequestLine | undefined =>
    lines.find((each) => activeLots(each).some((lot) => lot.lotNo === lotNo));

  const announce = (next: PickNotice) => {
    setNotice(next);
    setNoticeKey((key) => key + 1);
  };

  const duplicate = (lotNo: string, found: ShipmentRequestLine) => {
    signal('warn');
    announce({ kind: 'duplicate', lotNo, lineNo: found.lineNo });
  };

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

    /* 이미 피킹한 LOT 은 보내지 않고 몇 번 라인에 있는지 회색으로 알린다(사용자 지시 2026-11-20). */
    const already = lineOfLot(lotNo);

    if (already !== undefined) {
      duplicate(lotNo, already);
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
      signal('confirm');
      announce({ kind: 'picked', result });

      const other = result.otherWarehouseQty;

      if (other !== undefined && other > 0) {
        setOtherQtyByLot((current) =>
          new Map(current).set(result.pickedLot.shipmentRequestLotId, other),
        );
      }
    } catch (error: unknown) {
      const cause = error instanceof PickLineError ? error.cause : error;
      keys.settle(ring, cause);
      const rejection =
        error instanceof LocalPickRejection ? null : pickRejectionOf(toApiError(cause));
      /* 다른 기기가 먼저 집은 LOT — 새로 읽은 목록에 있으면 회색 「이미 피킹」으로. */
      const known =
        rejection?.kind === 'code' && rejection.code === 'LOT_ALREADY_PICKED'
          ? lineOfLot(lotNo)
          : undefined;

      if (known !== undefined) {
        duplicate(lotNo, known);
        return;
      }

      /* 화면을 보고 있지 않을 수 있다. 소리로도 알린다(공유계약 D-2). */
      playErrorTone();
      announce({
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

  /* 스캔은 늘 LOT 이다 — 시트가 열려 있으면 닫고 피킹한다. 출하 관리 코드는 ✎ 로 연 칸만 받는다(사용자 결정 2026-11-20). */
  const takeScan = (value: string) => {
    setViewLineId(null);
    setCodeTarget(null);
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
        announce({ kind: 'replaced', lotNo: lot.lotNo, result });
      })
      .catch((error: unknown) => {
        keys.settle(ring, error);
        playErrorTone();
        announce({
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
    setViewLineId(null);
  };

  /*
   * 뒤로가기는 화면 안 단계를 먼저 되돌린다. 라우터 이력에는 이 화면 하나뿐이라, 두지
   * 않으면 지시서를 열고 스캔하던 사람이 한 번에 작업 목록까지 나간다.
   */
  useBackStep(qrOpen, () => {
    setQrOpen(false);
  });
  useBackStep(!qrOpen && chosenId !== null, leave);
  useBackStep(!qrOpen && viewLineId !== null, () => {
    setViewLineId(null);
    setCodeTarget(null);
  });

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
          {/* 피처 012 — 이 기기 공장 창고 줄이 있는 지시서만 온다. 범위를 적어 「왜 안 보이지」를 막는다(시안 ⑨). */}
          {requests.isSuccess && requests.data.length === 0 ? (
            <AlertBanner variant="info" title={t.requests.none}>
              {t.requests.scopeHidden}
            </AlertBanner>
          ) : null}
          <ul className="picking__targets">
            {(requests.data ?? []).map((request) => {
              const lotCount = (request.lines ?? []).reduce(
                (sum, line) => sum + activeLots(line).length,
                0,
              );
              const { customer, shipTo } = namesOf(request);
              const allLines = request.lines ?? [];
              /* 카드에는 이 기기가 피킹할 줄만 「피킹 / 목표」로 세고, 범위 밖 줄은 한 줄로 접는다(FR-010 · 시안 ①). */
              const mine = allLines.filter(inTerminalScope);
              const otherPlant = allLines.filter(
                (line) => !inTerminalScope(line) && line.outOfScopeReason !== 'OTHER_WAREHOUSE',
              ).length;
              const otherWarehouse = allLines.filter(
                (line) => !inTerminalScope(line) && line.outOfScopeReason === 'OTHER_WAREHOUSE',
              ).length;

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
                      {mine.map((line) => (
                        <p key={line.shipmentRequestLineId}>
                          {t.requests.lineSummaryAt(
                            line.lineNo,
                            itemCodeOf(line.itemId),
                            warehouseTagOf(line, t.warehouse),
                            String(line.pickedQty),
                            String(line.allocatedQty),
                          )}
                        </p>
                      ))}
                      {otherPlant === 0 ? null : (
                        <p className="picking__note">{t.requests.otherPlantLines(otherPlant)}</p>
                      )}
                      {otherWarehouse === 0 ? null : (
                        <p className="picking__note">
                          {t.requests.otherWarehouseLines(otherWarehouse)}
                        </p>
                      )}
                      <Chip status={lotCount === 0 ? 'idle' : 'info'}>
                        {lotCount === 0 ? t.requests.notStarted : t.requests.pickingLots(lotCount)}
                      </Chip>
                    </Card.Body>
                  </Card>
                </li>
              );
            })}
          </ul>
          {requests.isSuccess && requests.data.length > 0 ? (
            <p className="picking__note">
              {t.requests.completedHidden}, {t.requests.scopeNote}
            </p>
          ) : null}
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

  const codeStateOf = (lot: ShipmentRequestLot): CodeFieldState => ({
    editing: codeTarget?.lotId === lot.shipmentRequestLotId,
    draft: codeTarget?.lotId === lot.shipmentRequestLotId ? codeTarget.draft : '',
    saving:
      saveCode.isPending &&
      saveCode.variables.lot.shipmentRequestLotId === lot.shipmentRequestLotId,
    failed: codeFailedLotId === lot.shipmentRequestLotId,
  });

  const viewedLine = lines.find((each) => each.shipmentRequestLineId === viewLineId) ?? null;
  const currentLineId = notice?.kind === 'picked' ? notice.result.line.shipmentRequestLineId : null;
  const duplicateLineId =
    notice?.kind === 'duplicate'
      ? (lines.find((each) => each.lineNo === notice.lineNo)?.shipmentRequestLineId ?? null)
      : null;
  const parties = customerName === null ? null : partiesText(customerName, shipToName);

  return (
    <div className="picking">
      {/* 지시서는 머리 한 줄 — 번호 · 고객 · 수주 · 출하 예정(사용자 지시 2026-11-20). */}
      <section className="picking__head" aria-label={target.shipmentRequestNo}>
        <div className="picking__head-text">
          <strong className="picking__head-no">{target.shipmentRequestNo}</strong>
          {/* 피처 012 — 지시서 사업부. 사업부 없는 공장의 옛 지시서는 「사업부 미지정」(빈 곳 ⑨). */}
          <Chip status={target.businessUnit === null ? 'warning' : 'idle'}>
            {target.businessUnit?.businessUnitName ?? t.request.noBusinessUnit}
          </Chip>
          <span className="picking__note">
            {[
              parties,
              target.salesOrderNo === null
                ? t.requests.noSalesOrder
                : t.requests.salesOrder(target.salesOrderNo),
              t.requests.shipDate(target.requestedShipDate),
            ]
              .filter((part): part is string => part !== null)
              .join(', ')}
          </span>
        </div>
        <Button
          variant="outlined"
          size="sm"
          onClick={() => {
            setQrOpen(true);
          }}
        >
          {t.request.showCode}
        </Button>
      </section>
      {requests.isError ? <AlertBanner variant="error" title={t.requests.loadFailed} /> : null}

      <ScanZone
        field={scanField}
        label={t.scan.label}
        prompt={t.scan.hint}
        standby
        /* 스캐너가 못 읽는 라벨이 있다. 손으로 넣는 길은 구역 아래 아이콘(공유계약 D-3). */
        tools={
          <IconButton
            icon={scanField.manual ? 'keyboard_return' : 'keyboard'}
            size="lg"
            aria-label={scanField.manual ? t.scan.manualSubmit : t.scan.manualLabel}
            onClick={scanField.manual ? scanField.submitManual : scanField.openManual}
          />
        }
      />

      <div role="status" className="picking__status">
        {pick.isPending ? <p>{t.scan.pending(pick.variables.lotNo)}</p> : null}
        {notice === null ? null : (
          <PickResult
            notice={notice}
            itemOf={(itemId) => items.get(itemId)}
            uomOf={uomOf}
            onRetry={(lotNo) => void pickScanned(lotNo)}
          />
        )}
      </div>

      {/* 이 기기 줄이 다 찼고 다른 공장 · 창고 줄이 남았다 — 완료는 사업부 안 아무 POP 에서 한 번(시안 ⑦ · US3). */}
      {terminalShareDone(lines) ? (
        <AlertBanner variant="info" title={t.warehouse.terminalDone}>
          {target.businessUnit === null || target.businessUnit === undefined
            ? t.warehouse.terminalDoneDetailNoUnit
            : t.warehouse.terminalDoneDetail(target.businessUnit.businessUnitName)}
        </AlertBanner>
      ) : null}

      <LineTally
        lines={lines}
        itemOf={itemOf}
        uomOf={uomOf}
        currentLineId={currentLineId}
        duplicateLineId={duplicateLineId}
        focusKey={notice === null ? null : noticeKey}
        onOpen={(lineId) => {
          setCodeTarget(null);
          setViewLineId(lineId);
        }}
      />

      <Button className="picking__pick" variant="text" size="lg" onClick={leave}>
        {t.request.change}
      </Button>

      {viewedLine === null || replaceTarget !== null ? null : (
        <LineSheet
          line={viewedLine}
          item={itemOf(viewedLine)}
          uomOf={uomOf}
          codeStateOf={codeStateOf}
          otherQtyOf={(lot) => otherQtyByLot.get(lot.shipmentRequestLotId)}
          onReplace={(lot) => {
            setReplaceTarget({ lot, line: viewedLine });
          }}
          onCodeEdit={(lot) => {
            setCodeFailedLotId(null);
            setCodeTarget({ lotId: lot.shipmentRequestLotId, draft: lot.managementCode ?? '' });
          }}
          onCodeDraft={(lot, value) => {
            setCodeTarget({ lotId: lot.shipmentRequestLotId, draft: value });
          }}
          onCodeCancel={() => {
            setCodeTarget(null);
          }}
          onCodeSave={(lot) => {
            void submitCode(lot, codeTarget?.draft ?? '');
          }}
          onDismiss={() => {
            setViewLineId(null);
            setCodeTarget(null);
          }}
        />
      )}

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
