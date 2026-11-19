import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  PuIcon,
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
  type PuIconName,
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
import { addLine, lineOf, nextHandlingUnitTypeCode, qtyError, removeLine } from './packing-draft';
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
import type {
  MatchedLot,
  PackedLine,
  Shipment,
  ShipmentEntry,
  ShipmentLotAllocation,
} from './types';
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
 * ⚠ 스캔한 LOT 은 수량 없이 먼저 줄로 쌓이고(#295 시안), 수량은 그 줄의 수량 칸을 눌러 오른쪽
 *   키패드로 넣는다. 같은 LOT 을 다시 찍으면 더하지 않고 「이미 담은 LOT」으로 그 줄을 잡는다.
 *   확정 본문은 종전과 같다(줄마다 수량 하나).
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

/**
 * 고를 수 없는 출하의 사유 — 확정 잠금(`confirmLockReason`)의 창고 조건과 같은 축이다.
 * 창고는 고른 출하의 첫 미포장 배분에서 오므로(`label`), 미포장 배분이 없으면 그 출하는
 * 확정할 수 없다. ⭐ 목록의 `unpackedLotCount` 로 «처음 그릴 때» 안다(omf-all-around#329) —
 * 아래 고르기 조회 뒤 판정은 그 칸이 없는 옛 서버를 위한 뒷받침이다.
 */
const shipmentBlockReason = (next: ShipmentEntry): string | undefined =>
  next.allocations[0] === undefined ? t.shipments.noLots : undefined;

/** 목록 응답만으로 아는 사유. 칸이 없으면(옛 서버) 모른다 — 고를 때 판정한다. */
const listedBlockReason = (shipment: Shipment): string | undefined =>
  shipment.unpackedLotCount === 0 ? t.shipments.noLots : undefined;

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
  /** 출하 스캔 칸 아래 빨간 한 줄 — 목록에 없는 번호이거나 확정할 수 없는 출하의 사유. */
  const [shipmentScanError, setShipmentScanError] = useState<string | null>(null);
  /** 확정할 수 없다고 확인된 출하(식별자 → 사유). 그 카드는 흐리게 잠긴다. */
  const [blockedShipments, setBlockedShipments] = useState<Record<number, string>>({});
  /**
   * 그 출하의 확정 불가 사유. ⚠ 지금 고른 출하에는 목록 사유를 대지 않는다 — 담는 중에 목록이
   * 다시 읽혀 0 이 되어도 진행 중인 카드를 잠그지 않는다.
   */
  const blockReasonOf = (shipment: Shipment): string | undefined =>
    blockedShipments[shipment.shipmentId] ??
    (entry?.shipmentId === shipment.shipmentId ? undefined : listedBlockReason(shipment));
  const [lines, setLines] = useState<PackedLine[]>([]);
  /** 줄마다 친 수량(배분 식별자 → 키패드 글자). 비어 있으면 아직 넣지 않은 것이다. */
  const [qtys, setQtys] = useState<Record<number, string>>({});
  /** 지금 키패드가 수량을 넣는 줄(배분 식별자). */
  const [activeId, setActiveId] = useState<number | null>(null);
  /** 이미 목록에 있는 LOT 을 다시 찍었다 — 그 코드. */
  const [dupCode, setDupCode] = useState<string | null>(null);
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

  /** 줄 수량·키패드 대상·「이미 담은 LOT」 안내를 함께 비운다 — 줄이 비워질 때마다 부른다. */
  const clearQtys = (): void => {
    setQtys({});
    setActiveId(null);
    setDupCode(null);
  };

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
      clearQtys();
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
    clearQtys();
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
    clearQtys();
    setAutomaticLabelRun(null);

    return true;
  };

  const shipBoxRef = useRef<HTMLDivElement>(null);
  const shipFit = useFitCount(shipBoxRef, { fallback: 4 });
  const shipPage = useClientPage(todayShipments.shipments, shipFit);

  /**
   * 출하 하나를 골랐다. ⚠ 이미 고른 것을 다시 고르면 아무것도 하지 않는다(담던 것을 지킨다).
   * 조회 결과 확정할 수 없는 출하면 고르지 않고 그 카드에 사유를 남긴다 — 찍어서 고른 것이면
   * 스캔 칸 아래에도 사유를 띄운다.
   */
  const chooseShipment = (selectedId: number, fromScan = false): void => {
    const selected = todayShipments.shipments.find(
      (shipment) => shipment.shipmentId === selectedId,
    );
    if (selected === undefined) return;
    if (blockReasonOf(selected) !== undefined) return;
    if (entry?.shipmentId === selected.shipmentId) return;
    if (!prepareEntryChange()) return;

    shipmentSelection.mutate(selected, {
      onSuccess: (next) => {
        const reason = shipmentBlockReason(next);
        if (reason === undefined) {
          applyEntry(next);
          return;
        }
        setBlockedShipments((prev) => ({ ...prev, [next.shipmentId]: reason }));
        if (fromScan) setShipmentScanError(reason);
      },
    });
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
      setShipmentScanError(t.shipments.notFound(code));
      return;
    }
    shipPage.showIndex(todayShipments.shipments.indexOf(found));
    const blockedReason = blockReasonOf(found);
    if (blockedReason !== undefined) {
      setShipmentScanError(blockedReason);
      return;
    }
    setShipmentScanError(null);
    chooseShipment(found.shipmentId, true);
  };

  const scanLot = (code: string): void => {
    setScanValue('');
    if (shipmentId === null) return;

    lotScan.mutate(
      { shipmentId, code },
      {
        onSuccess: (outcome) => {
          setMatched(outcome);
          setDupCode(null);
          const allocation = outcome.verdict.matched ? outcome.allocation : undefined;
          if (allocation === undefined) return;

          const id = allocation.shipmentLotAllocationId;
          /* 이미 담은 LOT — 더하지 않고 그 줄을 잡는다(시안: 목록에서 수량을 고친다). */
          if (lineOf(lines, id) !== undefined) {
            setDupCode(code);
            selectRow(lines, id);
            return;
          }

          /* 수량 없이 줄부터 쌓는다 — 수량은 그 줄 칸에 키패드로 넣는다. */
          const next = addLine(lines, allocation, 0).lines;
          setLines(next);
          ensureOpenUnit(next, handlingUnitTypeCode);
          selectRow(next, id);
        },
      },
    );
  };

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

  /** 그 줄을 키패드 대상으로 잡고 그 줄이 있는 쪽을 보인다. */
  const selectRow = (inLines: readonly PackedLine[], id: number): void => {
    setActiveId(id);
    rowsPage.showIndex(inLines.findIndex((line) => line.shipmentLotAllocationId === id));
  };

  const qtyTextOf = (line: PackedLine): string => qtys[line.shipmentLotAllocationId] ?? '';
  /** 줄 수량 — 아직 넣지 않았으면 0. */
  const qtyOf = (line: PackedLine): number => Number(qtyTextOf(line)) || 0;
  const rowIssue = (line: PackedLine): string | undefined =>
    qtyError(qtyTextOf(line), line, uomCodeOf(line.uomId));
  /** 모든 줄의 수량이 맞는가(비었거나 0 · 포장 가능 수량 초과가 없다). */
  const allQtyValid = lines.every((line) => rowIssue(line) === undefined);
  /** 확정 본문에 실을 줄 — 줄마다 친 수량을 싣는다. */
  const packedLines: PackedLine[] = lines.map((line) => ({ ...line, qty: qtyOf(line) }));
  const activeLine = lines.find((line) => line.shipmentLotAllocationId === activeId);
  /** 줄 아래 빨간 한 줄이 하나라도 있는가 — 한 쪽 건수를 그 높이로 잰다. */
  const hasRowMessage = lines.some(
    (line) => qtyTextOf(line) !== '' && rowIssue(line) !== undefined,
  );

  const hasWorkerNo = identity.workerNo !== null && identity.workerNo.trim() !== '';

  const lockReason = confirmLockReason({
    isOnline,
    gate: gate.verdict,
    workerNo: identity.workerNo,
    shipmentId,
    warehouseId,
    isOpeningUnit: createUnit.isPending,
    handlingUnitTypeCode,
    lines: packedLines,
  });

  const scanError = ((): string | null => {
    if (lotScan.isError) return t.match.lookupFailed;
    if (dupCode !== null) return t.match.alreadyAdded(dupCode);
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
  /* 정보 띠(시안): 이름 앞 빨간 아이콘, 번호는 고정폭 글꼴. */
  const bandLabel = (icon: PuIconName, text: string): ReactNode => (
    <>
      <PuIcon name={icon} />
      {text}
    </>
  );
  const bandShipment = {
    label: bandLabel('list', t.band.shipment),
    value: <span className="pu-mono">{entry?.shipmentNo ?? '—'}</span>,
  };
  const bandRest = [
    {
      label: bandLabel('file', t.band.unitNo),
      value: <span className="pu-mono">{openUnit?.handlingUnitNo ?? '—'}</span>,
    },
    { label: bandLabel('clock', t.band.unassigned), value: unassignedText },
  ];

  const canNext =
    step === 1
      ? entry !== null && !shipmentSelection.isPending
      : handlingUnitTypeCode !== '' && lines.length > 0 && allQtyValid;
  const canConfirm = lockReason === undefined && !confirm.isPending && allQtyValid;

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
        error={shipmentScanError ?? undefined}
      />
      {todayShipments.isPending ? (
        <PuEmpty icon="list" title={t.shipments.loading} />
      ) : todayShipments.shipments.length === 0 && !todayShipments.isError ? (
        <PuEmpty icon="list" title={t.shipments.empty} />
      ) : (
        <div className="pu-list pu-fit pk-fill" ref={shipBoxRef} aria-label={t.shipments.region}>
          {shipPage.items.map((shipment) => {
            const blockedReason = blockReasonOf(shipment);
            if (blockedReason !== undefined) {
              /* 확정 불가 — 고를 수 없다. 왜 못 고르는지 그 자리에서 말한다. */
              return (
                <button
                  key={shipment.shipmentId}
                  type="button"
                  className="pu-item is-dim"
                  aria-pressed={false}
                  disabled
                >
                  <span className="pu-item-top">
                    <span className="no">{shipment.shipmentNo}</span>
                    <span className="chips">
                      <PuChip>{t.shipments.blockedChip}</PuChip>
                    </span>
                  </span>
                  <span className="pu-item-sub">
                    <span>
                      {t.shipments.status} <b>{blockedReason}</b>
                    </span>
                  </span>
                </button>
              );
            }
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
          done={matched?.verdict.matched === true && dupCode === null && !lotScan.isError}
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
              const text = qtyTextOf(line);
              const issue = rowIssue(line);
              const isActive = activeId === id;

              return (
                <div
                  key={id}
                  role="listitem"
                  className={puCx('pu-item pk-row', isActive && 'is-selected')}
                >
                  <span className="nm" title={line.itemCode}>
                    {line.itemCode}
                  </span>
                  <span className="lot">
                    <span className="pu-mono">{line.lotNo}</span> ·{' '}
                    {t.rows.available(`${fmt(line.remaining)} ${uom}`.trim())}
                  </span>
                  {/* 수량은 필수 — 비었거나 맞지 않으면 빨간 테두리, 누르면 키패드가 이 줄로 옮겨 간다. */}
                  <button
                    type="button"
                    className={puCx(
                      'pu-input pk-q',
                      text === '' && 'nil',
                      isActive && 'is-target',
                      issue !== undefined && 'is-need',
                    )}
                    aria-label={t.rows.qtyLabel(line.lotNo)}
                    aria-invalid={issue !== undefined || undefined}
                    onClick={() => {
                      setActiveId(id);
                    }}
                  >
                    {text === ''
                      ? t.rows.qtyPlaceholder
                      : /^\d+$/u.test(text)
                        ? fmt(Number(text))
                        : text}
                    <small>{uom}</small>
                  </button>
                  <PuRemoveButton
                    label={t.rows.remove}
                    onClick={() => {
                      setLines(removeLine(lines, id));
                      setQtys(({ [id]: _removed, ...rest }) => rest);
                      if (isActive) setActiveId(null);
                    }}
                  />
                  {text !== '' && issue !== undefined && <span className="msg">{issue}</span>}
                </div>
              );
            })}
            {/*
             * 줄 아래 빨간 한 줄이 있으면 줄 높이가 달라져 한 쪽 건수가 쪽마다 흔들린다(낮은 줄만 있는 쪽 →
             * 건수 늘림 → 높은 줄이 들어와 다시 줄임). 그 높이의 보이지 않는 줄을 하나 두어 늘 같은 높이로 잰다.
             */}
            {hasRowMessage && (
              <div className="pu-item pk-row pk-probe" aria-hidden="true">
                <span className="nm">&nbsp;</span>
                <span className="lot">&nbsp;</span>
                <span className="pu-input pk-q">&nbsp;</span>
                <span className="msg">&nbsp;</span>
              </div>
            )}
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
        meta={activeLine === undefined ? undefined : t.qty.unit(uomCodeOf(activeLine.uomId))}
        disabled={activeLine === undefined}
      >
        <PuKeypad
          targetLabel={
            activeLine === undefined ? null : <span className="pu-mono">{activeLine.lotNo}</span>
          }
          decimal={activeLine !== undefined && allowsDecimal(activeLine.uomId)}
          /* [전체 삭제]는 키패드 안 맨 아래(← · 0 · 전체 삭제) — 소수 단위 줄은 「.」 키가 필요해 위 줄에 둔다. */
          clearInPad={activeLine === undefined || !allowsDecimal(activeLine.uomId)}
          onKey={(key) => {
            if (activeLine === undefined) return;
            const decimal = allowsDecimal(activeLine.uomId);
            setQtys((prev) => ({
              ...prev,
              [activeLine.shipmentLotAllocationId]: applyKeypadKey(
                prev[activeLine.shipmentLotAllocationId] ?? '',
                key,
                { decimal },
              ),
            }));
          }}
          onClearAll={() => {
            if (activeLine === undefined) return;
            setQtys((prev) => ({ ...prev, [activeLine.shipmentLotAllocationId]: '' }));
          }}
        />
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
          {
            label: bandLabel('box', t.band.type),
            value: typeLabelOf(handlingUnitTypeCode) || '—',
          },
          ...bandRest,
        ]}
      />
      <div className="pu-fit pk-lines pk-fill" ref={reviewBoxRef}>
        {reviewPage.items.map((line) => (
          <div key={line.shipmentLotAllocationId} className="pk-line">
            <span className="mk">
              <PuIcon name="check" />
            </span>
            <span className="nm" title={line.itemCode}>
              {line.itemCode}
            </span>
            <span className="lot pu-mono">{line.lotNo}</span>
            <span className="q">{`${fmt(qtyOf(line))} ${uomCodeOf(line.uomId)}`.trim()}</span>
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
      confirm.mutate({ handlingUnit: openUnit, lines: packedLines, workerNo });
      return;
    }

    confirm.reset();
    setUnitCreateError(null);
    createUnit.mutate(
      { handlingUnitTypeCode, warehouseId, workerNo },
      {
        onSuccess: (handlingUnit) => {
          setOpenUnit(handlingUnit);
          confirm.mutate({ handlingUnit, lines: packedLines, workerNo });
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
          clearQtys();
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
      {/*
       * ⚠ `data-pop-fixed` — `.pop-ui` 바로 아래 블록은 남는 높이를 나눠 갖는다(pop.css). 안내 줄은
       *   제 높이만 쓰고 작업 구획(`.pu-screen`)이 나머지를 채워야 한다(사용자 지적 2026-11-19).
       */}
      <div className="pk-auto" data-pop-fixed hidden={isLabelMode}>
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
              {
                label: t.confirmDialog.shipment,
                value: <span className="pu-mono">{entry?.shipmentNo ?? '—'}</span>,
              },
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
