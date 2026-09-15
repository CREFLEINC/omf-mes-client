import {
  AlertBanner,
  Button,
  Card,
  IconButton,
  NumberPad,
  Radio,
  Select,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useLocationByCode } from '../../patterns/locations';
import { useScannedLot } from '../../patterns/lots';
import { useItemLabels } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { useBackStep } from '../../patterns/back-step';
import { uomLabelOf, useUomCodes } from '../../patterns/masters';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import { useLotBalances, useUnfinishedTransfers, useWarehouses } from './queries';
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
  const [duplicate, setDuplicate] = useState(false);
  const [noStock, setNoStock] = useState(false);
  const [unknownBusinessUnit, setUnknownBusinessUnit] = useState(false);
  /** 반출이 선 뒤의 이동. 이것이 있으면 화면은 도착만 남았다. */
  const [shipped, setShipped] = useState<{
    transfer: StockTransfer;
    lines: StockTransferLine[];
  } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /* 단말 키보드는 키가 촘촘하고 올라오면 라인 목록과 기록 단추를 덮는다. */
  const [keypadFor, setKeypadFor] = useState<number | null>(null);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 같은 물건이 두 번 반출된다.
   */
  const inFlight = useRef(false);

  const warehouses = useWarehouses();
  const unfinished = useUnfinishedTransfers();
  const destination = useLocationByCode(toWarehouseId, scannedLocation);
  const foundLot = useScannedLot(scannedLot);
  const balances = useLotBalances(foundLot.data?.lotId ?? null);
  const itemLabels = useItemLabels(lines.map((line) => line.itemId));

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

    const pick = sourcePickOf(rows, warehouses.data ?? []);

    if (pick.kind !== 'row') {
      setNoStock(pick.kind === 'noStock');
      setUnknownBusinessUnit(pick.kind === 'unknownBusinessUnit');
      return;
    }

    const at = pick.row;
    const { locationId: fromLocationId, warehouseId, businessUnitId } = pick;

    setNoStock(false);
    setUnknownBusinessUnit(false);
    setLines((current) => {
      if (current.some((each) => each.lotId === lot.lotId)) {
        setDuplicate(true);
        return current;
      }

      setDuplicate(false);

      return [
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
          qty: '',
        },
      ];
    });
  }, [foundLot.data, balances.data, warehouses.data]);

  const lotField = useScanField({
    onScan: (value) => {
      setDuplicate(false);
      setNoStock(false);
      setUnknownBusinessUnit(false);
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
    setDuplicate(false);
    setNoStock(false);
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

  const restart = () => {
    setLines([]);
    setScannedLot(null);
    setScannedLocation(null);
    setShipped(null);
    setOutcome(null);
    setSaveFailed(false);
    setDuplicate(false);
    setNoStock(false);
    setUnknownBusinessUnit(false);
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

  return (
    <div className="stock-transfer">
      <section className="stock-transfer__section">
        <h2>{t.unfinished.legend}</h2>
        {unfinished.isPending ? <p role="status">{t.unfinished.loading}</p> : null}
        {unfinished.isError ? (
          <FailureBanner
            variant="warning"
            title={failureText(unfinished.error, t.unfinished.loadFailed)}
          />
        ) : null}
        {/* 다른 단말이 반출한 것은 오프라인에서 오지 않는다. 없다고 단정하면 안 된다. */}
        {!online ? <p className="stock-transfer__note">{t.unfinished.offline}</p> : null}
        {unfinished.isSuccess && unfinished.data.length === 0 ? <p>{t.unfinished.none}</p> : null}
        {(unfinished.data ?? []).map((each) => (
          <Card bordered key={each.transfer.stockTransferId}>
            <Card.Header>
              {t.unfinished.item(each.transfer.stockTransferNo, each.lines.length)}
            </Card.Header>
            <Card.Body className="card-body">
              <Button
                variant="outlined"
                size="xl"
                onClick={() => {
                  setShipped(each);
                  setToWarehouseId(each.transfer.toWarehouseId);
                }}
              >
                {t.unfinished.resume}
              </Button>
            </Card.Body>
          </Card>
        ))}
      </section>

      {shipped !== null ? null : (
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
      )}

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
        {/* 이동 헤더가 창고 간만 받는다. 같은 창고 안은 적을 자리가 없다. */}
        {sameWarehouse ? <AlertBanner variant="error" title={t.to.sameWarehouse} /> : null}
        {/* 헤더는 출발 창고를 하나만 받는다. 섞으면 없는 자리에서 빼는 것이 된다. */}
        {mixed ? <AlertBanner variant="error" title={t.from.mixedWarehouse} /> : null}
      </section>

      {shipped !== null ? (
        <section className="stock-transfer__section">
          {worker === null ? <p className="stock-transfer__note">{t.noWorker}</p> : null}
          {toLocation === null ? <p className="stock-transfer__note">{t.noDestination}</p> : null}
          <Button
            className="stock-transfer__wide"
            variant="filled"
            size="2xl"
            disabled={!arriveReady}
            onClick={() => void arrive()}
          >
            {t.submitArrive}
          </Button>
        </section>
      ) : (
        <>
          <section className="stock-transfer__section">
            <h2>{t.from.legend}</h2>
            <TextField
              ref={lotField.ref}
              label={t.from.scanLabel}
              placeholder={t.from.scanPlaceholder}
              size="xl"
              fullWidth
            />
            {/*
             * 스캔 칸 하나로 받는다. 스캐너를 기다리는 동안에는 키보드를 열지 않고, 직접
             * 입력을 누르면 그 칸이 열린다. 치는 도중 스캔이 오면 스캔값이 이긴다.
             */}
            {lotField.manual ? (
              <Button variant="outlined" size="xl" onClick={lotField.submitManual}>
                {t.from.manualSubmit}
              </Button>
            ) : (
              <Button variant="text" size="xl" onClick={lotField.openManual}>
                {t.from.manualLabel}
              </Button>
            )}

            {scannedLot !== null && foundLot.isPending ? (
              <p role="status">{t.from.loading}</p>
            ) : null}
            {foundLot.isError ? (
              <FailureBanner
                variant="error"
                title={failureText(foundLot.error, t.from.loadFailed)}
              />
            ) : null}
            {scannedLot !== null && foundLot.data === null ? (
              <AlertBanner variant="error" title={t.from.notFound(scannedLot)} />
            ) : null}
            {duplicate ? <AlertBanner variant="warning" title={t.from.already} /> : null}
            {noStock ? <AlertBanner variant="error" title={t.from.noStock} /> : null}
            {unknownBusinessUnit ? (
              <AlertBanner variant="error" title={t.from.unknownBusinessUnit}>
                {t.from.unknownBusinessUnitWhy}
              </AlertBanner>
            ) : null}

            {/* 결정 14 — 보류는 막지 않고 알린다. 막으면 현장이 물건을 못 옮긴다. */}
            {held.length > 0 ? (
              <AlertBanner
                variant="warning"
                title={t.hold.title(held.map((each) => each.lotNo).join(' · '))}
              >
                {t.hold.description}
              </AlertBanner>
            ) : null}

            {lines.map((line, index) => {
              const problem = qtyProblemOf(line);
              const limit = String(line.onHandQty);

              return (
                <div key={line.lotId} className="stock-transfer__line">
                  <TextField
                    label={t.from.qtyLabel(nameOf(line))}
                    size="xl"
                    fullWidth
                    /*
                     * 장갑을 끼고 한 손으로 조작한다. 단말 키보드는 키가 촘촘하고, 올라오면
                     * 라인 목록과 기록 단추를 덮는다.
                     */
                    inputMode="none"
                    onFocus={() => {
                      setKeypadFor(line.lotId);
                    }}
                    onClick={() => {
                      setKeypadFor(line.lotId);
                    }}
                    value={line.qty}
                    onChange={(event) => {
                      const next = event.target.value;
                      setLines((current) =>
                        current.map((each, at) => (at === index ? { ...each, qty: next } : each)),
                      );
                    }}
                    error={
                      problem === null
                        ? undefined
                        : problem === 'overStock'
                          ? t.from.problem.overStock(limit)
                          : t.from.problem[problem]
                    }
                  />
                  <p className="stock-transfer__onhand">
                    {t.from.onHand(limit, uomOf(line.uomId))}
                  </p>
                  <Button
                    variant="text"
                    size="xl"
                    onClick={() => {
                      setLines((current) => current.filter((each) => each.lotId !== line.lotId));
                    }}
                  >
                    {t.from.remove}
                  </Button>
                </div>
              );
            })}
          </section>

          <section className="stock-transfer__section">
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="stock-transfer__note">{t.noWorker}</p> : null}
            {lines.length === 0 ? <p className="stock-transfer__note">{t.noLine}</p> : null}
            {toLocation === null ? <p className="stock-transfer__note">{t.noDestination}</p> : null}
            <Button
              className="stock-transfer__wide"
              variant="filled"
              size="2xl"
              disabled={!shipReady}
              onClick={() => void ship()}
            >
              {t.submitShip}
            </Button>
          </section>

          {/*
            숫자판은 줄 사이에 끼우지 않는다. 끼우면 그 아래 줄들이 화면 밖으로 밀려 적던
            자리를 잃는다. 기기 키보드처럼 화면 아래에 붙여 목록 위에 띄운다.

            목록 밖에 서므로 어느 줄에 적는 중인지 스스로 말한다.
          */}
          {keypad === null ? null : (
            <div className="stock-transfer__keypad">
              <p className="stock-transfer__keypad-head">{nameOf(keypad.line)}</p>
              <div className="stock-transfer__keypad-row">
                <IconButton
                  icon="chevron_left"
                  size="xl"
                  aria-label={t.from.previousLine}
                  disabled={keypad.at === 0}
                  onClick={() => {
                    setKeypadFor(lines[keypad.at - 1]?.lotId ?? null);
                  }}
                />
                <NumberPad
                  value={keypad.line.qty}
                  onChange={(value) => {
                    setLines((current) =>
                      current.map((each, at) =>
                        at === keypad.at ? { ...each, qty: value } : each,
                      ),
                    );
                  }}
                  allowDecimal
                  onConfirm={() => {
                    setKeypadFor(null);
                  }}
                />
                <IconButton
                  icon="chevron_right"
                  size="xl"
                  aria-label={t.from.nextLine}
                  disabled={keypad.at === lines.length - 1}
                  onClick={() => {
                    setKeypadFor(lines[keypad.at + 1]?.lotId ?? null);
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
