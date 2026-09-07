import { AlertBanner, Button, Card, Radio, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useLocationByCode } from '../../patterns/locations';
import { useScannedLot } from '../../patterns/lots';
import { useItemLabels } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useLotBalances, useUnfinishedTransfers, useWarehouses } from './queries';
import {
  DEFECT_RETURN,
  NORMAL,
  SHIP_LABEL,
  canArrive,
  canShip,
  heldLines,
  isSameWarehouse,
  qtyProblemOf,
  queuedShipsFor,
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

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();
  const online = useOnlineStatus();

  const [type, setType] = useState<TransferType>(NORMAL);
  const [toWarehouseId, setToWarehouseId] = useState<number | null>(null);
  const [scannedLocation, setScannedLocation] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [scannedLot, setScannedLot] = useState<string | null>(null);
  const [manualLot, setManualLot] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [duplicate, setDuplicate] = useState(false);
  const [noStock, setNoStock] = useState(false);
  /** 반출이 선 뒤의 이동. 이것이 있으면 화면은 도착만 남았다. */
  const [shipped, setShipped] = useState<{
    transfer: StockTransfer;
    lines: StockTransferLine[];
  } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
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
  const itemLabels = useItemLabels(lines.length > 0);

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

  const fromWarehouseId =
    lines[0]?.fromLocationId === undefined ? null : (lines[0]?.warehouseId ?? null);
  const sameWarehouse =
    fromWarehouseId !== null &&
    toWarehouseId !== null &&
    isSameWarehouse(fromWarehouseId, toWarehouseId);

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

    /*
     * 위치와 창고가 다 있는 줄만 받는다. 창고 수준으로만 관리하는 자리는 위치가 비는데,
     * 그 줄로 반출 라인을 만들면 어디서 뺀 것인지가 남지 않는다.
     */
    const at = rows.find(
      (row) =>
        row.onHandQty > 0 &&
        row.locationId !== undefined &&
        row.locationId !== null &&
        row.warehouseId !== undefined &&
        row.warehouseId !== null,
    );

    if (
      at?.locationId === undefined ||
      at.locationId === null ||
      at.warehouseId === undefined ||
      at.warehouseId === null
    ) {
      setNoStock(true);
      return;
    }

    const fromLocationId = at.locationId;
    const warehouseId = at.warehouseId;

    setNoStock(false);
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
          onHandQty: at.onHandQty,
          held: lot.held === true,
          qty: '',
        },
      ];
    });
  }, [foundLot.data, balances.data]);

  const lotField = useScanField({
    onScan: (value) => {
      setDuplicate(false);
      setNoStock(false);
      setScannedLot(value.trim());
    },
  });

  const locationField = useScanField({
    onScan: (value) => {
      setScannedLocation(value.trim());
    },
  });

  const nameOf = (line: DraftLine): string =>
    t.from.name(itemLabels.data?.get(line.itemId)?.itemCode ?? '', line.lotNo);

  const restart = () => {
    setLines([]);
    setScannedLot(null);
    setScannedLocation(null);
    setManualLot('');
    setManualLocation('');
    setShipped(null);
    setOutcome(null);
    setSaveFailed(false);
    setDuplicate(false);
    setNoStock(false);
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
      const from = lines[0];

      if (from === undefined) {
        return;
      }

      const draft = toShipDraft(
        type,
        { warehouseId: from.warehouseId, businessUnitId: toWarehouse.businessUnitId },
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
          <AlertBanner variant="warning" title={t.unfinished.loadFailed} />
        ) : null}
        {/* 다른 단말이 반출한 것은 오프라인에서 오지 않는다. 없다고 단정하면 안 된다. */}
        {!online ? <p className="stock-transfer__note">{t.unfinished.offline}</p> : null}
        {unfinished.data?.length === 0 ? <p>{t.unfinished.none}</p> : null}
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
        <label htmlFor="transfer-to-warehouse">{t.to.legend}</label>
        <Select
          id="transfer-to-warehouse"
          placeholder={t.to.scanPlaceholder}
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
        {/* 스캔 칸은 스캐너 전용이다. 스캔이 실패했을 때 손으로 넣을 길을 함께 둔다. */}
        <div className="stock-transfer__row">
          <TextField
            label={t.to.manualLabel}
            size="xl"
            fullWidth
            value={manualLocation}
            onChange={(event) => {
              setManualLocation(event.target.value);
            }}
          />
          <Button
            variant="outlined"
            size="xl"
            onClick={() => {
              setScannedLocation(manualLocation.trim());
              setManualLocation('');
            }}
          >
            {t.to.manualSubmit}
          </Button>
        </div>
        {scannedLocation !== null && destination.isPending ? (
          <p role="status">{t.to.loading}</p>
        ) : null}
        {scannedLocation !== null && destination.data === null ? (
          <AlertBanner variant="error" title={t.to.notFound(scannedLocation)} />
        ) : null}
        {toLocation !== null ? <p>{t.to.picked(toLocation.locationCode)}</p> : null}
        {/* 이동 헤더가 창고 간만 받는다. 같은 창고 안은 적을 자리가 없다. */}
        {sameWarehouse ? <AlertBanner variant="error" title={t.to.sameWarehouse} /> : null}
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
            <div className="stock-transfer__row">
              <TextField
                label={t.from.manualLabel}
                size="xl"
                fullWidth
                value={manualLot}
                onChange={(event) => {
                  setManualLot(event.target.value);
                }}
              />
              <Button
                variant="outlined"
                size="xl"
                onClick={() => {
                  setDuplicate(false);
                  setNoStock(false);
                  setScannedLot(manualLot.trim());
                  setManualLot('');
                }}
              >
                {t.from.manualSubmit}
              </Button>
            </div>

            {scannedLot !== null && foundLot.isPending ? (
              <p role="status">{t.from.loading}</p>
            ) : null}
            {foundLot.isError ? <AlertBanner variant="error" title={t.from.loadFailed} /> : null}
            {scannedLot !== null && foundLot.data === null ? (
              <AlertBanner variant="error" title={t.from.notFound(scannedLot)} />
            ) : null}
            {duplicate ? <AlertBanner variant="warning" title={t.from.already} /> : null}
            {noStock ? <AlertBanner variant="error" title={t.from.noStock} /> : null}

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
                    inputMode="numeric"
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
                  <p className="stock-transfer__onhand">{t.from.onHand(limit)}</p>
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
        </>
      )}
    </div>
  );
};
