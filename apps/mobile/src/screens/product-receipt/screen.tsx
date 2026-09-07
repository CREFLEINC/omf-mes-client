import { AlertBanner, Button, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useLocationByCode, useLocations } from '../../patterns/locations';
import { useItemLabels } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { currentPlantId } from '../../patterns/plant';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useHandlingUnitByNo, useLots, useUnitContents, useWarehouses } from './queries';
import {
  INSPECTION_PENDING,
  RECEIPT_LABEL,
  canSubmit,
  destinationOf,
  differsFromExpected,
  managesLocations,
  putawayTaskIdsOf,
  qtyProblemOf,
  queuedForLotsOf,
  toPutawayDraft,
  toReceiptDraft,
  type DraftLine,
} from './receipt';
import './screen.css';

const t = messages.productReceipt;

type Outcome = 'held' | 'sent' | 'receivedOnly' | 'putawayRejected' | 'rejected';

export const ProductReceiptScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();
  const online = useOnlineStatus();

  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [scannedUnit, setScannedUnit] = useState<string | null>(null);
  const [manualUnit, setManualUnit] = useState('');
  const [scannedLocation, setScannedLocation] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 같은 LOT 이 두 번 재고로 선다.
   */
  const inFlight = useRef(false);

  const warehouses = useWarehouses();
  const warehouse =
    (warehouses.data ?? []).find((each) => each.warehouseId === warehouseId) ?? null;

  const unit = useHandlingUnitByNo(scannedUnit);
  const foundUnit = unit.data ?? null;
  const contents = useUnitContents(foundUnit?.handlingUnitId ?? null);
  const lots = useLots((contents.data ?? []).map((each) => each.lotId));

  const locations = useLocations(warehouseId);
  const atLocation = useLocationByCode(warehouseId, scannedLocation);
  const destination = destinationOf(warehouse, atLocation.data ?? null, locations.data ?? []);

  const itemLabels = useItemLabels(lines.length > 0);
  const plantId = currentPlantId();

  /*
   * 큐에 담긴 것은 서버 응답에 없다. 읽기 전에는 담긴 것이 없는 것과 구별되지 않아 같은
   * 인식표를 두 번 입고하게 되므로, 읽기 전에는 담긴 것으로 세어 막아 둔다.
   */
  const queuedForLots = loaded
    ? queuedForLotsOf(
        pendingOf(RECEIPT_LABEL),
        lines.map((line) => line.lotId),
      )
    : 1;

  const ready = canSubmit(warehouse, destination, lines, worker !== null, plantId, queuedForLots);

  /* 담긴 것을 화면이 적을 자리로 옮긴다. 수량은 인식표가 말한 것으로 채우고 고칠 수 있게 둔다. */
  useEffect(() => {
    const rows = contents.data;

    if (rows === undefined) {
      return;
    }

    setLines((current) => {
      const typed = new Map(current.map((line) => [line.handlingUnitContentId, line.qty]));

      return rows.map((row) => ({
        handlingUnitContentId: row.handlingUnitContentId,
        itemId: row.itemId,
        lotId: row.lotId,
        uomId: row.uomId,
        expectedQty: row.qty,
        qty: typed.get(row.handlingUnitContentId) ?? String(row.qty),
      }));
    });
  }, [contents.data]);

  const unitScan = useScanField({
    onScan: (value) => {
      setScannedUnit(value.trim());
    },
  });

  const locationScan = useScanField({
    onScan: (value) => {
      setScannedLocation(value.trim());
    },
  });

  const nameOf = (line: DraftLine): string =>
    t.contents.name(
      itemLabels.data?.get(line.itemId)?.itemCode ?? '',
      lots.data?.get(line.lotId)?.lotNo ?? String(line.lotId),
    );

  const restart = () => {
    setScannedUnit(null);
    setManualUnit('');
    setScannedLocation(null);
    setManualLocation('');
    setLines([]);
    setOutcome(null);
    setSaveFailed(false);
    unitScan.focus();
  };

  const submit = async () => {
    if (warehouse === null || destination === null || worker === null || plantId === null) {
      return;
    }

    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const now = new Date();
      const draft = toReceiptDraft(warehouse, destination, lines, plantId, now, worker.workerNo);

      /* 담기지 못하면 입고가 어디에도 없다. 말하지 않으면 사람은 입고된 줄 안다. */
      try {
        await enqueue(draft);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === draft.idempotencyKey;

      /*
       * 자기가 부른 보내기의 결과만 보면 셸이 도는 다른 회차에서 되돌려진 건을 놓친다 -
       * 화면은 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(draft.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      if (result === null || result.remaining.some(mine)) {
        setOutcome('held');
        return;
      }

      /*
       * 적치 지시 식별자는 입고 응답에만 있다. 담긴 채로 끝나면 아직 없어서 적치를 이어 담을
       * 수 없고, 남은 지시는 적치 화면이 되찾는다 - 계약이 그 상태를 오류로 두지 않는다.
       */
      const taskIds = putawayTaskIdsOf(result.responses.get(draft.idempotencyKey));

      if (taskIds.length === 0) {
        setOutcome('receivedOnly');
        return;
      }

      const putawayDrafts = taskIds.map((taskId) =>
        toPutawayDraft(taskId, destination, now, worker.workerNo),
      );

      for (const putawayDraft of putawayDrafts) {
        await enqueue(putawayDraft);
      }

      const putaway = await flush().catch(() => null);
      const keys = putawayDrafts.map((each) => each.idempotencyKey);
      const isMine = (each: { idempotencyKey: string }) => keys.includes(each.idempotencyKey);

      /*
       * 적치가 되돌아왔는데 입고까지 섰다고 말하면 사람은 물건이 자리에 든 줄 안다. 내 것만
       * 본다 - 남의 화면이 담아 둔 건까지 세면 다 간 적치를 안 갔다고 말한다.
       */
      if (putaway !== null && putaway.rejected.some((each) => isMine(each.entry))) {
        setOutcome('putawayRejected');
        return;
      }

      if (keys.some((key) => isRejected(key))) {
        setOutcome('putawayRejected');
        return;
      }

      setOutcome(putaway === null || putaway.remaining.some(isMine) ? 'receivedOnly' : 'sent');
    } finally {
      inFlight.current = false;
    }
  };

  if (outcome !== null) {
    return (
      <div className="product-receipt">
        {outcome === 'sent' ? <AlertBanner variant="success" title={t.sent.title} /> : null}
        {outcome === 'receivedOnly' ? (
          <AlertBanner variant="warning" title={t.receivedOnly.title}>
            {t.receivedOnly.description}
            <Link to="/putaway">{t.receivedOnly.action}</Link>
          </AlertBanner>
        ) : null}
        {outcome === 'putawayRejected' ? (
          <AlertBanner variant="error" title={t.putawayRejected.title}>
            {t.putawayRejected.description}
            <Link to="/rejections">{t.putawayRejected.action}</Link>
          </AlertBanner>
        ) : null}
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
        <Button variant="filled" size="2xl" className="product-receipt__wide" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="product-receipt">
      <section className="product-receipt__section">
        <h2>{t.warehouse.legend}</h2>
        {warehouses.isPending ? <p role="status">{t.warehouse.loading}</p> : null}
        {warehouses.isError ? <AlertBanner variant="error" title={t.warehouse.loadFailed} /> : null}
        <label htmlFor="product-receipt-warehouse">{t.warehouse.pick}</label>
        <Select
          id="product-receipt-warehouse"
          placeholder={t.warehouse.pickPlaceholder}
          size="xl"
          value={warehouseId === null ? null : String(warehouseId)}
          onChange={(value) => {
            setWarehouseId(Number(value));
            setScannedLocation(null);
          }}
          options={(warehouses.data ?? []).map((each) => ({
            value: String(each.warehouseId),
            label: each.warehouseName,
          }))}
        />
        <p className="product-receipt__note">{t.warehouse.hint}</p>
      </section>

      {warehouse === null ? null : (
        <section className="product-receipt__section">
          <h2>{t.unit.legend}</h2>
          <TextField
            ref={unitScan.ref}
            label={t.unit.scanLabel}
            placeholder={t.unit.scanPlaceholder}
            size="xl"
            fullWidth
          />
          {/* 스캔 칸은 스캐너 전용이다. 스캐너가 죽었을 때 손으로 넣을 길을 함께 둔다. */}
          <div className="product-receipt__row">
            <TextField
              label={t.unit.manualLabel}
              size="xl"
              fullWidth
              value={manualUnit}
              onChange={(event) => {
                setManualUnit(event.target.value);
              }}
            />
            <Button
              variant="outlined"
              size="xl"
              onClick={() => {
                setScannedUnit(manualUnit.trim());
                setManualUnit('');
              }}
            >
              {t.unit.manualSubmit}
            </Button>
          </div>
          {scannedUnit !== null && unit.isPending ? <p role="status">{t.unit.loading}</p> : null}
          {unit.isError ? <AlertBanner variant="error" title={t.unit.loadFailed} /> : null}
          {scannedUnit !== null && unit.data === null ? (
            <AlertBanner variant="error" title={t.unit.notFound(scannedUnit)} />
          ) : null}
          {foundUnit === null ? null : <p>{t.unit.picked(foundUnit.handlingUnitNo)}</p>}
          {foundUnit !== null && contents.data?.length === 0 ? (
            <AlertBanner variant="warning" title={t.unit.empty} />
          ) : null}
        </section>
      )}

      {lines.length === 0 ? null : (
        <>
          <section className="product-receipt__section">
            <h2>{t.contents.legend}</h2>
            {lines.map((line, index) => {
              const problem = qtyProblemOf(line);
              const lot = lots.data?.get(line.lotId);

              return (
                <div key={line.handlingUnitContentId} className="product-receipt__line">
                  <TextField
                    label={t.contents.qtyLabel(nameOf(line))}
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
                    error={problem === null ? undefined : t.contents.problem[problem]}
                  />
                  <p className="product-receipt__expected">
                    {t.contents.expected(String(line.expectedQty))}
                  </p>
                  {lot?.manufacturedAt == null ? null : (
                    <p className="product-receipt__meta">
                      {t.contents.manufactured(lot.manufacturedAt.slice(0, 10))}
                    </p>
                  )}
                  {lot?.expiryDate == null ? null : (
                    <p className="product-receipt__meta">{t.contents.expiry(lot.expiryDate)}</p>
                  )}
                  {/* 실물대로 받는다. 사유를 담을 자리가 계약에 없어 지어내지 않는다. */}
                  {differsFromExpected(line) ? (
                    <AlertBanner variant="warning" title={t.contents.differs} />
                  ) : null}
                  {/* 입고는 막지 않는다. 막히는 것은 하류의 피킹·출하다. */}
                  {lot?.statusCode === INSPECTION_PENDING ? (
                    <AlertBanner variant="warning" title={t.notReleased} />
                  ) : null}
                </div>
              );
            })}
            {/* 판정에 쓰는 값이라 캐시하지 않는다. 끊겨 있으면 물어볼 수 없다. */}
            {online ? null : <AlertBanner variant="info" title={t.releaseUnknown} />}
          </section>

          <section className="product-receipt__section">
            <h2>{t.location.legend}</h2>
            {managesLocations(warehouse) ? (
              <>
                <TextField
                  ref={locationScan.ref}
                  label={t.location.scanLabel}
                  placeholder={t.location.scanPlaceholder}
                  size="xl"
                  fullWidth
                />
                {/* 스캔 칸은 스캐너 전용이다. 스캐너가 죽었을 때 손으로 넣을 길을 함께 둔다. */}
                <div className="product-receipt__row">
                  <TextField
                    label={t.location.manualLabel}
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
                    {t.location.manualSubmit}
                  </Button>
                </div>
                {scannedLocation !== null && atLocation.isPending ? (
                  <p role="status">{t.location.loading}</p>
                ) : null}
                {scannedLocation !== null && atLocation.data === null ? (
                  <AlertBanner variant="error" title={t.location.notFound(scannedLocation)} />
                ) : null}
              </>
            ) : (
              <>
                <AlertBanner variant="info" title={t.location.unmanaged} />
                {locations.data !== undefined && destination === null ? (
                  <AlertBanner variant="error" title={t.location.noDefault} />
                ) : null}
              </>
            )}
            {destination === null ? null : <p>{t.location.picked(destination.locationCode)}</p>}
          </section>

          <section className="product-receipt__section">
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="product-receipt__note">{t.noWorker}</p> : null}
            {plantId === null ? <p className="product-receipt__note">{t.noPlant}</p> : null}
            <Button
              className="product-receipt__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void submit()}
            >
              {t.submit}
            </Button>
          </section>
        </>
      )}
    </div>
  );
};
