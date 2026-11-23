import { AlertBanner, Icon, IconButton, Radio, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { FitName } from '../../patterns/fit-name';
import { playErrorTone } from '../../patterns/error-tone';
import { signal } from '../../patterns/scan-feedback';
import { ScanZone } from '../../patterns/scan-zone';
import { Link } from 'react-router';

import { Button } from '../../patterns/button';
import { Card } from '../../patterns/card';
import { useLocationByCode } from '../../patterns/locations';
import { lifecycleNoticeOf, useScannedLot } from '../../patterns/lots';
import { uomLabelOf, useItemLabels, useUomCodes } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { useBackStep } from '../../patterns/back-step';
import { DockedNumberPad } from '../../patterns/docked-number-pad';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import { ArriveLots } from './arrive-lots';
import { useLotBalances, useLotsById, useUnfinishedTransfers, useWarehouses } from './queries';
import { TransferSheet } from './transfer-sheet';
import { qtyFieldId, TransferTally } from './transfer-tally';
import {
  DEFECT_RETURN,
  NORMAL,
  SHIP_LABEL,
  canArrive,
  canShip,
  heldLines,
  isSameWarehouse,
  mixedSourceWarehouses,
  qtyProblemOf,
  queuedShipsFor,
  sourceEndOf,
  sourcePickOf,
  toArriveDraft,
  toShipDraft,
  type DraftLine,
  type StockTransfer,
  type StockTransferLine,
  type TransferType,
} from './transfer';
import '../../patterns/scan-result.css';
import './screen.css';

const t = messages.stockTransfer;

type Outcome = 'held' | 'sent' | 'rejected';

const TYPES: { value: TransferType; label: string }[] = [
  { value: NORMAL, label: t.type.normal },
  { value: DEFECT_RETURN, label: t.type.defect },
];

export const StockTransferScreen = () => {
  useScreenTitle(t.title);
  const failureText = useLoadFailure();

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();
  const online = useOnlineStatus();

  const [type, setType] = useState<TransferType>(NORMAL);
  const [toWarehouseId, setToWarehouseId] = useState<number | null>(null);
  const [scannedLocation, setScannedLocation] = useState<string | null>(null);
  const [scannedLot, setScannedLot] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  /** 이미 담은 LOT 을 또 찍었을 때 그 LOT — 결과 칸 회색 · 표의 그 줄 회색(사용자 지시 2026-11-20). */
  const [duplicateLotId, setDuplicateLotId] = useState<number | null>(null);
  /** 방금 담은 LOT — 결과 칸 초록 · 표의 그 줄 초록. */
  const [addedLotId, setAddedLotId] = useState<number | null>(null);
  /** 결과가 바뀔 때마다 하나씩 — 표가 강조한 줄로 옮겨 간다. */
  const [scanKey, setScanKey] = useState(0);
  /** 시트로 연 LOT. */
  const [viewLotId, setViewLotId] = useState<number | null>(null);
  const [noStock, setNoStock] = useState(false);
  const [unknownBusinessUnit, setUnknownBusinessUnit] = useState(false);
  /** 스캔한 LOT 이 대기 · 폐기면 그 안내(US1-6). 재고 없음보다 먼저 말한다 — 까닭이 다르다. */
  const [lifecycleNotice, setLifecycleNotice] = useState<string | null>(null);
  /** 반출이 선 뒤의 이동. 이것이 있으면 화면은 도착만 남았다. */
  const [shipped, setShipped] = useState<{
    transfer: StockTransfer;
    lines: StockTransferLine[];
  } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /** 방금 반출이 서버에 닿았다 — 다음 스캔·[이어서 하기]까지 초록 띠로 알린다(omf-all-around#345). */
  const [shipNotice, setShipNotice] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  /* 단말 키보드는 키가 촘촘하고 올라오면 라인 목록과 기록 단추를 덮는다. */
  const [keypadFor, setKeypadFor] = useState<number | null>(null);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 같은 물건이 두 번 반출된다.
   */
  const inFlight = useRef(false);
  /* 효과 안에서 지금 담긴 줄을 본다 — 상태 갱신 함수 안에서 소리를 내면 두 번 울릴 수 있다. */
  const linesRef = useRef<DraftLine[]>([]);
  linesRef.current = lines;

  const warehouses = useWarehouses();
  const unfinished = useUnfinishedTransfers();
  const destination = useLocationByCode(toWarehouseId, scannedLocation);
  const foundLot = useScannedLot(scannedLot);
  const balances = useLotBalances(foundLot.data?.lotId ?? null);
  const itemLabels = useItemLabels(lines.map((line) => line.itemId));
  /* 도착(이어서 하기) — 옮기는 줄의 품목 · LOT 번호. 줄에는 대리키만 있다. */
  const arriveItems = useItemLabels(shipped?.lines.map((line) => line.itemId) ?? []);
  const arriveLots = useLotsById(shipped?.lines.map((line) => line.lotId) ?? []);

  const toWarehouse = (warehouses.data ?? []).find((each) => each.warehouseId === toWarehouseId);
  const toLocation = destination.data ?? null;
  const held = heldLines(lines);

  /*
   * 큐에 담긴 것은 서버 응답에 없다. 읽기 전에는 담긴 것이 없는 것과 구별되지 않아 그 사이에
   * 다시 반출하게 되므로, 읽기 전에는 담긴 것으로 세어 막아 둔다.
   */
  const queuedShips = loaded
    ? queuedShipsFor(
        pendingOf(SHIP_LABEL),
        lines.map((line) => line.lotId),
      )
    : 1;

  const source = sourceEndOf(lines);
  const sameWarehouse =
    source !== null && toWarehouseId !== null && isSameWarehouse(source.warehouseId, toWarehouseId);
  const mixed = mixedSourceWarehouses(lines);

  const shipReady =
    canShip(lines, worker !== null, queuedShips) && toLocation !== null && !sameWarehouse;
  const arriveReady = canArrive(
    shipped?.transfer ?? null,
    toLocation?.locationId ?? null,
    worker !== null,
  );

  /*
   * 스캔한 LOT 을 목록에 얹는다. 재고가 온 뒤에 일어나야 해서 렌더 중에 하지 않는다.
   *
   * 같은 LOT 을 두 번 세면 같은 물건을 두 번 옮기는 것이 된다.
   */
  useEffect(() => {
    const lot = foundLot.data;
    const rows = balances.data;

    if (lot === undefined || lot === null || rows === undefined) {
      return;
    }

    setScannedLot(null);
    setScanKey((key) => key + 1);
    setAddedLotId(null);
    setDuplicateLotId(null);

    const notice = lifecycleNoticeOf(lot);

    setLifecycleNotice(notice);

    if (notice !== null) {
      setNoStock(false);
      setUnknownBusinessUnit(false);
      playErrorTone();
      return;
    }

    const pick = sourcePickOf(rows, warehouses.data ?? []);

    if (pick.kind !== 'row') {
      setNoStock(pick.kind === 'noStock');
      setUnknownBusinessUnit(pick.kind === 'unknownBusinessUnit');
      playErrorTone();
      return;
    }

    const at = pick.row;
    const { locationId: fromLocationId, warehouseId, businessUnitId } = pick;

    setNoStock(false);
    setUnknownBusinessUnit(false);

    /* 같은 LOT 을 두 번 세면 같은 물건을 두 번 옮기는 것이 된다 — 담지 않고 몇 번 줄인지 회색으로. */
    if (linesRef.current.some((each) => each.lotId === lot.lotId)) {
      setDuplicateLotId(lot.lotId);
      signal('warn');
      return;
    }

    setAddedLotId(lot.lotId);
    signal('confirm');
    setLines((current) =>
      current.some((each) => each.lotId === lot.lotId)
        ? current
        : [
            ...current,
            {
              lotId: lot.lotId,
              lotNo: lot.lotNo,
              itemId: lot.itemId,
              uomId: at.uomId,
              fromLocationId,
              warehouseId,
              businessUnitId,
              onHandQty: at.onHandQty,
              held: lot.held === true,
              /* 재고 전량으로 채워 둔다 — 덜 옮길 때만 고친다(사용자 결정 2026-11-20). */
              qty: String(at.onHandQty),
            },
          ],
    );
  }, [foundLot.data, balances.data, warehouses.data]);

  /* 찾지 못한 번호 — 담지 않음 빨강과 거부음. */
  const notFound = scannedLot !== null && foundLot.data === null;

  useEffect(() => {
    if (notFound) {
      setScanKey((key) => key + 1);
      playErrorTone();
    }
  }, [notFound]);

  const lotField = useScanField({
    onScan: (value) => {
      setViewLotId(null);
      setAddedLotId(null);
      setDuplicateLotId(null);
      setNoStock(false);
      setUnknownBusinessUnit(false);
      setLifecycleNotice(null);
      setShipNotice(false);
      setScannedLot(value.trim());
    },
  });

  const locationField = useScanField({
    onScan: (value) => {
      setScannedLocation(value.trim());
    },
  });

  const nameOf = (line: DraftLine): string =>
    t.from.name(itemLabels.get(line.itemId)?.itemCode ?? '', line.lotNo);

  /*
   * 뒤로가기는 화면 안 단계를 먼저 되돌린다. 라우터 이력에는 이 화면 하나뿐이라, 두지 않으면
   * 이어서 하던 이동을 놓치고 작업 목록까지 나간다.
   *
   * 안쪽부터 되돌리도록 조건을 서로 배타로 둔다.
   */
  useBackStep(shipped !== null, () => {
    restart();
  });
  useBackStep(shipped === null && lines.length > 0, () => {
    setLines([]);
    setScannedLot(null);
    setAddedLotId(null);
    setDuplicateLotId(null);
    setNoStock(false);
  });
  useBackStep(viewLotId !== null, () => {
    setViewLotId(null);
  });

  /*
   * 한 창고에 개수로 세는 품목과 무게로 세는 품목이 섞여 있다. 단위가 빠지면 370 이 삼백일흔
   * 개인지 삼백일흔 킬로그램인지 가릴 수 없고, 그 판단이 그대로 재고 이동으로 나간다.
   */
  const uoms = useUomCodes(true);
  const uomOf = (uomId: number | null | undefined) => uomLabelOf(uoms.data, uomId);

  /*
   * 숫자판이 지금 적고 있는 줄. 목록 밖에 서므로 자리를 번호가 아니라 줄 자체로 든다 - 줄을
   * 빼면 숫자판도 함께 닫힌다.
   */
  const keypadAt = lines.findIndex((line) => line.lotId === keypadFor);
  const keypad = keypadAt === -1 ? null : { at: keypadAt, line: lines[keypadAt] as DraftLine };

  /*
   * 다음에 할 일 하나. 차례는 계약이 정한다 - 반출 스캔이 곧 이동 문서를 만드는 행위라 그
   * 본문에 도착 위치가 필수다. 그래서 적을 것이 먼저고 보낼 곳이 그다음이다.
   */
  /* 사번이 없다는 말은 앱바 아래 알림이 한다(사용자 지시 2026-10-21) - 여기서 되풀이하지 않는다. */
  const nextStep =
    worker === null
      ? null
      : lines.length === 0
        ? t.noLine
        : toLocation === null
          ? t.noDestination
          : null;

  const restart = () => {
    setLines([]);
    setScannedLot(null);
    setScannedLocation(null);
    setShipped(null);
    setOutcome(null);
    setSaveFailed(false);
    setAddedLotId(null);
    setDuplicateLotId(null);
    setViewLotId(null);
    setNoStock(false);
    setUnknownBusinessUnit(false);
    setLifecycleNotice(null);
    void unfinished.refetch();
  };

  const send = async (draft: ReturnType<typeof toShipDraft>): Promise<Outcome | null> => {
    /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 옮긴 줄 안다. */
    try {
      await enqueue(draft);
    } catch {
      setSaveFailed(true);
      return null;
    }

    const result = await flush().catch(() => null);
    const mine = (each: { idempotencyKey: string }) => each.idempotencyKey === draft.idempotencyKey;

    /*
     * 자기가 부른 보내기의 결과만 보면 셸이 도는 다른 회차에서 되돌려진 건을 놓친다 - 화면은
     * 빈 결과를 받아 담아 두었다고 잘못 말한다.
     */
    if (
      (result !== null && result.rejected.some((each) => mine(each.entry))) ||
      isRejected(draft.idempotencyKey)
    ) {
      return 'rejected';
    }

    return result === null || result.remaining.some(mine) ? 'held' : 'sent';
  };

  const ship = async () => {
    if (worker === null || toWarehouse === undefined || toLocation === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);
    setShipNotice(false);

    try {
      if (source === null) {
        return;
      }

      const draft = toShipDraft(
        type,
        source,
        { warehouseId: toWarehouse.warehouseId, businessUnitId: toWarehouse.businessUnitId },
        toLocation.locationId,
        lines,
        new Date(),
        worker.workerNo,
      );

      const result = await send(draft);

      if (result === null) {
        return;
      }

      if (result !== 'sent') {
        setOutcome(result);
        return;
      }

      /*
       * 반출이 서버에 닿아야 도착이 그 이동을 가리킬 수 있다. 닿지 않은 채로 도착을 담으면
       * 없는 이동을 가리켜 되돌아온다.
       */
      void unfinished.refetch();
      setOutcome(null);
      setLines([]);
      setShipNotice(true);
    } finally {
      inFlight.current = false;
    }
  };

  const arrive = async () => {
    if (worker === null || shipped === null || toLocation === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const draft = toArriveDraft(
        shipped.transfer,
        shipped.lines,
        toLocation.locationId,
        new Date(),
        worker.workerNo,
      );

      const result = await send(draft);

      if (result !== null) {
        setOutcome(result);
      }
    } finally {
      inFlight.current = false;
    }
  };

  if (outcome !== null) {
    return (
      <div className="stock-transfer">
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
        <Button variant="filled" size="2xl" className="stock-transfer__wide" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  const itemOf = (line: DraftLine) => ({
    itemCode: itemLabels.get(line.itemId)?.itemCode ?? '',
    itemName: itemLabels.get(line.itemId)?.itemName ?? '',
  });
  const setQty = (lotId: number, value: string) => {
    setLines((current) =>
      current.map((each) => (each.lotId === lotId ? { ...each, qty: value } : each)),
    );
  };
  const warehouseNameOf = (warehouseId: number) =>
    (warehouses.data ?? []).find((each) => each.warehouseId === warehouseId)?.warehouseName ?? null;
  const viewed = lines.find((line) => line.lotId === viewLotId) ?? null;
  const added = lines.find((line) => line.lotId === addedLotId) ?? null;
  const duplicateAt = lines.findIndex((line) => line.lotId === duplicateLotId);
  /* 보낼 곳을 정하면 맨 위 한 줄로 접는다 — [바꾸기]는 위치를 비워 다시 펼친다(사용자 지시 2026-11-20). */
  const destinationSet = shipped === null && toLocation !== null && toWarehouse !== undefined;
  /* 바닥 합계 — 단위가 하나일 때만 수량을 더한다(개수와 무게를 더하지 않는다). */
  const units = new Set(lines.map((line) => line.uomId));
  const total = lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
  const totalText =
    units.size === 1 ? `${total.toLocaleString('ko-KR')} ${uomOf(lines[0]?.uomId)}` : null;

  /* 방금 찍은 결과 칸 — 담음 초록 · 이미 담음 회색 · 담지 않음 빨강(사용자 지시 2026-11-20). */
  const rejectOf = (): { title: string; body: string | null } | null => {
    if (foundLot.isError) {
      return {
        title: failureText(foundLot.error, t.from.loadFailed) ?? t.from.loadFailed,
        body: null,
      };
    }
    if (notFound && scannedLot !== null) {
      return { title: t.from.notFound(scannedLot), body: null };
    }
    if (lifecycleNotice !== null) {
      return { title: lifecycleNotice, body: null };
    }
    if (noStock) {
      return { title: t.from.noStock, body: null };
    }
    if (unknownBusinessUnit) {
      return { title: t.from.unknownBusinessUnit, body: t.from.unknownBusinessUnitWhy };
    }

    return null;
  };
  const reject = rejectOf();

  const result =
    scannedLot !== null && foundLot.isPending ? (
      <p role="status">{t.from.loading}</p>
    ) : reject !== null ? (
      <section className="last-scan" data-kind="reject" aria-label={t.result.rejected}>
        <p className="last-scan__bar">
          <Icon name="block" size={22} />
          <span>{t.result.rejected}</span>
        </p>
        <div className="last-scan__body" role="alert">
          <p className="last-scan__why">{reject.title}</p>
          {reject.body === null ? null : <p className="last-scan__sub">{reject.body}</p>}
        </div>
      </section>
    ) : duplicateAt >= 0 ? (
      <section className="last-scan" data-kind="duplicate" aria-label={t.result.duplicate}>
        <p className="last-scan__bar">
          <Icon name="info" size={22} />
          <span>{t.result.duplicate}</span>
        </p>
        <div className="last-scan__body">
          <p className="last-scan__why">{t.result.duplicateRow(duplicateAt + 1)}</p>
          <p className="last-scan__lot">{lines[duplicateAt]?.lotNo}</p>
        </div>
      </section>
    ) : added === null ? null : (
      <section className="last-scan" data-kind="ok" aria-label={t.result.added}>
        <p className="last-scan__bar">
          <Icon name="check_circle" size={22} />
          <span>{t.result.added}</span>
        </p>
        <div className="last-scan__body">
          <p className="last-scan__code">{itemOf(added).itemCode}</p>
          <p className="last-scan__name">
            <FitName text={itemOf(added).itemName} min={13} />
          </p>
          <p className="last-scan__qty">
            {String(added.onHandQty)}
            <small>{uomOf(added.uomId)}</small>
          </p>
          <p className="last-scan__lot">{added.lotNo}</p>
          <p className="last-scan__note">
            {t.from.onHand(String(added.onHandQty), uomOf(added.uomId))}
          </p>
        </div>
      </section>
    );

  /*
   * 도착(이어서 하기) — 무엇을 옮기는 중인지(도착할 LOT 표)를 보이고 놓은 자리만 찍는다(사용자 지시 2026-11-20).
   * LOT 을 하나씩 다시 찍지는 않는다 — 계약상 도착은 위치 하나와 반출한 라인 전체다.
   */
  if (shipped !== null) {
    const arriveTotal = shipped.lines.reduce((sum, line) => sum + line.shippedQty, 0);
    const arriveUnits = new Set(shipped.lines.map((line) => line.uomId));

    return (
      <div className="stock-transfer">
        <section className="stock-transfer__dest" aria-label={shipped.transfer.stockTransferNo}>
          <span className="stock-transfer__dest-place">
            <strong className="stock-transfer__dest-no">{shipped.transfer.stockTransferNo}</strong>
            <span>
              {t.arrive.route(
                warehouseNameOf(shipped.transfer.fromWarehouseId) ?? '',
                warehouseNameOf(shipped.transfer.toWarehouseId) ?? '',
              )}
            </span>
          </span>
        </section>

        <ScanZone
          field={locationField}
          label={t.to.arrivedScanLabel}
          prompt={t.to.scanPlaceholder}
          standby={toLocation !== null}
          error={
            scannedLocation !== null && destination.data === null
              ? t.to.notFound(scannedLocation)
              : undefined
          }
          tools={
            <IconButton
              icon={locationField.manual ? 'keyboard_return' : 'keyboard'}
              size="lg"
              aria-label={locationField.manual ? t.to.manualSubmit : t.to.manualLabel}
              onClick={locationField.manual ? locationField.submitManual : locationField.openManual}
            />
          }
        />
        {scannedLocation !== null && destination.isPending ? (
          <p role="status">{t.to.loading}</p>
        ) : null}
        {toLocation === null ? null : (
          <p className="stock-transfer__picked">
            <Icon name="check_circle" size={20} />
            {t.to.picked(toLocation.locationCode)}
          </p>
        )}

        <ArriveLots
          lines={shipped.lines}
          itemOf={(line) => ({
            itemCode: arriveItems.get(line.itemId)?.itemCode ?? '',
            itemName: arriveItems.get(line.itemId)?.itemName ?? '',
          })}
          lotNoOf={(line) => arriveLots.data?.get(line.lotId)?.lotNo ?? null}
          uomOf={uomOf}
        />

        <section className="stock-transfer__bar">
          {saveFailed ? (
            <AlertBanner variant="error" title={t.saveFailed.title}>
              {t.saveFailed.description}
            </AlertBanner>
          ) : null}
          {toLocation === null ? <p className="stock-transfer__note">{t.noDestination}</p> : null}
          <div className="stock-transfer__bar-row">
            <p className="stock-transfer__sum">
              <strong>{t.summary.count(shipped.lines.length)}</strong>
              {arriveUnits.size === 1 ? (
                <span>{`${arriveTotal.toLocaleString('ko-KR')} ${uomOf(shipped.lines[0]?.uomId)}`}</span>
              ) : null}
            </p>
            <Button
              className="stock-transfer__wide"
              variant="filled"
              size="2xl"
              disabled={!arriveReady}
              onClick={() => void arrive()}
            >
              {t.submitArrive}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={keypad === null ? 'stock-transfer' : 'stock-transfer docked-pad-open'}>
      {shipNotice ? (
        <AlertBanner variant="success" title={t.shipped.title}>
          {t.shipped.description}
        </AlertBanner>
      ) : null}
      <section className="stock-transfer__section" aria-label={t.unfinished.legend}>
        <h2 className="transfer-tally__title">{t.unfinished.legend}</h2>
        {unfinished.isPending ? <p role="status">{t.unfinished.loading}</p> : null}
        {unfinished.isError ? (
          <FailureBanner
            variant="warning"
            title={failureText(unfinished.error, t.unfinished.loadFailed)}
          />
        ) : null}
        {/* 다른 단말이 반출한 것은 오프라인에서 오지 않는다. 없다고 단정하면 안 된다. */}
        {!online ? <p className="stock-transfer__note">{t.unfinished.offline}</p> : null}
        {unfinished.isSuccess && unfinished.data.length === 0 ? (
          <p className="stock-transfer__note">{t.unfinished.none}</p>
        ) : null}
        {/* 카드 대신 한 줄씩 — 이동 번호 · 라인 수 · 출발 → 도착, 오른쪽 [이어서 하기](사용자 지시 2026-11-20). */}
        {(unfinished.data ?? []).length === 0 ? null : (
          <div className="transfer-tally__box">
            <table className="transfer-tally__table">
              <colgroup>
                <col className="transfer-tally__col-no" />
                <col />
                <col className="stock-transfer__col-resume" />
              </colgroup>
              <tbody>
                {(unfinished.data ?? []).map((each, index) => (
                  <tr key={each.transfer.stockTransferId}>
                    <td className="transfer-tally__no">{index + 1}</td>
                    <td className="transfer-tally__item transfer-tally__item--static">
                      <span className="transfer-tally__code">
                        {t.unfinished.item(each.transfer.stockTransferNo, each.lines.length)}
                      </span>
                      <span className="transfer-tally__name">
                        {t.arrive.route(
                          warehouseNameOf(each.transfer.fromWarehouseId) ?? '',
                          warehouseNameOf(each.transfer.toWarehouseId) ?? '',
                        )}
                      </span>
                    </td>
                    <td className="stock-transfer__resume">
                      <Button
                        variant="outlined"
                        size="sm"
                        onClick={() => {
                          setShipNotice(false);
                          setShipped(each);
                          setToWarehouseId(each.transfer.toWarehouseId);
                          setScannedLocation(null);
                        }}
                      >
                        {t.unfinished.resume}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {destinationSet ? (
        <section className="stock-transfer__dest" aria-label={t.to.legend}>
          <span className="stock-transfer__dest-type">
            {TYPES.find((each) => each.value === type)?.label}
          </span>
          <span className="stock-transfer__dest-place">
            <strong>{toWarehouse.warehouseName}</strong>
            <span>{t.to.picked(toLocation.locationCode)}</span>
          </span>
          <Button
            variant="outlined"
            size="sm"
            onClick={() => {
              setScannedLocation(null);
            }}
          >
            {t.destination.change}
          </Button>
        </section>
      ) : (
        <>
          <section className="stock-transfer__section">
            <h2>{t.type.legend}</h2>
            {TYPES.map((each) => (
              <Radio
                key={each.value}
                name="transfer-type"
                value={each.value}
                checked={type === each.value}
                onChange={() => {
                  setType(each.value);
                }}
              >
                {each.label}
              </Radio>
            ))}
          </section>

          <section className="stock-transfer__section">
            <h2>{t.to.legend}</h2>
            <label htmlFor="transfer-to-warehouse">{t.to.warehouseLabel}</label>
            <Select
              id="transfer-to-warehouse"
              placeholder={t.to.warehousePlaceholder}
              size="xl"
              value={toWarehouseId === null ? null : String(toWarehouseId)}
              onChange={(value) => {
                setToWarehouseId(Number(value));
                setScannedLocation(null);
              }}
              options={(warehouses.data ?? []).map((each) => ({
                value: String(each.warehouseId),
                label: each.warehouseName,
              }))}
            />
            <TextField
              ref={locationField.ref}
              label={t.to.scanLabel}
              placeholder={t.to.scanPlaceholder}
              size="xl"
              fullWidth
            />
            {/*
             * 스캔 칸 하나로 받는다. 스캐너를 기다리는 동안에는 키보드를 열지 않고, 직접
             * 입력을 누르면 그 칸이 열린다. 치는 도중 스캔이 오면 스캔값이 이긴다.
             */}
            {locationField.manual ? (
              <Button variant="outlined" size="xl" onClick={locationField.submitManual}>
                {t.to.manualSubmit}
              </Button>
            ) : (
              <Button variant="text" size="xl" onClick={locationField.openManual}>
                {t.to.manualLabel}
              </Button>
            )}
            {scannedLocation !== null && destination.isPending ? (
              <p role="status">{t.to.loading}</p>
            ) : null}
            {scannedLocation !== null && destination.data === null ? (
              <AlertBanner variant="error" title={t.to.notFound(scannedLocation)} />
            ) : null}
            {toLocation !== null ? <p>{t.to.picked(toLocation.locationCode)}</p> : null}
          </section>
        </>
      )}
      {/* 이동 헤더가 창고 간만 받는다. 같은 창고 안은 적을 자리가 없다. */}
      {sameWarehouse ? <AlertBanner variant="error" title={t.to.sameWarehouse} /> : null}
      {/* 헤더는 출발 창고를 하나만 받는다. 섞으면 없는 자리에서 빼는 것이 된다. */}
      {mixed ? <AlertBanner variant="error" title={t.from.mixedWarehouse} /> : null}

      <>
        <ScanZone
          field={lotField}
          label={t.from.scanLabel}
          prompt={t.from.scanPlaceholder}
          standby
          /* 스캐너가 못 읽는 라벨이 있다. 손으로 넣는 길은 구역 아래 아이콘(공유계약 D-3). */
          tools={
            <IconButton
              icon={lotField.manual ? 'keyboard_return' : 'keyboard'}
              size="lg"
              aria-label={lotField.manual ? t.from.manualSubmit : t.from.manualLabel}
              onClick={lotField.manual ? lotField.submitManual : lotField.openManual}
            />
          }
        />

        <div className="stock-transfer__status">{result}</div>

        {/* 결정 14 — 보류는 막지 않고 알린다. 막으면 현장이 물건을 못 옮긴다. */}
        {held.length > 0 ? (
          <AlertBanner
            variant="warning"
            title={t.hold.title(held.map((each) => each.lotNo).join(' · '))}
          >
            {t.hold.description}
          </AlertBanner>
        ) : null}

        {lines.length === 0 ? null : (
          <TransferTally
            lines={lines}
            itemOf={itemOf}
            uomOf={uomOf}
            nameOf={nameOf}
            currentLotId={addedLotId}
            duplicateLotId={duplicateLotId}
            focusKey={scanKey}
            onQty={setQty}
            onKeypad={setKeypadFor}
            onOpen={setViewLotId}
          />
        )}

        <section className="stock-transfer__bar">
          {saveFailed ? (
            <AlertBanner variant="error" title={t.saveFailed.title}>
              {t.saveFailed.description}
            </AlertBanner>
          ) : null}
          {/*
              지금 할 일 하나만 말한다. 남은 것을 모두 늘어놓으면 무엇부터 해야 하는지가 도리어
              묻힌다 - 스캐너를 든 손은 한쪽뿐이다.
            */}
          {nextStep === null ? null : <p className="stock-transfer__note">{nextStep}</p>}
          <div className="stock-transfer__bar-row">
            {lines.length === 0 ? null : (
              <p className="stock-transfer__sum">
                <strong>{t.summary.count(lines.length)}</strong>
                {totalText === null ? null : <span>{totalText}</span>}
              </p>
            )}
            <Button
              className="stock-transfer__wide"
              variant="filled"
              size="2xl"
              disabled={!shipReady}
              onClick={() => void ship()}
            >
              {t.submitShip}
            </Button>
          </div>
        </section>

        {viewed === null ? null : (
          <TransferSheet
            line={viewed}
            item={itemOf(viewed)}
            fromWarehouse={warehouseNameOf(viewed.warehouseId)}
            uom={uomOf(viewed.uomId)}
            onRemove={() => {
              setLines((current) => current.filter((each) => each.lotId !== viewed.lotId));
              setViewLotId(null);
              setAddedLotId(null);
              setDuplicateLotId(null);
            }}
            onDismiss={() => {
              setViewLotId(null);
            }}
          />
        )}

        {keypad === null ? null : (
          <DockedNumberPad
            head={nameOf(keypad.line)}
            fieldId={qtyFieldId(keypad.line.lotId)}
            value={keypad.line.qty}
            onChange={(value) => {
              setQty(keypad.line.lotId, value);
            }}
            onClose={() => {
              setKeypadFor(null);
            }}
            move={{
              canPrevious: keypad.at > 0,
              canNext: keypad.at < lines.length - 1,
              onPrevious: () => {
                setKeypadFor(lines[keypad.at - 1]?.lotId ?? null);
              },
              onNext: () => {
                setKeypadFor(lines[keypad.at + 1]?.lotId ?? null);
              },
              previousLabel: t.from.previousLine,
              nextLabel: t.from.nextLine,
            }}
            allowDecimal
          />
        )}
      </>
    </div>
  );
};
