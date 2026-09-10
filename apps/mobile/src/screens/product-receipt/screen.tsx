import { AlertBanner, Button, Chip, NumberPad, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { playErrorTone } from '../../patterns/error-tone';
import { useLocationByCode, useLocations } from '../../patterns/locations';
import { useItemLabels } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { currentPlantId } from '../../patterns/plant';
import { ManualEntry } from '../../patterns/manual-entry';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  useHandlingUnitByNo,
  useLots,
  usePutawayRules,
  useStockedLots,
  useUnitContents,
  useWarehouses,
} from './queries';
import {
  INSPECTION_PENDING,
  MATCHED,
  NOT_RECOMMENDED,
  NO_RULE,
  RECEIPT_LABEL,
  canSubmit,
  destinationOf,
  differsFromExpected,
  managesLocations,
  putawayTaskIdsOf,
  qtyProblemOf,
  queuedForLotsOf,
  recommendedOf,
  stockedLines,
  toPutawayDraft,
  toReceiptDraft,
  unverifiedLines,
  verdictOf,
  type DraftLine,
} from './receipt';
import './screen.css';

const t = messages.productReceipt;
const required = messages.common.required;

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
  const [confirmedNoRule, setConfirmedNoRule] = useState(false);
  /* 키패드는 지금 적는 줄 아래에만 선다(공유계약 D-4). 줄마다 두면 화면이 키패드로 찬다. */
  const [keypadFor, setKeypadFor] = useState<number | null>(null);
  /* 같은 라벨을 다시 읽으면 상태는 그대로라 소리가 다시 나지 않는다. 회차를 함께 센다. */
  const [scanSeq, setScanSeq] = useState(0);
  const contentsSection = useRef<HTMLDivElement | null>(null);
  const locationSection = useRef<HTMLDivElement | null>(null);
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
   * 적치 지시는 입고 응답에서야 생긴다. 스캔한 위치가 맞는지는 그 전에 알아야 하므로 규칙을
   * 직접 묻는다.
   *
   * 한 인식표에 품목이 여럿이면 어느 규칙으로 재야 할지 정해진 것이 없다. 첫 줄로 재면 다른
   * 품목의 옳은 자리를 막아 현장이 선다 - 그때는 규칙 없는 갈래로 물러나 확인을 받는다.
   */
  const itemIds = [...new Set(lines.map((line) => line.itemId))];
  const ruledItemId = itemIds.length === 1 ? (itemIds[0] ?? null) : null;
  const rules = usePutawayRules(warehouseId, ruledItemId);
  const recommended = recommendedOf(rules.data ?? []);
  const verdict = verdictOf(recommended, atLocation.data ?? null);
  const stocked = useStockedLots(lines.map((line) => line.lotId));
  const alreadyStocked = stockedLines(lines, stocked);
  const unverified = unverifiedLines(lines, stocked);
  const recommendedCode =
    (locations.data ?? []).find((each) => each.locationId === recommended)?.locationCode ?? '';

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

  const ready = canSubmit({
    warehouse,
    destination,
    lines,
    hasWorker: worker !== null,
    plantId,
    queuedForLots,
    verdict,
    confirmedNoRule,
    stocked,
  });

  /*
   * 스캔한 것이 이 화면의 대상이 아니라는 것을 소리로도 알린다(공유계약 D-2). 기기를 허리에
   * 매단 채 읽으므로 화면에만 적으면 사람은 통과한 줄 알고 다음 동작으로 넘어간다.
   */
  const scanMissed =
    (scannedUnit !== null && unit.isSuccess && unit.data === null) ||
    (scannedLocation !== null && atLocation.isSuccess && atLocation.data === null) ||
    (scannedLocation !== null && verdict === NOT_RECOMMENDED);

  useEffect(() => {
    if (scanMissed) {
      playErrorTone();
    }
  }, [scanMissed, scanSeq]);

  /* 세로 화면이라 채운 구획이 자리를 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(lines.length > 0, contentsSection);
  useAdvanceTo(lines.length > 0 && managesLocations(warehouse), locationSection);

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
      setScanSeq((seq) => seq + 1);
    },
  });

  const locationScan = useScanField({
    onScan: (value) => {
      setScannedLocation(value.trim());
      setConfirmedNoRule(false);
      setScanSeq((seq) => seq + 1);
    },
  });

  /*
   * 뒤로가기는 스캔한 인식표를 먼저 놓는다. 두지 않으면 수량을 적던 사람이 한 번에 작업
   * 목록까지 나가 인식표를 다시 스캔해야 한다.
   */
  useBackStep(lines.length > 0, () => {
    setScannedUnit(null);
    setScannedLocation(null);
    setLines([]);
    setConfirmedNoRule(false);
    setKeypadFor(null);
    unitScan.focus();
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
    setConfirmedNoRule(false);
    setKeypadFor(null);
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
            label={required(t.unit.scanLabel)}
            placeholder={t.unit.scanPlaceholder}
            size="xl"
            fullWidth
          />
          <ManualEntry
            label={t.unit.manualLabel}
            submitLabel={t.unit.manualSubmit}
            value={manualUnit}
            onChange={setManualUnit}
            onSubmit={() => {
              setScannedUnit(manualUnit.trim());
              setManualUnit('');
            }}
          />
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
          <section className="product-receipt__section" ref={contentsSection}>
            <h2>{t.contents.legend}</h2>
            {/* 다른 기기가 먼저 입고한 것은 큐로는 알 수 없다. 두 번 서면 제품이 두 벌이 된다. */}
            {alreadyStocked.length > 0 ? (
              <AlertBanner variant="error" title={t.stocked.title}>
                {t.stocked.description}
              </AlertBanner>
            ) : null}
            {alreadyStocked.length === 0 && unverified.length > 0 ? (
              <AlertBanner variant="warning" title={t.unverified.title}>
                {t.unverified.description}
              </AlertBanner>
            ) : null}
            {lines.map((line, index) => {
              const problem = qtyProblemOf(line);
              const lot = lots.data?.get(line.lotId);

              return (
                <div key={line.handlingUnitContentId} className="product-receipt__line">
                  <TextField
                    label={required(t.contents.qtyLabel(nameOf(line)))}
                    size="xl"
                    fullWidth
                    /*
                     * 장갑을 끼고 한 손으로 조작한다. 기기 키보드는 키가 촘촘하고, 올라오면
                     * 위치 스캔 칸과 완료 단추를 덮는다(설계 §7 · 공유계약 G-6).
                     */
                    inputMode="none"
                    value={line.qty}
                    onChange={(event) => {
                      const next = event.target.value;
                      setLines((current) =>
                        current.map((each, at) => (at === index ? { ...each, qty: next } : each)),
                      );
                    }}
                    onFocus={() => {
                      setKeypadFor(line.handlingUnitContentId);
                    }}
                    error={problem === null ? undefined : t.contents.problem[problem]}
                  />
                  {keypadFor !== line.handlingUnitContentId ? null : (
                    <NumberPad
                      value={line.qty}
                      onChange={(next) => {
                        setLines((current) =>
                          current.map((each, at) => (at === index ? { ...each, qty: next } : each)),
                        );
                      }}
                      allowDecimal
                    />
                  )}
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

          <section className="product-receipt__section" ref={locationSection}>
            <h2>{t.location.legend}</h2>
            {managesLocations(warehouse) ? (
              <>
                {/* 권장 자리를 먼저 보인다. 다 스캔한 뒤에 막히면 물건을 들고 되돌아온다. */}
                {rules.isError ? (
                  <AlertBanner variant="warning" title={t.location.rulesLoadFailed} />
                ) : null}
                {recommended === null ? null : (
                  <Chip>{t.location.recommended(recommendedCode)}</Chip>
                )}
                <TextField
                  ref={locationScan.ref}
                  label={required(t.location.scanLabel)}
                  placeholder={t.location.scanPlaceholder}
                  size="xl"
                  fullWidth
                />
                <ManualEntry
                  label={t.location.manualLabel}
                  submitLabel={t.location.manualSubmit}
                  value={manualLocation}
                  onChange={setManualLocation}
                  onSubmit={() => {
                    setScannedLocation(manualLocation.trim());
                    setManualLocation('');
                  }}
                />
                {scannedLocation !== null && atLocation.isPending ? (
                  <p role="status">{t.location.loading}</p>
                ) : null}
                {scannedLocation !== null && atLocation.data === null ? (
                  <AlertBanner variant="error" title={t.location.notFound(scannedLocation)} />
                ) : null}

                {atLocation.data == null ? null : verdict === MATCHED ? (
                  <AlertBanner variant="success" title={t.location.matched} />
                ) : verdict === NOT_RECOMMENDED ? (
                  <AlertBanner variant="error" title={t.location.notRecommended(recommendedCode)} />
                ) : (
                  <>
                    <AlertBanner variant="warning" title={t.location.noRule} />
                    <Button
                      className="product-receipt__wide"
                      variant={confirmedNoRule ? 'filled' : 'outlined'}
                      size="xl"
                      onClick={() => {
                        setConfirmedNoRule(true);
                      }}
                    >
                      {t.location.noRuleConfirm}
                    </Button>
                  </>
                )}
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
            <div className="action-bar">
              <Button
                className="product-receipt__wide"
                variant="filled"
                size="2xl"
                disabled={!ready}
                onClick={() => void submit()}
              >
                {t.submit}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
