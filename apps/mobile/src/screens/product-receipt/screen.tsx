import { AlertBanner, Icon, IconButton, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ApiError } from '@omf-mes/api-client';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { Button } from '../../patterns/button';
import { DockedNumberPad } from '../../patterns/docked-number-pad';
import { playErrorTone } from '../../patterns/error-tone';
import { useLocationByCode, useLocations } from '../../patterns/locations';
import { useItemCodes, useItemLabels } from '../../patterns/masters';
import { FitName } from '../../patterns/fit-name';
import { signal } from '../../patterns/scan-feedback';
import { ScanZone } from '../../patterns/scan-zone';
import { referenceFromQuery, referenceLabel } from '../../patterns/reference';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { currentPlantId } from '../../patterns/plant';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure, useQueryErrorOf } from '../../patterns/load-failure';
import {
  useHandlingUnitByNo,
  useLocationItemIds,
  useLots,
  useProductLotByNo,
  useStockedLots,
  useUnitContents,
  useWarehouses,
} from './queries';
import {
  ANYWHERE,
  MATCHED,
  NOT_ALLOWED,
  UNDESIGNATED,
  RECEIPT_LABEL,
  canSubmit,
  destinationOf,
  lotLineOf,
  lotRefusalOf,
  managesLocations,
  putawayTaskIdsOf,
  queuedForLotsOf,
  stockedLines,
  toPutawayDraft,
  toReceiptDraft,
  unitLineKey,
  unverifiedLines,
  verdictOf,
  withLotLine,
  type DraftLine,
} from './receipt';
import { qtyFieldId, ReceiptLines } from './receipt-lines';
import { ReceiptSheet } from './receipt-sheet';
import '../../patterns/scan-result.css';
import './screen.css';

const t = messages.productReceipt;
const required = messages.common.required;

/** 서버가 「지정 품목만 받기」 위치라 거절했나 — 코어 코드 LOCATION_ITEM_RESTRICTED(T058). */
const isRestrictedRejection = (error: ApiError | undefined): boolean =>
  error !== undefined &&
  (error.kind === 'validation' || error.kind === 'stateLocked'
    ? error.errors.some((item) => item.code === 'LOCATION_ITEM_RESTRICTED')
    : error.kind !== 'network' && error.code === 'LOCATION_ITEM_RESTRICTED');

type Outcome = 'held' | 'sent' | 'receivedOnly' | 'putawayRejected' | 'rejected';

export const ProductReceiptScreen = () => {
  useScreenTitle(t.title);
  const failureText = useLoadFailure();
  /* 확인하지 못한 까닭. 판정 훅은 까닭을 싣지 않아 캐시에서 읽는다. */
  const stockedError = useQueryErrorOf('product-receipt-stocked');

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();
  const online = useOnlineStatus();

  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  /* 스캔값 하나 — 인식표로 먼저 찾고, 없으면 생산 LOT 라벨로 찾는다(omf-all-around#293). */
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [scannedLocation, setScannedLocation] = useState<string | null>(null);
  /* 지정되지 않은 위치를 알고 [미지정 위치 적치]를 눌렀나(T058). 위치를 다시 읽으면 걷는다. */
  const [confirmedOutside, setConfirmedOutside] = useState(false);
  /* 서버가 「지정 품목만 받기」로 거절했나(LOCATION_ITEM_RESTRICTED) — 결과 화면에 같은 판정 문구로. */
  const [restrictedRejection, setRestrictedRejection] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /* 키패드는 지금 적는 줄 아래에만 선다(공유계약 D-4). 줄마다 두면 화면이 키패드로 찬다. */
  const [keypadFor, setKeypadFor] = useState<string | null>(null);
  /* 같은 라벨을 다시 읽으면 상태는 그대로라 소리가 다시 나지 않는다. 회차를 함께 센다. */
  const [scanSeq, setScanSeq] = useState(0);
  /* LOT · 인식표 스캔만 센다 — 위치 스캔으로 결과 칸이 바뀌면 안 된다. */
  const [codeSeq, setCodeSeq] = useState(0);
  /* 이번 스캔을 판정했나 — 같은 회차를 두 번(조회가 다시 와도) 판정하지 않는다. */
  const judgedSeq = useRef(0);
  const codeSeqRef = useRef(0);
  codeSeqRef.current = codeSeq;
  /** 방금 담은 줄 · 이미 담은 LOT 을 또 찍은 줄 — 결과 칸과 표 강조(사용자 지시 2026-11-20). */
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [duplicateKey, setDuplicateKey] = useState<string | null>(null);
  /** 인식표를 찍어 줄이 펼쳐졌다 — 결과 칸 「인식표 1개 → n줄」. */
  const [unitAdded, setUnitAdded] = useState(false);
  /** 시트로 연 줄. */
  const [viewKey, setViewKey] = useState<string | null>(null);
  /* 이미 입고해 줄에서 뺀 생산 LOT. 다시 스캔하면 줄을 더하지 않고 바로 거절한다. */
  const [refusedStockedLotIds, setRefusedStockedLotIds] = useState<ReadonlySet<number>>(new Set());
  const contentsSection = useRef<HTMLDivElement | null>(null);
  const locationSection = useRef<HTMLDivElement | null>(null);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 같은 LOT 이 두 번 재고로 선다.
   */
  const inFlight = useRef(false);
  const linesRef = useRef<DraftLine[]>([]);
  linesRef.current = lines;

  const warehouses = useWarehouses();
  const warehouse =
    (warehouses.data ?? []).find((each) => each.warehouseId === warehouseId) ?? null;

  const unit = useHandlingUnitByNo(scannedCode);
  const foundUnit = unit.data ?? null;
  const scannedLot = useProductLotByNo(scannedCode, unit.isSuccess && unit.data === null);
  const foundLot = scannedLot.data ?? null;
  const lotRefusal = foundLot === null ? null : lotRefusalOf(foundLot);
  const lotStocked = foundLot !== null && refusedStockedLotIds.has(foundLot.lotId);
  /* 인식표도 생산 LOT 도 아니다. */
  const codeNotFound =
    scannedCode !== null && unit.data === null && scannedLot.isSuccess && scannedLot.data === null;
  const contents = useUnitContents(foundUnit?.handlingUnitId ?? null);

  const locations = useLocations(warehouseId);
  const atLocation = useLocationByCode(warehouseId, scannedLocation);
  const managed = managesLocations(locations.data ?? []);
  const destination = destinationOf(warehouse, atLocation.data ?? null, locations.data ?? []);

  const itemCode = useItemCodes(lines.map((line) => line.itemId));
  const itemLabels = useItemLabels(lines.map((line) => line.itemId));
  /* 줄의 LOT 상세 — 인식표 구성 줄이든 생산 LOT 라벨 줄이든 같은 자리에서 읽는다(omf-all-around#293). */
  const lots = useLots([...new Set(lines.map((line) => line.lotId))]);
  const plantId = currentPlantId();

  /*
   * 적치 지시는 입고 응답에서야 생긴다. 스캔한 위치가 이 품목을 받는지는 그 전에 알아야 하므로
   * 위치의 보관 품목을 직접 묻는다. 묻지 못했으면 막지 않는다 - 서버가 다시 판정한다.
   */
  const itemIds = [...new Set(lines.map((line) => line.itemId))];
  const designated = useLocationItemIds(atLocation.data?.locationId ?? null);
  const verdict = designated.isError
    ? ANYWHERE
    : verdictOf(designated.data, itemIds, atLocation.data?.itemRestricted ?? false);
  const stocked = useStockedLots(lines.map((line) => line.lotId));
  const alreadyStocked = stockedLines(lines, stocked);
  /*
   * 생산 LOT 라벨 줄은 하나씩 쌓인다 — 이미 입고한 LOT 이 줄로 남으면 지울 길이 없어 같이 스캔한
   * 다른 LOT 까지 못 보낸다. 그 줄은 빼고 스캔 칸에서 거절로 알린다(omf-all-around#293).
   * 인식표 줄은 다음 인식표 스캔이 통째로 갈아 끼우므로 그대로 둔다.
   */
  const stockedLotIds = alreadyStocked
    .filter((line) => line.from === 'lot')
    .map((line) => line.lotId)
    .join(',');
  const unverified = unverifiedLines(lines, stocked);

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
    managed,
    destination,
    lines,
    hasWorker: worker !== null,
    plantId,
    queuedForLots,
    verdict,
    stocked,
    confirmedOutside,
  });

  /*
   * 스캔한 것이 이 화면의 대상이 아니라는 것을 소리로도 알린다(공유계약 D-2). 기기를 허리에
   * 매단 채 읽으므로 화면에만 적으면 사람은 통과한 줄 알고 다음 동작으로 넘어간다.
   */
  const scanMissed =
    codeNotFound ||
    lotRefusal !== null ||
    lotStocked ||
    (scannedLocation !== null && atLocation.isSuccess && atLocation.data === null) ||
    (atLocation.data != null && (verdict === NOT_ALLOWED || verdict === UNDESIGNATED));

  useEffect(() => {
    if (scanMissed) {
      playErrorTone();
    }
  }, [scanMissed, scanSeq]);

  /* 세로 화면이라 채운 구획이 자리를 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(lines.length > 0, contentsSection);
  useAdvanceTo(lines.length > 0 && managed, locationSection);

  /* 담긴 것을 화면이 적을 자리로 옮긴다. 수량은 인식표가 말한 것으로 채우고 고칠 수 있게 둔다. */
  useEffect(() => {
    const rows = contents.data;

    if (rows === undefined) {
      return;
    }

    setLines((current) => {
      const typed = new Map(current.map((line) => [line.key, line.qty]));

      return rows.map((row) => ({
        key: unitLineKey(row.handlingUnitContentId),
        from: 'unit' as const,
        itemId: row.itemId,
        lotId: row.lotId,
        uomId: row.uomId,
        expectedQty: row.qty,
        qty: typed.get(unitLineKey(row.handlingUnitContentId)) ?? String(row.qty),
      }));
    });

    /* 새 인식표의 구성이 왔을 때만 — 앞 인식표 구성으로 다음 스캔을 판정하지 않는다. */
    if (rows.length > 0 && judgedSeq.current !== codeSeqRef.current) {
      judgedSeq.current = codeSeqRef.current;
      setUnitAdded(true);
      setAddedKey(null);
      setDuplicateKey(null);
      signal('confirm');
    }
  }, [contents.data]);

  /* 받을 수 있는 생산 LOT 이면 줄을 더한다. 수량은 양품 실적으로 채우고 고칠 수 있게 둔다. */
  /*
   * 이미 담은 LOT 을 또 읽으면 전에는 소리도 알림도 없이 넘어갔다 — 회색 「이미 담은 LOT」과 몇 번 줄인지 알린다
   * (사용자 지시 2026-11-20).
   */
  useEffect(() => {
    const lot = scannedLot.data;

    if (lot == null || lotRefusalOf(lot) !== null || refusedStockedLotIds.has(lot.lotId)) {
      return;
    }

    if (judgedSeq.current === codeSeq) {
      return;
    }

    judgedSeq.current = codeSeq;
    const line = lotLineOf(lot);
    setUnitAdded(false);

    if (linesRef.current.some((each) => each.key === line.key)) {
      setDuplicateKey(line.key);
      setAddedKey(null);
      signal('warn');
      return;
    }

    setDuplicateKey(null);
    setAddedKey(line.key);
    signal('confirm');
    setLines((current) => withLotLine(current, line));
  }, [scannedLot.data, codeSeq, refusedStockedLotIds]);

  useEffect(() => {
    if (stockedLotIds === '') {
      return;
    }

    const ids = new Set(stockedLotIds.split(',').map(Number));

    setRefusedStockedLotIds((current) => new Set([...current, ...ids]));
    setLines((current) => current.filter((line) => line.from !== 'lot' || !ids.has(line.lotId)));
  }, [stockedLotIds]);

  const unitScan = useScanField({
    onScan: (value) => {
      setScannedCode(value.trim());
      setScanSeq((seq) => seq + 1);
      setCodeSeq((seq) => seq + 1);
      setAddedKey(null);
      setDuplicateKey(null);
      setUnitAdded(false);
      setViewKey(null);
    },
  });

  const locationScan = useScanField({
    onScan: (value) => {
      setScannedLocation(value.trim());
      setConfirmedOutside(false);
      setScanSeq((seq) => seq + 1);
    },
  });

  /*
   * 뒤로가기는 스캔한 인식표를 먼저 놓는다. 두지 않으면 수량을 적던 사람이 한 번에 작업
   * 목록까지 나가 인식표를 다시 스캔해야 한다.
   */
  useBackStep(lines.length > 0, () => {
    setScannedCode(null);
    setScannedLocation(null);
    setLines([]);
    setKeypadFor(null);
    setAddedKey(null);
    setDuplicateKey(null);
    setUnitAdded(false);
    unitScan.focus();
  });
  useBackStep(viewKey !== null, () => {
    setViewKey(null);
  });

  /* 한 번에 받는 조회라 실패하면 줄 전부가 같은 상태다. 그래도 대리키는 보이지 않는다. */
  const lotNo = referenceFromQuery(lots, (lot) => lot.lotNo);

  /*
   * 숫자판이 지금 적는 줄. 목록 밖에 서므로 자리를 번호가 아니라 줄 자체로 든다 - 줄을
   * 빼면 숫자판도 함께 닫힌다.
   */
  const keypadAt = lines.findIndex((line) => line.key === keypadFor);
  const keypad = keypadAt === -1 ? null : { at: keypadAt, line: lines[keypadAt] as DraftLine };

  const nameOf = (line: DraftLine): string =>
    t.contents.name(referenceLabel(itemCode(line.itemId)), referenceLabel(lotNo(line.lotId)));

  const restart = () => {
    setScannedCode(null);
    setScannedLocation(null);
    setConfirmedOutside(false);
    setRestrictedRejection(false);
    setLines([]);
    setOutcome(null);
    setSaveFailed(false);
    setKeypadFor(null);
    setAddedKey(null);
    setDuplicateKey(null);
    setUnitAdded(false);
    setViewKey(null);
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
        setRestrictedRejection(
          isRestrictedRejection(result?.rejected.find((each) => mine(each.entry))?.error),
        );
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
        setRestrictedRejection(
          putaway.rejected.some((each) => isMine(each.entry) && isRestrictedRejection(each.error)),
        );
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
        {/* 「지정 품목만 받기」 위치라 거절됐다 — 스캔 때와 같은 판정 문구(T058). */}
        {restrictedRejection ? <AlertBanner variant="error" title={t.location.notAllowed} /> : null}
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

  const itemOf = (line: DraftLine) => ({
    itemCode: itemLabels.get(line.itemId)?.itemCode ?? referenceLabel(itemCode(line.itemId)),
    itemName: itemLabels.get(line.itemId)?.itemName ?? '',
  });
  const lotNoText = (line: DraftLine) => referenceLabel(lotNo(line.lotId));
  const setQty = (key: string, value: string) => {
    setLines((current) =>
      current.map((each) => (each.key === key ? { ...each, qty: value } : each)),
    );
  };
  const viewed = lines.find((line) => line.key === viewKey) ?? null;
  const added = lines.find((line) => line.key === addedKey) ?? null;
  const duplicateAt = lines.findIndex((line) => line.key === duplicateKey);
  const total = lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
  /*
   * 손 입력 아이콘은 화면 오른쪽 아래 한 자리에 뜬다 — 두 구역이 함께 띄우면 겹친다. 지금 받을 스캔 쪽 하나만:
   * 담은 뒤 위치가 아직이면 위치, 아니면 LOT · 인식표.
   */
  const locationStep = lines.length > 0 && managed && destination === null;

  /* 방금 찍은 결과 칸 — 담음 초록 · 이미 담음 회색 · 담지 않음 빨강(사용자 지시 2026-11-20). */
  const rejectTitle = unit.isError
    ? (failureText(unit.error, t.unit.loadFailed) ?? t.unit.loadFailed)
    : scannedLot.isError
      ? (failureText(scannedLot.error, t.unit.lotLoadFailed) ?? t.unit.lotLoadFailed)
      : codeNotFound
        ? t.unit.notFound(scannedCode ?? '')
        : foundLot !== null && lotRefusal !== null
          ? t.unit.lotRefused[lotRefusal](foundLot.lotNo)
          : foundLot !== null && lotStocked
            ? t.unit.lotRefused.stocked(foundLot.lotNo)
            : null;

  const result =
    scannedCode !== null && (unit.isPending || scannedLot.isFetching) ? (
      <p role="status">{t.unit.loading}</p>
    ) : rejectTitle !== null ? (
      <section className="last-scan" data-kind="reject" aria-label={t.result.rejected}>
        <p className="last-scan__bar">
          <Icon name="block" size={22} />
          <span>{t.result.rejected}</span>
        </p>
        <div className="last-scan__body" role="alert">
          <p className="last-scan__why">{rejectTitle}</p>
        </div>
      </section>
    ) : foundUnit !== null && contents.isSuccess && contents.data.length === 0 ? (
      <AlertBanner variant="warning" title={t.unit.empty}>
        {t.unit.picked(foundUnit.handlingUnitNo)}
      </AlertBanner>
    ) : duplicateAt >= 0 ? (
      <section className="last-scan" data-kind="duplicate" aria-label={t.result.duplicate}>
        <p className="last-scan__bar">
          <Icon name="info" size={22} />
          <span>{t.result.duplicate}</span>
        </p>
        <div className="last-scan__body">
          <p className="last-scan__why">{t.result.duplicateRow(duplicateAt + 1)}</p>
          <p className="last-scan__lot">
            {lines[duplicateAt] === undefined ? '' : lotNoText(lines[duplicateAt])}
          </p>
        </div>
      </section>
    ) : foundUnit !== null && unitAdded ? (
      <section className="last-scan" data-kind="ok" aria-label={t.result.added}>
        <p className="last-scan__bar">
          <Icon name="check_circle" size={22} />
          <span>{t.result.added}</span>
        </p>
        <div className="last-scan__body">
          <p className="last-scan__why">{t.unit.picked(foundUnit.handlingUnitNo)}</p>
          <p className="last-scan__note">{t.result.unitLines(lines.length)}</p>
        </div>
      </section>
    ) : added === null ? (
      foundUnit === null ? null : (
        <p>{t.unit.picked(foundUnit.handlingUnitNo)}</p>
      )
    ) : (
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
          <p className="last-scan__qty">{added.qty}</p>
          <p className="last-scan__lot">{lotNoText(added)}</p>
        </div>
      </section>
    );

  return (
    <div className={keypad === null ? 'product-receipt' : 'product-receipt docked-pad-open'}>
      {/* 창고를 고르면 맨 위 한 줄로 접는다 — [바꾸기]로 다시 고른다(사용자 지시 2026-11-20). */}
      {warehouse !== null ? (
        <section className="product-receipt__dest" aria-label={t.warehouse.pick}>
          <span className="product-receipt__dest-label">{t.warehouse.pick}</span>
          <strong className="product-receipt__dest-name">{warehouse.warehouseName}</strong>
          <Button
            variant="outlined"
            size="sm"
            onClick={() => {
              setWarehouseId(null);
              setScannedLocation(null);
            }}
          >
            {t.warehouseChange}
          </Button>
        </section>
      ) : (
        <section className="product-receipt__section">
          <h2>{t.warehouse.legend}</h2>
          {warehouses.isPending ? <p role="status">{t.warehouse.loading}</p> : null}
          {warehouses.isError ? (
            <FailureBanner
              variant="error"
              title={failureText(warehouses.error, t.warehouse.loadFailed)}
            />
          ) : null}
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
      )}

      {warehouse === null ? null : (
        <>
          <ScanZone
            field={unitScan}
            label={required(t.unit.scanLabel)}
            prompt={t.unit.scanPlaceholder}
            standby
            /* 스캐너가 못 읽는 라벨이 있다. 손으로 넣는 길은 구역 아래 아이콘(공유계약 D-3). */
            tools={
              locationStep ? undefined : (
                <IconButton
                  icon={unitScan.manual ? 'keyboard_return' : 'keyboard'}
                  size="lg"
                  aria-label={unitScan.manual ? t.unit.manualSubmit : t.unit.manualLabel}
                  onClick={unitScan.manual ? unitScan.submitManual : unitScan.openManual}
                />
              )
            }
          />
          <div className="product-receipt__status">{result}</div>
        </>
      )}

      {lines.length === 0 ? null : (
        <>
          <section className="product-receipt__section" ref={contentsSection}>
            <h2 className="product-receipt__title">
              {t.contents.legend} <span>{t.tally.total(lines.length)}</span>
            </h2>
            {/* 다른 기기가 먼저 입고한 것은 큐로는 알 수 없다. 두 번 서면 제품이 두 벌이 된다. */}
            {alreadyStocked.length > 0 ? (
              <AlertBanner variant="error" title={t.stocked.title}>
                {t.stocked.description}
              </AlertBanner>
            ) : null}
            {alreadyStocked.length === 0 && unverified.length > 0 ? (
              <AlertBanner variant="warning" title={t.unverified.title}>
                {failureText(stockedError, t.unverified.description, {
                  caution: t.unverified.caution,
                })}
              </AlertBanner>
            ) : null}
            <ReceiptLines
              lines={lines}
              itemOf={itemOf}
              lotNoOf={lotNoText}
              statusOf={(line) => lots.data?.get(line.lotId)?.statusCode}
              nameOf={nameOf}
              currentKey={addedKey}
              duplicateKey={duplicateKey}
              focusKey={codeSeq}
              onQty={setQty}
              onKeypad={setKeypadFor}
              onOpen={setViewKey}
            />
            {/* 판정에 쓰는 값이라 캐시하지 않는다. 끊겨 있으면 물어볼 수 없다. */}
            {online ? null : <AlertBanner variant="info" title={t.releaseUnknown} />}
          </section>

          <section className="product-receipt__section" ref={locationSection}>
            <h2>{t.location.legend}</h2>
            {managed ? (
              <>
                <ScanZone
                  field={locationScan}
                  label={required(t.location.scanLabel)}
                  prompt={t.location.scanPlaceholder}
                  standby={destination !== null}
                  tools={
                    !locationStep ? undefined : (
                      <IconButton
                        icon={locationScan.manual ? 'keyboard_return' : 'keyboard'}
                        size="lg"
                        aria-label={
                          locationScan.manual ? t.location.manualSubmit : t.location.manualLabel
                        }
                        onClick={
                          locationScan.manual ? locationScan.submitManual : locationScan.openManual
                        }
                      />
                    )
                  }
                />
                {scannedLocation !== null && atLocation.isPending ? (
                  <p role="status">{t.location.loading}</p>
                ) : null}
                {scannedLocation !== null && atLocation.data === null ? (
                  <AlertBanner variant="error" title={t.location.notFound(scannedLocation)} />
                ) : null}

                {designated.isError ? (
                  <AlertBanner variant="warning" title={t.location.itemsLoadFailed} />
                ) : null}
                {atLocation.data == null ? null : verdict === MATCHED ? (
                  <AlertBanner variant="success" title={t.location.matched} />
                ) : verdict === NOT_ALLOWED ? (
                  <AlertBanner variant="error" title={t.location.notAllowed}>
                    {atLocation.data.locationCode}
                  </AlertBanner>
                ) : verdict === UNDESIGNATED ? (
                  /*
                   * 지정 밖 품목이지만 옵션이 꺼진 위치 — 확인 한 번(T058 · FR-017b). 제품 입고는 보관 품목을 더하지 않아
                   * 그 문구는 두지 않는다.
                   */
                  confirmedOutside ? (
                    <AlertBanner variant="info" title={t.location.undesignatedConfirmed}>
                      {atLocation.data.locationCode}
                    </AlertBanner>
                  ) : (
                    <>
                      <AlertBanner variant="warning" title={t.location.undesignated}>
                        {atLocation.data.locationCode}
                      </AlertBanner>
                      <div className="product-receipt__confirm">
                        <Button
                          variant="outlined"
                          size="xl"
                          onClick={() => {
                            setScannedLocation(null);
                            locationScan.focus();
                          }}
                        >
                          {t.location.rescan}
                        </Button>
                        <Button
                          variant="filled"
                          size="xl"
                          onClick={() => setConfirmedOutside(true)}
                        >
                          {t.location.confirmUndesignated}
                        </Button>
                      </div>
                    </>
                  )
                ) : verdict === ANYWHERE && !designated.isError ? (
                  <AlertBanner variant="info" title={t.location.anywhere} />
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
            {plantId === null ? <p className="product-receipt__note">{t.noPlant}</p> : null}
            <div className="action-bar product-receipt__bar">
              <p className="product-receipt__sum">
                <strong>{t.summary.count(lines.length)}</strong>
                <span>{total.toLocaleString('ko-KR')}</span>
              </p>
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
          {viewed === null ? null : (
            <ReceiptSheet
              line={viewed}
              item={itemOf(viewed)}
              lotNo={lotNoText(viewed)}
              manufacturedAt={lots.data?.get(viewed.lotId)?.manufacturedAt ?? null}
              expiryDate={lots.data?.get(viewed.lotId)?.expiryDate ?? null}
              onDismiss={() => {
                setViewKey(null);
              }}
            />
          )}
          {keypad === null ? null : (
            <DockedNumberPad
              head={t.contents.qtyLabel(nameOf(keypad.line))}
              fieldId={qtyFieldId(keypad.line.key)}
              value={keypad.line.qty}
              onChange={(next) => {
                setQty(keypad.line.key, next);
              }}
              onClose={() => {
                setKeypadFor(null);
              }}
              move={{
                canPrevious: keypad.at > 0,
                canNext: keypad.at < lines.length - 1,
                onPrevious: () => {
                  setKeypadFor(lines[keypad.at - 1]?.key ?? null);
                },
                onNext: () => {
                  setKeypadFor(lines[keypad.at + 1]?.key ?? null);
                },
                previousLabel: t.contents.previousLine,
                nextLabel: t.contents.nextLine,
              }}
              allowDecimal
            />
          )}
        </>
      )}
    </div>
  );
};
