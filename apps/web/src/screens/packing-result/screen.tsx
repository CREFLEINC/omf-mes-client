import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { soleProcessIdOf } from '../../patterns/pop-identity';
import {
  PuActionBar,
  PuBand,
  PuButton,
  PuChip,
  PuCols,
  PuConfirm,
  PuEmpty,
  PuField,
  PuFlow,
  PuInput,
  PuKeypad,
  PuKv,
  PuNote,
  PuPager,
  PuRemoveButton,
  PuScanField,
  PuScreen,
  PuSection,
  PuTiles,
  applyKeypadKey,
  puCx,
  puToast,
  useClientPage,
  useFitCount,
} from '../../patterns/pop-uniform';
import { toApiError } from '../../patterns/request';
import { ShippingPackingLabelScreen } from '../shipping-packing-label/screen';

import { AutomaticLabels, type AutomaticLabelRun } from './automatic-labels';
import { confirmLockReason } from './confirm-lock';
import { usePackingIdentity } from './entry-context';
import {
  HANDLING_UNIT_CANCEL_NOT_READY_MESSAGE,
  useHandlingUnitCancel,
  useHandlingUnitCreate,
  usePackingConfirm,
  type OpenHandlingUnit,
} from './mutations';
import {
  addLine,
  lineOf,
  nextHandlingUnitTypeCode,
  qtyError,
  remainingOf,
  removeLine,
} from './packing-draft';
import {
  useHandlingUnitTypeOptions,
  useLotScan,
  useShipmentAllocations,
  useShipmentSelection,
  useTodayShipments,
  useUnassignedPackedBoxCount,
  useUomCodes,
  useUomDecimals,
} from './queries';
import { useTerminalGate } from './terminal-gating';
import type { MatchedLot, PackedLine, ShipmentEntry, ShipmentLotAllocation } from './types';
import { useOnline } from './use-online';
import './uniform.css';

const t = messages.packingResult;

/**
 * P-04-01 · 출하 포장 — **POP 터치**, 본문은 POP 통일 시안(#295)의 3단계다.
 *
 * ① 출하 대상(카드 목록) → ② 포장 유형 · 생산 LOT 스캔 · 줄마다 수량(오른쪽 키패드) → ③ 포장 내용 확인.
 *
 * ⭐ **매칭 화면이다.** 생산LOT 이 고른 출하에 배분돼 있는지 **서버에 묻는다**.
 * ⛔ **화면이 판정하지 않는다**(공유계약 C-6) — 배분 목록을 받아 비교하면 캐시 상태에서 틀린다.
 * ⛔ **온라인 전용이다.** 판정이 서버에 있으므로 끊긴 상태에서는 확정을 막는다(§6).
 *
 * ⚠ 스캔한 LOT 은 수량 없이 먼저 줄로 쌓이고(#295 시안), 수량은 그 줄을 눌러 키패드로 넣는다.
 *   같은 LOT 을 다시 찍으면 더하지 않고 「이미 담은 LOT」으로 그 줄을 잡는다. 확정 본문은 종전과 같다.
 */
/** 작업 줄에 적지 않는 «안내» 사유 — 확정 잠금 판정에는 그대로 쓰인다. */
const HIDDEN_LOCK_REASONS: ReadonlySet<string> = new Set([
  t.locks.shipmentMissing,
  t.locks.workerMissing,
  t.locks.noType,
  t.locks.noContents,
  t.locks.unitOpening,
  t.locks.gateChecking,
]);

/**
 * 확정 때 포장 만들기가 실패한 것을 안내 자리에 올릴 모양 — **서버 원문을 떼고 상태 코드만 남긴다**
 * (사용자 지시 2026-09-18 · omf-all-around#5).
 */
const withoutServerText = (error: ApiError): ApiError =>
  error.kind !== 'network' && error.status !== undefined
    ? { kind: 'http', status: error.status }
    : error;

type Step = 1 | 2 | 3;

const fmt = (value: number): string => value.toLocaleString();

export const PackingResultScreen = () => {
  const identity = usePackingIdentity();
  const isOnline = useOnline();
  const gate = useTerminalGate(identity.terminalId, soleProcessIdOf(identity.processes));

  const [step, setStep] = useState<Step>(1);
  /** ① 고른 출하의 첫 배분. 창고·질의 축이 여기서 온다. */
  const [label, setLabel] = useState<ShipmentLotAllocation | null>(null);
  const [entry, setEntry] = useState<ShipmentEntry | null>(null);
  const [entryError, setEntryError] = useState<'open-unit' | null>(null);
  /** ② 마지막 판정. 담은 뒤에도 남겨 둔다 — 방금 읽은 것이 무엇이었는지가 사라지면 안 된다. */
  const [matched, setMatched] = useState<MatchedLot | null>(null);
  const [scanValue, setScanValue] = useState('');
  const [shipmentScan, setShipmentScan] = useState('');
  const [shipmentScanMiss, setShipmentScanMiss] = useState<string | null>(null);
  const [lines, setLines] = useState<PackedLine[]>([]);
  const [qty, setQty] = useState('');
  const [handlingUnitTypeCode, setHandlingUnitTypeCode] = useState('');
  /** 담는 동안 열려 있는 포장. 번호는 서버가 매긴다(스펙 §3). 확정이 이 포장을 닫는다. */
  const [openUnit, setOpenUnit] = useState<OpenHandlingUnit | null>(null);
  const [automaticLabelRun, setAutomaticLabelRun] = useState<AutomaticLabelRun | null>(null);
  const [isLabelMode, setLabelMode] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const shipmentSelection = useShipmentSelection();
  const todayShipments = useTodayShipments();
  const lotScan = useLotScan();
  const typeOptions = useHandlingUnitTypeOptions();
  /**
   * 열리면 **첫 유형이 이미 골라져 있다**(사용자 지시 2026-09-18). 목록이 «도착한 뒤»에 채우고,
   * 고른 값은 덮지 않는다(`nextHandlingUnitTypeCode`). 순서는 서버가 준 그대로다.
   */
  const firstTypeCode = typeOptions.options[0]?.value;

  useEffect(() => {
    if (firstTypeCode === undefined) return;

    setHandlingUnitTypeCode((prev) => nextHandlingUnitTypeCode(prev, firstTypeCode));
  }, [firstTypeCode]);
  /* 소수점 키는 **담을 LOT 의 단위**가 정한다 — 개수로 세는 자재에는 켜지 않는다. */
  const allowsDecimal = useUomDecimals();
  const uomCodeOf = useUomCodes();
  const shipmentId = entry?.shipmentId ?? label?.shipmentId ?? null;
  const warehouseId = label?.warehouseId ?? null;
  const shipmentAllocations = useShipmentAllocations(shipmentId);
  /* ⭐ 다음 걸음(P-04-05)이 남았는지 — 미구성 상자는 서버가 센다(SHIP-UNIT-01 §7). */
  const unassignedBoxes = useUnassignedPackedBoxCount(shipmentId, entry?.shipmentNo ?? null);
  const createUnit = useHandlingUnitCreate();
  const cancelUnit = useHandlingUnitCancel();
  /* 확정이 그 자리에서 포장을 만들다 실패한 것 — 확정 실패와 같은 안내 자리에 올린다(omf-all-around#5). */
  const [unitCreateError, setUnitCreateError] = useState<Error | null>(null);

  const typeLabelOf = (code: string): string =>
    typeOptions.options.find((option) => option.value === code)?.label ?? '';

  const confirm = usePackingConfirm({
    shipmentId,
    onSuccess: (handlingUnit) => {
      const packedAllocations = shipmentAllocations.allocations.filter((allocation) =>
        lines.some((line) => line.shipmentLotAllocationId === allocation.shipmentLotAllocationId),
      );
      setAutomaticLabelRun({
        handlingUnit,
        allocations: packedAllocations,
        shipmentNo: entry?.shipmentNo ?? null,
      });
      /* 확정하면 이 포장은 끝났다 — 같은 출하·유형으로 ② 에 돌아와 다음 포장을 시작한다. */
      setLines([]);
      setMatched(null);
      setQty('');
      setOpenUnit(null);
      setUnitCreateError(null);
      setStep(2);
      puToast(t.confirmed(handlingUnit.handlingUnitNo));
    },
  });

  const applyEntry = (next: ShipmentEntry): void => {
    setEntry(next);
    setLabel(next.allocations[0] ?? null);
    setEntryError(null);
    setMatched(null);
    setLines([]);
    setAutomaticLabelRun(null);
  };

  /**
   * 새 출하 조회를 시작하는 순간 이전 출하 문맥을 폐기한다. 다만 열린 포장은 서버 자원이므로
   * 명시적 취소가 성공할 때까지 전환 자체를 막는다.
   */
  const prepareEntryChange = (): boolean => {
    if (openUnit !== null) {
      setEntryError('open-unit');

      return false;
    }

    setEntry(null);
    setLabel(null);
    setEntryError(null);
    setMatched(null);
    setLines([]);
    setQty('');
    setAutomaticLabelRun(null);

    return true;
  };

  const shipBoxRef = useRef<HTMLDivElement>(null);
  const shipFit = useFitCount(shipBoxRef, { fallback: 4 });
  const shipPage = useClientPage(todayShipments.shipments, shipFit);

  /** 출하 하나를 골랐다. ⚠ 이미 고른 것을 다시 고르면 아무것도 하지 않는다(담던 것을 지킨다). */
  const chooseShipment = (selectedId: number): void => {
    const selected = todayShipments.shipments.find(
      (shipment) => shipment.shipmentId === selectedId,
    );
    if (selected === undefined) return;
    if (entry?.shipmentId === selected.shipmentId) return;
    if (!prepareEntryChange()) return;

    shipmentSelection.mutate(selected, { onSuccess: applyEntry });
  };

  /**
   * 출하를 찍어서 고른다 — 받아 둔 오늘 목록 안에서 번호가 «정확히» 같은 것만(종전 고르기 창의
   * 스캔과 같은 규칙: 앞뒤 공백·대소문자 무시). ⛔ 서버를 다시 부르지 않는다.
   */
  const scanShipment = (code: string): void => {
    setShipmentScan('');
    const wanted = code.trim().toLocaleLowerCase('ko-KR');
    const found = todayShipments.shipments.find(
      (shipment) =>
        shipment.shipmentNo.trim().toLocaleLowerCase('ko-KR') === wanted ||
        String(shipment.shipmentId).toLocaleLowerCase('ko-KR') === wanted,
    );
    if (found === undefined) {
      setShipmentScanMiss(code);
      return;
    }
    setShipmentScanMiss(null);
    chooseShipment(found.shipmentId);
    shipPage.showIndex(todayShipments.shipments.indexOf(found));
  };

  const scanLot = (code: string): void => {
    setScanValue('');
    if (shipmentId === null) return;

    lotScan.mutate(
      { shipmentId, code },
      {
        onSuccess: (outcome) => {
          setMatched(outcome);
          setQty('');
        },
      },
    );
  };

  /** 담을 수 있는 배분 — **판정이 «맞다»일 때만** 선다. */
  const packable = matched?.verdict.matched === true ? matched.allocation : undefined;
  const qtyIssue = packable === undefined ? undefined : qtyError(qty, packable, lines);
  /** 이 배분에 아직 더 칠 수 있는 수량 — 잔여에서 «이미 담은 줄»을 뺀 값이다(`qtyError` 와 같은 한도). */
  const qtyRoom =
    packable === undefined
      ? 0
      : remainingOf(packable) - (lineOf(lines, packable.shipmentLotAllocationId)?.qty ?? 0);

  /**
   * 아직 포장이 없으면 만든다 — **담을 것과 유형이 정해진 뒤 한 번**.
   * ⛔ 유형만 골랐을 때 만들지 않는다. 고르기만 하고 그만두면 빈 포장이 남는다(§5-6 포장 해체 없음).
   */
  const ensureOpenUnit = (nextLines: readonly PackedLine[], typeCode: string): void => {
    if (openUnit !== null || createUnit.isPending) return;
    if (typeCode === '' || nextLines.length === 0 || warehouseId === null) return;
    if (identity.workerNo === null) return;

    createUnit.mutate(
      { handlingUnitTypeCode: typeCode, warehouseId, workerNo: identity.workerNo },
      { onSuccess: setOpenUnit },
    );
  };

  const rowsBoxRef = useRef<HTMLDivElement>(null);
  const rowsFit = useFitCount(rowsBoxRef, { fallback: 3 });
  const rowsPage = useClientPage(lines, rowsFit);

  /** [담기] — 같은 배분이 이미 있으면 수량을 더한다(`addLine`). */
  const addToPacking = (): void => {
    if (packable === undefined || qtyIssue !== undefined) return;

    const outcome = addLine(lines, packable, Number(qty));

    setLines(outcome.lines);
    ensureOpenUnit(outcome.lines, handlingUnitTypeCode);
    setQty('');
    rowsPage.showIndex(
      outcome.lines.findIndex(
        (line) => line.shipmentLotAllocationId === packable.shipmentLotAllocationId,
      ),
    );
  };

  const hasWorkerNo = identity.workerNo !== null && identity.workerNo.trim() !== '';

  const lockReason = confirmLockReason({
    isOnline,
    gate: gate.verdict,
    workerNo: identity.workerNo,
    shipmentId,
    warehouseId,
    isOpeningUnit: createUnit.isPending,
    handlingUnitTypeCode,
    lines,
  });

  const scanError = ((): string | null => {
    if (lotScan.isError) return t.match.lookupFailed;
    if (matched === null || matched.verdict.matched) return null;

    switch (matched.verdict.reasonCode) {
      case 'LABEL_ITEM_MISMATCH':
        /* 문구의 품목 코드는 **계약이 내려 준 값**이다 — 화면이 코드→이름 대응을 갖지 않는다. */
        return t.match.itemMismatch(matched.allocation?.itemCode ?? label?.itemCode ?? '');
      case 'LOT_NOT_ALLOCATED':
        return t.match.notAllocated;
      default:
        return t.match.unknownReason;
    }
  })();

  /* 단위별 합계 — 단위가 섞이면 단위마다 따로 적는다(다른 단위의 합은 뜻이 없다). */
  const byUom = (value: (line: PackedLine) => number): string => {
    const sums = new Map<number, number>();
    lines.forEach((line) => {
      sums.set(line.uomId, (sums.get(line.uomId) ?? 0) + value(line));
    });

    return [...sums].map(([uomId, sum]) => `${fmt(sum)} ${uomCodeOf(uomId)}`.trim()).join(' · ');
  };
  const qtyOf = (line: PackedLine): number => line.qty;

  const reviewBoxRef = useRef<HTMLDivElement>(null);
  const reviewFit = useFitCount(reviewBoxRef, { fallback: 4 });
  const reviewPage = useClientPage(lines, reviewFit);

  const unassignedText =
    shipmentId === null
      ? '—'
      : unassignedBoxes.isError
        ? t.band.unknown
        : unassignedBoxes.count === null
          ? '—'
          : t.band.boxes(unassignedBoxes.count);
  const bandShipment = { label: t.band.shipment, value: entry?.shipmentNo ?? '—' };
  const bandRest = [
    { label: t.band.unitNo, value: openUnit?.handlingUnitNo ?? '—' },
    { label: t.band.unassigned, value: unassignedText },
  ];

  const canNext =
    step === 1
      ? entry !== null && !shipmentSelection.isPending
      : handlingUnitTypeCode !== '' && lines.length > 0;
  const canConfirm = lockReason === undefined && !confirm.isPending;

  const goStep = (next: Step): void => {
    setEntryError(null);
    setStep(next);
  };

  const shownLockReason =
    lockReason !== undefined && !HIDDEN_LOCK_REASONS.has(lockReason) ? lockReason : null;
  const saveError = confirm.isError
    ? toApiError(confirm.error)
    : unitCreateError !== null
      ? withoutServerText(toApiError(unitCreateError))
      : null;

  const notes = (
    <>
      {!hasWorkerNo && <PuNote tone="warn">{messages.popChrome.workerMissing}</PuNote>}
      {shownLockReason !== null && (
        <PuNote
          tone="bad"
          action={
            gate.verdict === 'unavailable' ? (
              <PuButton
                size="sm"
                onClick={() => {
                  gate.retry();
                }}
              >
                {t.actions.retry}
              </PuButton>
            ) : undefined
          }
        >
          {shownLockReason}
        </PuNote>
      )}
      {cancelUnit.isError && <PuNote tone="bad">{HANDLING_UNIT_CANCEL_NOT_READY_MESSAGE}</PuNote>}
      <SaveErrorBanner error={saveError} />
    </>
  );

  const flow = (
    <PuFlow
      label={t.steps.label}
      current={step - 1}
      steps={[t.steps.shipment, t.steps.scan, t.steps.review].map((name, index) => ({
        label: name,
        done: index < step - 1,
        onGo:
          index < step - 1
            ? () => {
                goStep((index + 1) as Step);
              }
            : undefined,
      }))}
    />
  );

  const shipmentStep = (
    <PuSection head={flow} bodyClassName="pk-body">
      {notes}
      {todayShipments.isError && <PuNote tone="bad">{t.shipments.failed}</PuNote>}
      {/* ⭐ 찍어서도 고른다(#1351) — 받아 둔 목록 안에서만 찾는다. */}
      <PuScanField
        label={t.shipments.scan}
        value={shipmentScan}
        onChange={setShipmentScan}
        onSubmit={scanShipment}
        placeholder={t.shipments.scanPlaceholder}
        disabled={!hasWorkerNo || todayShipments.isError || shipmentSelection.isPending}
        error={shipmentScanMiss === null ? undefined : t.shipments.notFound(shipmentScanMiss)}
      />
      {todayShipments.isPending ? (
        <PuEmpty icon="list" title={t.shipments.loading} />
      ) : todayShipments.shipments.length === 0 && !todayShipments.isError ? (
        <PuEmpty icon="list" title={t.shipments.empty} />
      ) : (
        <div className="pu-list pu-fit pk-fill" ref={shipBoxRef} aria-label={t.shipments.region}>
          {shipPage.items.map((shipment) => {
            const isSelected = entry?.shipmentId === shipment.shipmentId;
            const items = isSelected
              ? [...new Set(entry.allocations.map((allocation) => allocation.itemCode))].join(', ')
              : null;
            const boxes = isSelected
              ? unassignedBoxes.count
              : (shipment.unassignedPackedBoxCount ?? null);

            return (
              <button
                key={shipment.shipmentId}
                type="button"
                className={puCx('pu-item', isSelected && 'is-selected')}
                aria-pressed={isSelected}
                disabled={!hasWorkerNo || shipmentSelection.isPending}
                onClick={() => {
                  chooseShipment(shipment.shipmentId);
                }}
              >
                <span className="pu-item-top">
                  <span className="no">{shipment.shipmentNo}</span>
                  <span className="chips">
                    {isSelected && openUnit !== null && (
                      <PuChip tone="info">{t.shipments.inProgress}</PuChip>
                    )}
                    {isSelected && (
                      <PuChip>{t.shipments.allocations(entry.allocations.length)}</PuChip>
                    )}
                  </span>
                </span>
                <span className="pu-item-sub">
                  {items !== null && items !== '' && (
                    <span>
                      {t.shipments.item} <b>{items}</b>
                    </span>
                  )}
                  {boxes !== null && (
                    <span>
                      {t.shipments.unassigned} <b>{t.band.boxes(boxes)}</b>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="pu-foot">
        <PuPager
          label={t.shipments.region}
          total={shipPage.total}
          page={shipPage.page}
          pages={shipPage.pages}
          onPage={shipPage.setPage}
        />
      </div>
      {entryError === 'open-unit' && (
        <PuNote tone="bad">{t.match.openUnitBlocksShipmentChange}</PuNote>
      )}
    </PuSection>
  );

  const scanStep = (
    <PuCols variant="k2">
      <PuSection head={flow} bodyClassName="pk-body">
        {notes}
        <PuBand label={t.band.label} items={[bandShipment, ...bandRest]} />
        <PuField label={t.fields.handlingUnitType} required className="pk-type">
          <PuTiles
            label={t.fields.handlingUnitType}
            options={typeOptions.options}
            value={handlingUnitTypeCode === '' ? null : handlingUnitTypeCode}
            disabled={!hasWorkerNo}
            onChange={(next) => {
              setHandlingUnitTypeCode(next);
              ensureOpenUnit(lines, next);
            }}
          />
          {typeOptions.isUnavailable && <PuNote tone="warn">{t.notes.typeUnavailable}</PuNote>}
        </PuField>
        <PuScanField
          label={t.scan.productionLot}
          value={scanValue}
          onChange={setScanValue}
          onSubmit={scanLot}
          placeholder={t.scan.placeholder}
          disabled={!hasWorkerNo || shipmentId === null || lotScan.isPending}
          done={matched?.verdict.matched === true && !lotScan.isError}
          error={scanError}
        />
        {lines.length === 0 ? (
          <div className="pk-fill">
            <PuEmpty icon="scan" title={t.rows.empty} hint={t.rows.emptyHint} />
          </div>
        ) : (
          <div
            className="pu-fit pk-rows pk-fill"
            ref={rowsBoxRef}
            role="list"
            aria-label={t.rows.region}
          >
            {rowsPage.items.map((line) => {
              const id = line.shipmentLotAllocationId;
              const uom = uomCodeOf(line.uomId);

              return (
                <div
                  key={id}
                  role="listitem"
                  className={puCx(
                    'pu-item pk-row',
                    packable?.shipmentLotAllocationId === id && 'is-selected',
                  )}
                >
                  <span className="nm" title={line.itemCode}>
                    {line.itemCode}
                  </span>
                  <span className="lot">
                    <span className="pu-mono">{line.lotNo}</span> ·{' '}
                    {t.rows.available(`${fmt(line.remaining)} ${uom}`.trim())}
                  </span>
                  <span className="pk-q" aria-label={t.rows.qtyLabel(line.lotNo)}>
                    {fmt(line.qty)}
                    <small>{uom}</small>
                  </span>
                  <PuRemoveButton
                    label={t.rows.remove}
                    onClick={() => {
                      setLines(removeLine(lines, id));
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="pu-foot">
          {lines.length > 0 && (
            <span className="pk-sum">
              {t.rows.sum(byUom(qtyOf))}
              <span>{t.rows.room(byUom((line) => line.remaining))}</span>
            </span>
          )}
          <PuPager
            label={t.rows.region}
            total={rowsPage.total}
            page={rowsPage.page}
            pages={rowsPage.pages}
            onPage={rowsPage.setPage}
          />
        </div>
      </PuSection>
      <PuSection
        title={t.qty.title}
        meta={packable === undefined ? undefined : t.qty.room(fmt(qtyRoom))}
        split
      >
        <div className="pk-qty-top">
          <PuField label={t.qty.entryLabel}>
            <PuInput
              numeric
              readOnly
              target={packable !== undefined}
              disabled={packable === undefined}
              value={qty}
              placeholder={packable === undefined ? '' : '0'}
              aria-label={t.qty.entryLabel}
            />
          </PuField>
        </div>
        <div className="pk-qty-pad">
          <PuKeypad
            targetLabel={packable === undefined ? null : (packable.lotNo ?? '')}
            decimal={packable !== undefined && allowsDecimal(packable.uomId)}
            onKey={(key) => {
              if (packable === undefined) return;
              const decimal = allowsDecimal(packable.uomId);
              setQty((prev) => applyKeypadKey(prev, key, { decimal }));
            }}
            onClearAll={() => {
              setQty('');
            }}
          />
          {/* ⛔ 수량 오류 문구(0 초과·배분 한도)는 적지 않는다 — [담기] 잠김만 둔다(사용자 지시 2026-09-17). */}
          <PuButton
            variant="primary"
            className="pk-add"
            disabled={packable === undefined || qty === '' || qtyIssue !== undefined}
            onClick={addToPacking}
          >
            {t.qty.submit}
          </PuButton>
        </div>
      </PuSection>
    </PuCols>
  );

  const reviewStep = (
    <PuSection head={flow} bodyClassName="pk-body">
      {notes}
      <PuBand
        label={t.band.label}
        items={[
          bandShipment,
          { label: t.band.type, value: typeLabelOf(handlingUnitTypeCode) || '—' },
          ...bandRest,
        ]}
      />
      <div className="pu-fit pk-lines pk-fill" ref={reviewBoxRef}>
        {reviewPage.items.map((line) => (
          <div key={line.shipmentLotAllocationId} className="pk-line">
            <span className="nm" title={line.itemCode}>
              {line.itemCode}
            </span>
            <span className="lot pu-mono">{line.lotNo}</span>
            <span className="q">{`${fmt(line.qty)} ${uomCodeOf(line.uomId)}`.trim()}</span>
          </div>
        ))}
      </div>
      <div className="pu-foot">
        <PuPager
          label={t.steps.review}
          total={reviewPage.total}
          page={reviewPage.page}
          pages={reviewPage.pages}
          onPage={reviewPage.setPage}
        />
      </div>
      {lines.length > 0 && (
        <div className="pk-total">
          <b>{t.rows.sum(byUom(qtyOf))}</b>
          <span>{t.rows.reviewRoom(byUom((line) => line.remaining))}</span>
        </div>
      )}
    </PuSection>
  );

  const runConfirm = (): void => {
    setConfirmOpen(false);
    if (!canConfirm || warehouseId === null || identity.workerNo === null) return;

    const workerNo = identity.workerNo;

    /*
     * ⭐ **포장이 아직 없으면 여기서 만들고 이어서 담는다**(사용자 지시 2026-09-18 · omf-all-around#5).
     *    생성은 담는 동안과 «같은» 훅을 쓴다 — 보낼 값이 그대로면 앞 시도의 멱등 키를 다시 쓴다.
     */
    if (openUnit !== null) {
      confirm.mutate({ handlingUnit: openUnit, lines, workerNo });
      return;
    }

    confirm.reset();
    setUnitCreateError(null);
    createUnit.mutate(
      { handlingUnitTypeCode, warehouseId, workerNo },
      {
        onSuccess: (handlingUnit) => {
          setOpenUnit(handlingUnit);
          confirm.mutate({ handlingUnit, lines, workerNo });
        },
        onError: setUnitCreateError,
      },
    );
  };

  const cancelOpenUnit = (): void => {
    if (openUnit === null || identity.workerNo === null) return;
    cancelUnit.mutate(
      { handlingUnitId: openUnit.handlingUnitId, workerNo: identity.workerNo },
      {
        onSuccess: () => {
          setOpenUnit(null);
          setLines([]);
          setMatched(null);
          setQty('');
          if (step === 3) setStep(2);
        },
      },
    );
  };

  return (
    <main className="pop-ui packing-uniform">
      {/*
       * 자동 라벨(확정 직후 포장 라벨 발행·인쇄)은 **늘 같은 자리에 붙어 있다** — 라벨 화면을 오가도
       * 다시 서지 않아 같은 포장의 발행이 두 번 나가지 않는다. 라벨 화면에서는 감춰 둔다.
       */}
      <div className="pk-auto" hidden={isLabelMode}>
        {automaticLabelRun !== null && identity.workerNo !== null ? (
          <AutomaticLabels
            /* 포장마다 새로 선다(리뷰 M3) — 두 번째 포장이 첫 포장의 «출력함» 상태를 물려받지 않게. */
            key={automaticLabelRun.handlingUnit.handlingUnitId}
            run={automaticLabelRun}
            workerNo={identity.workerNo}
            onOpenManagement={() => {
              setLabelMode(true);
            }}
          />
        ) : null}
      </div>

      {isLabelMode ? (
        <ShippingPackingLabelScreen
          embedded
          shipmentId={shipmentId}
          workerNo={identity.workerNo}
          onBack={() => {
            setLabelMode(false);
          }}
        />
      ) : (
        <PuScreen
          actionBar={
            <PuActionBar label={t.steps.label}>
              <PuButton
                disabled={shipmentId === null}
                onClick={() => {
                  setEntryError(null);
                  setLabelMode(true);
                }}
              >
                {t.actions.labels}
              </PuButton>
              {openUnit !== null && (
                <PuButton
                  disabled={cancelUnit.isPending || identity.workerNo === null}
                  onClick={cancelOpenUnit}
                >
                  {t.actions.cancelUnit}
                </PuButton>
              )}
              {step > 1 && (
                <PuButton
                  onClick={() => {
                    goStep((step - 1) as Step);
                  }}
                >
                  {t.actions.prev}
                </PuButton>
              )}
              {step < 3 ? (
                <PuButton
                  variant="primary"
                  disabled={!canNext}
                  onClick={() => {
                    goStep((step + 1) as Step);
                  }}
                >
                  {t.actions.next}
                </PuButton>
              ) : (
                <PuButton
                  variant="primary"
                  disabled={!canConfirm}
                  onClick={() => {
                    setConfirmOpen(true);
                  }}
                >
                  {confirm.isPending ? t.actions.confirming : t.actions.confirm}
                </PuButton>
              )}
            </PuActionBar>
          }
        >
          {step === 1 ? shipmentStep : step === 2 ? scanStep : reviewStep}
        </PuScreen>
      )}

      {isConfirmOpen && (
        <PuConfirm
          title={t.confirmDialog.title}
          confirmLabel={t.confirmDialog.confirm}
          confirmDisabled={!canConfirm}
          onCancel={() => {
            setConfirmOpen(false);
          }}
          onConfirm={runConfirm}
        >
          <PuKv
            items={[
              { label: t.confirmDialog.shipment, value: entry?.shipmentNo ?? '—' },
              {
                label: t.confirmDialog.type,
                value: typeLabelOf(handlingUnitTypeCode) || '—',
              },
              {
                label: t.confirmDialog.contents,
                /* 단위가 섞이면 수량을 더하지 않는다 — 다른 단위의 합은 뜻이 없다. */
                value:
                  new Set(lines.map((line) => line.uomId)).size === 1
                    ? t.confirmDialog.lotCountWithQty(lines.length, byUom(qtyOf))
                    : t.confirmDialog.lotCount(lines.length),
              },
            ]}
          />
          <p className="pu-dialog-text">{t.confirmDialog.labelNotice}</p>
        </PuConfirm>
      )}
    </main>
  );
};
