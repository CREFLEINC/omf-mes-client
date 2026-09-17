import { AlertBanner, Button, Chip, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { PopSelect as Select } from '../../patterns/pop-select';
import { toApiError } from '../../patterns/request';
import { ShippingPackingLabelScreen } from '../shipping-packing-label/screen';

import { AutomaticLabels, type AutomaticLabelRun } from './automatic-labels';
import { confirmLockReason } from './confirm-lock';
import { ContentsTable } from './contents-table';
import { soleProcessIdOf } from '../../patterns/pop-identity';
import { usePackingIdentity } from './entry-context';
import {
  HANDLING_UNIT_CANCEL_NOT_READY_MESSAGE,
  useHandlingUnitCancel,
  useHandlingUnitCreate,
  usePackingConfirm,
  type OpenHandlingUnit,
} from './mutations';
import { addLine, lineOf, qtyError, remainingOf, removeLine, toProgress } from './packing-draft';
import {
  useHandlingUnitTypeOptions,
  useUomDecimals,
  useLotScan,
  useShipmentAllocations,
  useShipmentScan,
  useShipmentSelection,
  useTodayShipments,
  useUnassignedPackedBoxCount,
} from './queries';
import { ScanField } from './scan-field';
import { useTerminalGate } from './terminal-gating';
import type { MatchedLot, PackedLine, ShipmentEntry, ShipmentLotAllocation } from './types';
import { useOnline } from './use-online';

const t = messages.packingResult;

/**
 * P-04-01 · Packing(P&P) 실적 등록 — **POP 1024×768 터치**.
 *
 * ⭐ **매칭 스캔 화면이다.** 두 개를 읽어 **같은 것인지 서버에 묻는다** — 납품라벨이 어느
 * 출하인지 정하고(①), 그 출하에 이 생산LOT 이 배분돼 있는지 판정받는다(②).
 * ⛔ **화면이 판정하지 않는다**(공유계약 C-6) — 배분 목록을 받아 비교하면 캐시 상태에서 틀린다.
 *
 * ⛔ **온라인 전용이다.** 판정이 서버에 있으므로 끊긴 상태에서는 확정을 막는다(§6).
 *
 * ⚠ **단말·공정·사번은 셸이 채운다**(`patterns/pop-identity`). 그 자리가 아직 비어 있어
 * 당분간은 주소로도 받는다(`entry-context`) — 어느 쪽에서도 오지 않으면 화면은 「단말이
 * 확인되지 않았습니다」로 막힌 채 뜬다. 모르는 것을 통과로 처리하지 않는다.
 */
/** 하단에 적지 않는 «안내» 사유 — 확정 잠금 판정에는 그대로 쓰인다. */
const HIDDEN_LOCK_REASONS: ReadonlySet<string> = new Set([
  t.locks.shipmentMissing,
  t.locks.workerMissing,
  t.locks.noType,
  t.locks.noContents,
  t.locks.unitOpening,
  t.locks.gateChecking,
]);

export const PackingResultScreen = () => {
  const titleId = useId();
  const typeLabelId = useId();
  const shipmentLabelId = useId();
  const identity = usePackingIdentity();
  const isOnline = useOnline();
  const gate = useTerminalGate(identity.terminalId, soleProcessIdOf(identity.processes));

  /** ① 이 라벨이 정한 출하. 둘째 스캔의 질의 축이며 **첫 스캔 응답에서 그대로 온다**. */
  const [label, setLabel] = useState<ShipmentLotAllocation | null>(null);
  const [entry, setEntry] = useState<ShipmentEntry | null>(null);
  /**
   * 읽은 납품라벨 «코드» 그대로. 설계 §3 도면이 ① 상자 오른쪽에 `DL-2026-0455-001` 을 세워
   * 두었다 — 칸은 읽고 나면 스스로 비우므로, 남겨 두지 않으면 **무엇을 읽었는지 확인할 길이
   * 없다.** ② 의 판정이 「이 납품라벨의 LOT 이 맞다」인데 그 납품라벨이 안 보이면 판정을
   * 대조할 수 없다.
   */
  const [labelCode, setLabelCode] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<'shipment' | 'open-unit' | null>(null);
  /** ② 마지막 판정. 담은 뒤에도 남겨 둔다 — 방금 읽은 것이 무엇이었는지가 사라지면 안 된다. */
  const [matched, setMatched] = useState<MatchedLot | null>(null);
  const [lines, setLines] = useState<PackedLine[]>([]);
  const [qty, setQty] = useState('');
  const [handlingUnitTypeCode, setHandlingUnitTypeCode] = useState('');
  /**
   * 담는 동안 열려 있는 포장. **번호는 서버가 매기므로 먼저 만들어야 ③ 구획에 설 수 있다**
   * (스펙 §3). 확정이 이 포장을 닫는다.
   */
  const [openUnit, setOpenUnit] = useState<OpenHandlingUnit | null>(null);
  const [confirmedNo, setConfirmedNo] = useState<string | null>(null);
  const [automaticLabelRun, setAutomaticLabelRun] = useState<AutomaticLabelRun | null>(null);
  const [isLabelComplete, setLabelComplete] = useState(false);
  const [isLabelMode, setLabelMode] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const shipmentScan = useShipmentScan();
  const shipmentSelection = useShipmentSelection();
  const todayShipments = useTodayShipments();
  const lotScan = useLotScan();
  const typeOptions = useHandlingUnitTypeOptions();
  /* 소수점 키는 **담을 LOT 의 단위**가 정한다 — 개수로 세는 자재에는 그리지 않는다. */
  const allowsDecimal = useUomDecimals();
  const shipmentId = entry?.shipmentId ?? label?.shipmentId ?? null;
  const warehouseId = label?.warehouseId ?? null;
  const shipmentAllocations = useShipmentAllocations(shipmentId);
  const progress = toProgress(shipmentAllocations.allocations);
  /*
   * ⭐ **다음 걸음이 남았는지 여기서 말한다**(SHIP-UNIT-01 §7). 포장을 마친 담당은 이 화면을
   *    떠나기 전에 「출하 단위에 담을 상자가 남았나」를 알아야 한다 — 모르면 P-04-05 를 아예
   *    열지 않고, 상자는 구성되지 않은 채 남는다.
   */
  const unassignedBoxes = useUnassignedPackedBoxCount(shipmentId, entry?.shipmentNo ?? null);
  /*
   * ⛔⛔ **`ShipmentLotAllocation.shippingInspectionStatusCode` 는 목표 선택 필드다**.
   * 현행 서버는 다섯 상태값(`NOT_REQUIRED`·`PENDING`·`PASSED`·`REJECTED`·`HELD`)
   * 중 어느 것도 배분 응답에 아직 싣지 않는다.
   * 남은 것은 `oqcPassed`(불리언)뿐인데, 계약이 「검사 대상이 아닌 배분도 true 로 내린다」고
   * 못박아 **`NOT_REQUIRED` 와 `PASSED` 를 한 값으로 묶는다** — 그 값으로 다섯 상태 중 하나를
   * 되짚으면 실제로는 「대기·불합격·보류」였던 배분이 「합격」처럼 보일 수 있다(추측 금지).
   * 그래서 상태 «문구»는 지어내지 않고 이미 있던 「모른다」 표시(`—`)로 떨어진다.
   *
   * ⭐ **이 값이 무엇도 막지 않는다.** 한때 납품 라벨 발행 자격이 `oqcPassed` 였는데, 라벨의
   * 주인이 출하 단위로 옮겨가며 자격도 **출하 단위의 마감 여부**가 됐다(SHIP-UNIT-01 P5 ·
   * `shipping-packing-label/types.ts` 의 `toDeliveryRow`). 이 줄은 «표시»만 남았고 그 표시도
   * 지어내지 않는다 — 서버가 상태값을 다시 내리면 이 자리만 되돌리면 된다.
   */
  const oqcStatuses = shipmentAllocations.allocations.length > 0 ? ['—'] : [];

  const createUnit = useHandlingUnitCreate();
  const cancelUnit = useHandlingUnitCancel();

  const confirm = usePackingConfirm({
    shipmentId,
    onSuccess: (handlingUnit) => {
      const packedAllocations = shipmentAllocations.allocations.filter((allocation) =>
        lines.some((line) => line.shipmentLotAllocationId === allocation.shipmentLotAllocationId),
      );
      setLabelComplete(false);
      setAutomaticLabelRun({
        handlingUnit,
        allocations: packedAllocations,
        shipmentNo: entry?.shipmentNo ?? null,
      });
      /* 확정하면 이 포장은 끝났다 — 다음 포장을 위해 담긴 것을 비우되 라벨은 남긴다(같은 출하를 계속 싼다). */
      setLines([]);
      setMatched(null);
      setQty('');
      /* 이 포장은 닫혔다 — 다음 포장은 새로 만든다. */
      setOpenUnit(null);
      setConfirmedNo(handlingUnit.handlingUnitNo);
    },
  });

  const applyEntry = (next: ShipmentEntry): void => {
    setEntry(next);
    setLabel(next.allocations[0] ?? null);
    setLabelCode(next.shipmentNo);
    setEntryError(null);
    setMatched(null);
    setLines([]);
    setAutomaticLabelRun(null);
  };

  /**
   * 새 출하 조회를 시작하는 순간 이전 출하 문맥을 폐기한다. 조회 실패 뒤에도 이전 출하의 LOT을
   * 계속 담을 수 있으면 화면에 읽힌 값과 쓰기 대상이 달라진다. 다만 열린 포장은 서버 자원이므로
   * 화면 상태만 버리지 않고 명시적 취소가 성공할 때까지 전환 자체를 막는다.
   */
  const prepareEntryChange = (): boolean => {
    if (openUnit !== null) {
      setEntryError('open-unit');

      return false;
    }

    setEntry(null);
    setLabel(null);
    setLabelCode(null);
    setEntryError(null);
    setMatched(null);
    setLines([]);
    setQty('');
    setAutomaticLabelRun(null);

    return true;
  };

  const scanShipment = (shipmentNo: string): void => {
    const isSameEntry = entry?.shipmentNo === shipmentNo;
    if (!isSameEntry && !prepareEntryChange()) return;

    setConfirmedNo(null);
    shipmentScan.mutate(shipmentNo, {
      onSuccess: (outcome) => {
        if (outcome === null) {
          setEntryError('shipment');
          return;
        }

        applyEntry(outcome);
      },
    });
  };

  const scanLot = (code: string): void => {
    if (shipmentId === null) return;

    setConfirmedNo(null);
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
   *
   * ⛔ 유형만 골랐을 때 만들지 않는다. 고르기만 하고 그만두면 빈 포장이 남고, 이 화면에는
   * 그것을 되돌릴 조작이 없다(§5-6 포장 해체 없음).
   */
  const ensureOpenUnit = (nextLines: readonly PackedLine[], typeCode: string): void => {
    if (openUnit !== null || createUnit.isPending) return;
    if (typeCode === '' || nextLines.length === 0 || warehouseId === null) return;
    if (identity.workerNo === null) return;

    createUnit.mutate(
      {
        handlingUnitTypeCode: typeCode,
        warehouseId,
        workerNo: identity.workerNo,
      },
      { onSuccess: setOpenUnit },
    );
  };

  const addToPacking = (): void => {
    if (packable === undefined || qtyIssue !== undefined) return;

    const outcome = addLine(lines, packable, Number(qty));

    setLines(outcome.lines);
    ensureOpenUnit(outcome.lines, handlingUnitTypeCode);
    setQty('');
    /*
     * ⭐ 합친 사실을 문장으로 적지 않는다 — 「기존 N 에 M 을 더해 K 이 됩니다」를 걷었다(사용자 지시
     *    2026-09-17). 합친 수량은 담긴 줄의 수량이 바로 보여 준다. ⚠ 스펙 §7 「변경 전후 표시」와 다르다.
     */
  };

  const hasWorkerNo = identity.workerNo !== null && identity.workerNo.trim() !== '';

  const lockReason = confirmLockReason({
    isOnline,
    gate: gate.verdict,
    workerNo: identity.workerNo,
    shipmentId,
    warehouseId,
    hasOpenUnit: openUnit !== null,
    isOpeningUnit: createUnit.isPending,
    handlingUnitTypeCode,
    lines,
  });

  const matchMessage = ((): { tone: 'success' | 'error'; text: string } | null => {
    if (entryError === 'open-unit') {
      return { tone: 'error', text: t.match.openUnitBlocksShipmentChange };
    }
    if (entryError === 'shipment') return { tone: 'error', text: t.match.shipmentNotFound };
    if (lotScan.isError) return { tone: 'error', text: t.match.lookupFailed };
    if (matched === null) return null;
    if (matched.verdict.matched) {
      return { tone: 'success', text: t.match.ok(matched.allocation?.lotNo ?? '') };
    }

    switch (matched.verdict.reasonCode) {
      case 'LABEL_ITEM_MISMATCH':
        /* 문구의 품목 코드는 **계약이 내려 준 값**이다 — 화면이 코드→이름 대응을 갖지 않는다. */
        return {
          tone: 'error',
          text: t.match.itemMismatch(matched.allocation?.itemCode ?? label?.itemCode ?? ''),
        };
      case 'LOT_NOT_ALLOCATED':
        return { tone: 'error', text: t.match.notAllocated };
      default:
        return { tone: 'error', text: t.match.unknownReason };
    }
  })();

  return (
    <main
      className={`packing-shell pop-ui${isLabelMode ? ' packing-shell--labels' : ''}`}
      aria-labelledby={titleId}
    >
      {/* 헤더 64 — 「무엇을」이 왼쪽, 「어디서·누가」가 오른쪽이다(스펙 §3). */}
      <header className="pop-header">
        <h1 className="pop-title" id={titleId}>
          {t.title}
        </h1>
        {/*
         * ⛔ **읽기 전에는 이 자리를 비운다**(사용자 지시 2026-09-07). 「납품라벨을 읽으면
         *    어느 출하인지 표시됩니다」로 채우고 있었는데 설계에 없는 문장이고, 바로 아래
         *    ① 상자가 「납품라벨」 칸으로 같은 말을 이미 하고 있다.
         */}
        {shipmentId !== null && (
          <p className="pop-context">
            {/*
             * ⛔⛔ **`ShipmentLotAllocation.shipmentRequestNo`·`customerName` 이 계약에서
             * 빠졌다**(생성 타입 · 2026-09-11 전달본 — 둘 다 어느 스키마에도 없다). 「출하요청
             * 번호 · 고객명」맥락을 화면이 지어낼 수 없다(추측 금지) — 이미 있던 「모른다」
             * 표시(`t.header.shipment(shipmentId)`)로 늘 떨어진다. 서버가 두 값을 다시
             * 내리면 이 자리만 되돌리면 된다.
             */}
            {t.header.shipment(shipmentId)}
          </p>
        )}
        {/*
         * ⛔ **사번과 연결을 한 표식에 묶지 않는다.** 사번을 담은 칩의 «색»으로 온·오프를
         *    말하고 있었다 — 연결이 끊기면 사번 칩이 붉어져 «사번이 잘못된 것»처럼 보이고,
         *    정작 연결 상태는 색 말고 아무 데도 적히지 않는다. 다른 POP 화면과 같이 둘로
         *    갈라 세운다(설계 §3 머리줄도 「박출하  ●온」 둘이다).
         */}
        {/*
         * ⛔ **라벨은 머리줄의 일이 아니다**(사용자 지적 2026-09-10 · 새 도면). 도면의 머리줄은
         *   「작업자 · 연결상태 · 화면 이동 · 사용자 전환」이고, 라벨 상태·재출력은 «액션 줄»의
         *   일이다. 머리줄에 두면 화면을 바꾸는 조작이 상태 표시들 사이에 섞인다.
         */}
        <div className="pop-context-right">
          <PopWorkerTag workerNo={identity.workerNo} />
          <Chip variant="status" size="md" status={isOnline ? 'success' : 'error'}>
            {isOnline ? t.header.online : t.header.offline}
          </Chip>
        </div>
      </header>

      {isLabelMode ? (
        <ShippingPackingLabelScreen embedded shipmentId={shipmentId} workerNo={identity.workerNo} />
      ) : null}

      {/*
       * 본문 616 — ① 88 + ② 88 + ③ 320 + ④ 88 (스펙 §3-1 세로 예산 · 슬랙 0).
       * ⛔ 구획을 좌우로 펴지 않는다 — 스캔이 «순서»이기 때문이다. 위에서 아래로 읽는 차례가
       * 곧 작업 순서이고, 좌우로 나누면 ①과 ②의 선후가 사라진다.
       */}
      <div className="packing-body">
        {/*
         * ⭐ 사번을 확인하지 못했으면 맨 위에 아이콘 띠로 알린다(사용자 지시 2026-09-17). 하단
         *    잠금 사유 줄에서는 뺀다 — 같은 말을 두 번 하지 않는다.
         *
         * ⛔ 「출하대상을 선택하세요」 띠는 세우지 않는다(사용자 지시 2026-09-17 — 09-15 판을 걷음).
         */}
        {!isLabelMode && <PopWorkerMissingBanner workerNo={identity.workerNo} />}
        {automaticLabelRun !== null && identity.workerNo !== null ? (
          <AutomaticLabels
            run={automaticLabelRun}
            workerNo={identity.workerNo}
            onOpenManagement={() => {
              setLabelMode(true);
            }}
            onCompleteChange={setLabelComplete}
          />
        ) : null}
        {confirmedNo !== null ? (
          /* ⭐ 자동 라벨 띠가 서면 확정 사실은 그 띠 한 줄이 함께 말한다(사용자 지시 2026-09-17). */
          automaticLabelRun !== null && identity.workerNo !== null && isLabelComplete ? null : (
            <div className="banner-slot">
              <AlertBanner variant="success">{t.confirmed(confirmedNo)}</AlertBanner>
            </div>
          )
        ) : (
          /*
           * ⛔ **정규화 갈래 이름을 그대로 내지 않는다.** 실패를 `conflict`·`stateLocked` 같은
           *   내부 이름으로 적고 있었다 — 작업자에게 그 낱말은 아무것도 말해 주지 않는다.
           *   공용 배너가 갈래마다 「무엇이 어긋났고 다음에 무엇을 할 것인가」를 공통 규약
           *   문구로 옮긴다(`patterns/master/save-error-banner`).
           *
           * ⛔ **「최신 불러오기」를 주지 않는다.** 되돌릴 수 없는 쓰기라(§5-6 포장 해체 없음)
           *   다시 불러올 편집본이 이 화면에 없다 — `onReload` 를 비워 둔다.
           */
          <SaveErrorBanner error={confirm.isError ? toApiError(confirm.error) : null} />
        )}

        {/*
         * ⭐ **출하 대상은 머리줄 바로 아래 «제 줄»에 선다**(사용자 지시 2026-09-10 · 새 도면
         *   「출하 대상 [현재 선택값] [선택]」). 스캔 칸 오른쪽에 붙여 두면 스캔의 곁가지로
         *   읽히는데, 이 화면에서 «무엇을 포장하는가»를 정하는 것이 이 줄이다.
         */}
        <section className="packing-target" aria-label={t.scan.shipmentSelection}>
          <span className="field-label" id={shipmentLabelId}>
            {t.scan.shipmentSelection}
          </span>
          <Select
            aria-labelledby={shipmentLabelId}
            /*
             * ⭐ 사번이 없으면 칸 안 문구 없이 비활성으로만 둔다 — 사유는 맨 위 띠가 말한다(사용자
             *    지시 2026-09-17). 아래 스캔 칸·유형도 같다.
             */
            placeholder={
              !hasWorkerNo
                ? ''
                : todayShipments.isPending
                  ? t.scan.shipmentListLoading
                  : t.scan.todayPickedShipments
            }
            /* ⭐ 사번이 없으면 출하대상부터 못 고른다(사용자 지시 2026-09-17). */
            disabled={!hasWorkerNo || todayShipments.isError || shipmentSelection.isPending}
            value={entry === null ? null : String(entry.shipmentId)}
            onChange={(value) => {
              const selected = todayShipments.shipments.find(
                (shipment) => String(shipment.shipmentId) === value,
              );
              if (selected === undefined) return;
              if (!prepareEntryChange()) return;
              shipmentSelection.mutate(selected, { onSuccess: applyEntry });
            }}
            options={todayShipments.shipments.map((shipment) => ({
              value: String(shipment.shipmentId),
              label: shipment.shipmentNo,
            }))}
          />
        </section>

        {/* ① 출하 선택 — 정확 일치 스캔 또는 현재 영업일 목록. */}
        {/* ⛔ 구획에 칸과 «같은 이름»을 달지 않는다 — 이름이 겹치면 무엇을 가리키는지 흐려진다. */}
        <section className="packing-scan">
          <ScanField
            label={t.scan.label.shipment}
            isScanning={shipmentScan.isPending}
            /*
             * ⭐ 출하가 정해지면 칸 안에 다시 스캔 안내를 적는다(사용자 지시 2026-09-17). 칸이
             *    비어 있으면 출하번호를 한 번 더 넣어야 하는 줄로 읽혔다. 칸은 그대로 둔다 —
             *    다른 출하를 스캔으로 고르는 길이다.
             */
            lockReason={hasWorkerNo ? undefined : ''}
            hint={shipmentId === null ? undefined : t.scan.shipmentChosen}
            onScan={scanShipment}
          />
          {/*
           * ⭐ **읽은 출하번호를 칸 옆에 적지 않는다**(사용자 지시 2026-09-17). 출하 대상 줄에
           *    같은 번호가 이미 있고, 칸 안의 안내가 정해졌음을 말한다. 설계 §3 도면은
           *    칸 옆에 번호를 그렸지만 사용자가 비교 후 뺐다.
           *
           * 빈 자리는 남긴다 — ② 생산LOT 줄과 칸 폭이 같아야 두 줄이 같은 짜임으로 읽힌다.
           */}
          <p className="packing-scanned-code" />
        </section>

        {/* ② 생산LOT 스캔 — 판정 문구가 칸 바로 아래 붙는다. 떨어뜨리면 어느 스캔의 답인지 흐려진다. */}
        <section className="packing-scan">
          <ScanField
            label={t.scan.label.productionLot}
            isScanning={lotScan.isPending}
            autoSubmit
            lockReason={!hasWorkerNo ? '' : shipmentId === null ? t.scan.lotLocked : undefined}
            onScan={scanLot}
          />
          {/*
           * ⭐ 읽은 생산LOT 을 칸 옆에 적지 않는다 — 판정 띠가 번호와 함께 말한다(사용자 지시
           *    2026-09-17). 설계 §3 도면은 칸 옆에 번호를 그렸지만 사용자가 비교 후 뺐다.
           */}
          {/*
           * 판정은 **배너**로 낸다(스펙 §7 DS 매핑 · G-1). 장갑을 낀 작업자가 스캐너에서 눈을
           * 떼는 순간이라 한 줄 글자로는 「맞다·다르다」가 눈에 걸리지 않는다.
           *
           * ⚠ **자리를 늘 비워 둔다.** 판정이 뜰 때마다 아래 구획이 밀리면, 담긴 줄을 누르려던
           * 손가락이 빗나간다 — 터치 화면에서 이 흔들림은 오조작이 된다.
           */}
          <div className="packing-verdict" role="status">
            {matchMessage !== null && (
              <AlertBanner variant={matchMessage.tone === 'success' ? 'success' : 'error'}>
                {matchMessage.text}
              </AlertBanner>
            )}
          </div>
        </section>

        {/* ③ 포장 구성 — 유일한 조정 여지이고, 넘치면 «이 안에서» 스크롤한다(§3-1). */}
        <section className="packing-compose" aria-label={t.panes.packing}>
          <div className="packing-compose-main">
            <div className="packing-compose-head">
              <h2 className="pane-title">{t.panes.packing}</h2>
              {/*
               * 스펙 §3 의 「포장 단위 CTN-…」 자리. **번호는 서버가 매긴다** — 아직 만들어지지
               * 않았으면 그 사실을 적는다. 빈 자리로 두면 번호가 없는 것인지 화면이 덜 그려진
               * 것인지 알 수 없다.
               */}
              {/*
               * 스펙 §3 의 「포장 단위 CTN-…」 자리. ⛔ **아직 없을 때 문장으로 채우지 않는다**
               * (사용자 지적 2026-09-07) — 번호는 담는 순간 서버가 매기므로, 그때까지는 이
               * 자리가 비어 있는 것이 정상이다. 설명을 상시로 두면 표제 옆이 늘 붐빈다.
               */}
              {openUnit !== null && <p className="packing-unit-no">{openUnit.handlingUnitNo}</p>}
              {/* 이름은 칸 «옆»이다(설계 §3 「유형 [ 카톤 ▾ ]」) — 안내 글로만 두면 고른 뒤 사라진다. */}
              <span className="field-label packing-type-label" id={typeLabelId}>
                {t.fields.handlingUnitType}
              </span>
              <Select
                size="xl"
                aria-labelledby={typeLabelId}
                placeholder={hasWorkerNo ? t.fields.typePlaceholder : ''}
                disabled={!hasWorkerNo}
                value={handlingUnitTypeCode === '' ? null : handlingUnitTypeCode}
                onChange={(value) => {
                  const nextType = value ?? '';
                  setHandlingUnitTypeCode(nextType);
                  ensureOpenUnit(lines, nextType);
                }}
                options={typeOptions.options}
              />
              {typeOptions.isUnavailable && <p className="field-note">{t.notes.typeUnavailable}</p>}
            </div>

            <ContentsTable
              lines={lines}
              onRemove={(allocationId) => {
                setLines(removeLine(lines, allocationId));
              }}
            />
          </div>

          {/*
           * 수량 키패드는 ③ 안에서 «옆»에 선다. 스펙 그림에 키패드 자리가 따로 없는데 D-4 는
           * 화면 내장 키패드를 요구한다 — 세로 예산이 슬랙 0 이라 새 구획을 아래에 붙일 수 없어
           * 이 구획의 남는 «가로»를 쓴다.
           *
           * ⛔ **읽기 전에는 이 칸을 세우지 않는다**(사용자 지적 2026-09-10). 앞선 판은 빈 칸을
           *   두고 「생산LOT 을 읽으면 수량을 칠 수 있습니다」로 채웠는데, 스펙에 없는 문장인
           *   데다 그 자리가 늘 ③ 의 가로 절반을 차지해 담긴 줄이 그만큼 좁아졌다.
           */}
          {packable === undefined ? null : (
            <div className="packing-keypad">
              {/*
               * ⭐ **친 값을 여기서 보인다.** DS 키패드는 키만 그리고 버퍼를 보이지 않는다 —
               * 누른 숫자가 어디로 갔는지 보이지 않으면 작업자가 오입력을 눈치채지 못한다.
               * 남은 수량을 옆에 붙여 「얼마까지 칠 수 있는가」를 같은 눈길에 둔다.
               */}
              <p className="packing-qty-readout">
                <span className="packing-qty-caption">{t.qty.entryLabel}</span>
                <span className="packing-qty-value">{qty === '' ? t.qty.entryEmpty : qty}</span>
                <span className="packing-qty-room">{t.qty.room(qtyRoom)}</span>
              </p>
              {/*
               * ⭐ **사번 입력 화면(P-CO-01)과 같은 키패드다**(사용자 지시 2026-09-17) — 같은 부품
               *    (`NumericKeypad`)·같은 키 배열(← 0 지움)·같은 72 높이, 아래에 폭 전체 [확인].
               *    DS `NumberPad` 는 POP 이 높이를 40 으로 눌러 두어 작고 배열도 달랐다.
               *
               * 묶음에 수량 이름을 달아 두어 «키패드와 확인이 한 조작»으로 읽힌다.
               */}
              <div className="packing-keypad-group" role="group" aria-label={t.qty.label}>
                <NumericKeypad
                  value={qty}
                  onChange={setQty}
                  dropLeadingZero
                  allowDecimal={allowsDecimal(packable.uomId)}
                  decimalLabel={t.qty.decimal}
                  className="packing-keypad-pad"
                  label={t.qty.keypad}
                  backspaceLabel={t.qty.backspace}
                  clearLabel={t.qty.clear}
                  keySize="2xl"
                />
                <Button
                  type="button"
                  variant="filled"
                  size="2xl"
                  className="packing-keypad-submit"
                  disabled={qty === '' || qtyIssue !== undefined}
                  onClick={addToPacking}
                >
                  {t.qty.submit}
                </Button>
              </div>
              {/* ⛔ 수량 오류 문구(0 초과·배분 한도)는 적지 않는다 — [확인] 잠김만 둔다(사용자 지시 2026-09-17). */}
            </div>
          )}
        </section>

        {/*
         * ⭐ **OQC 상태는 제 줄이고 늘 선다**(스펙 §3 도면 · 사용자 지적 2026-09-10). ④ 진행
         *   줄에 끼워 두었더니 「포장 N 개 · 미포장 N」과 한 덩어리로 읽혔는데, 이 값은 진행
         *   수치가 아니라 **납품 라벨을 낼 수 있는가를 가르는 게이트**다(§7). 값이 있을 때만 세우면
         *   출하를 고르기 전에는 줄 자체가 없어, 납품 라벨이 무엇에 걸려 있는지 볼 자리가
         *   사라진다. ⛔ 값이 없을 때 문장으로 채우지 않는다 — 자리만 지킨다.
         */}
        <section className="packing-oqc" aria-label={t.oqc.label}>
          <span className="field-label">{t.oqc.label}</span>
          <span>{oqcStatuses.join(' · ')}</span>
        </section>

        {/* ④ 진행 — ⛔ 「예상 N」이 없어 분모가 없다. 진행 막대를 그리지 않는다(§3-3). */}
        <section className="packing-progress" aria-label={t.panes.progress}>
          <span>{t.progress.packed(progress.packedCount)}</span>
          <span>{t.progress.unpacked(progress.unpackedQty)}</span>
          {/*
           * ⛔ **수가 0 이어도 감춘다**가 아니라 **0 도 적는다**(공유계약 G-9) — 「없다」를
           *    보이는 것이 이 줄의 일이다. 못 받았을 때만 다른 말을 한다.
           */}
          {unassignedBoxes.isError ? (
            <span>{t.progress.unassignedUnknown}</span>
          ) : unassignedBoxes.count === null ? null : (
            <span>{t.progress.unassigned(unassignedBoxes.count)}</span>
          )}
        </section>
      </div>

      {/*
       * 액션바 88 — 화면 바닥에 고정한다. 본문이 밀어내면 확정이 화면 밖으로 나간다.
       *
       * ⛔ **라벨 모드에서도 이 줄을 세운다**(E-4 「공통 헤더와 주 액션을 화면 안에 유지한다」).
       *    한때 라벨 모드에서 줄을 통째로 숨겼는데, **되돌아가는 단추가 그 안에 있었다** —
       *    개발용 브라우저는 새로고침으로 빠져나오지만 현장 단말은 주소창이 없어 작업자가
       *    갇혔다(88단계 2회차 실측 · #1092).
       *
       * ⛔ **포장 조작은 라벨 모드에서 세우지 않는다.** [포장 확정]·[다시 스캔]은 라벨 화면에서
       *    누를 일이 없고, 세워 두면 «지금 무엇을 하는 화면인가»가 흐려진다.
       */}
      <div className="packing-actions">
        {/*
         * ⭐ **다음 할 일을 안내하는 사유는 하단에 적지 않는다**(사용자 지시 2026-09-15·09-17) —
         *    출하대상·유형·담기·포장 만드는 중·권한 확인 중. 칸과 단추 상태가 이미 드러낸다. 사번
         *    미확인은 맨 위 경고 띠가 말한다. 막힌 «오류»(연결 끊김·권한 없음·창고 없음·포장 생성
         *    실패)만 남긴다 — 이것까지 지우면 단추가 왜 잠겼는지 알 길이 없다.
         */}
        {!isLabelMode && lockReason !== undefined && !HIDDEN_LOCK_REASONS.has(lockReason) && (
          <p className="packing-lock">{lockReason}</p>
        )}

        {!isLabelMode && gate.verdict === 'unavailable' && (
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => {
              gate.retry();
            }}
          >
            {t.actions.retry}
          </Button>
        )}

        <Button
          type="button"
          variant="outlined"
          size="md"
          /*
           * ⛔ **라벨 모드에서는 잠그지 않는다.** 들어간 뒤 출하 문맥이 사라지면 이 단추가
           *    잠겨 **다시 갇힌다** — 표시를 되살려 놓고 잠금을 남겨 두면 고친 것이 아니다.
           */
          disabled={!isLabelMode && shipmentId === null}
          onClick={() => {
            setLabelMode((current) => !current);
          }}
        >
          {isLabelMode ? t.actions.packing : t.actions.labels}
        </Button>

        {!isLabelMode && openUnit !== null ? (
          <Button
            type="button"
            variant="outlined"
            size="md"
            /*
             * ⛔ **사번이 없으면 잠근다**(#1093). 아래 처리기가 그때 조용히 되돌아왔는데
             *    단추는 열려 있어, 눌러도 아무 일이 없었다. 사유는 위 `lockReason` 이 이미
             *    같은 말로 적고 있다.
             */
            disabled={cancelUnit.isPending || identity.workerNo === null}
            onClick={() => {
              if (identity.workerNo === null) return;
              cancelUnit.mutate(
                { handlingUnitId: openUnit.handlingUnitId, workerNo: identity.workerNo },
                {
                  onSuccess: () => {
                    setOpenUnit(null);
                    setLines([]);
                    setMatched(null);
                    setQty('');
                  },
                },
              );
            }}
          >
            {t.actions.cancelUnit}
          </Button>
        ) : null}

        {/*
         * ⛔⛔ **취소는 지금 늘 거부된다** — `DELETE /inventory/handling-units/{id}` 가 서버에
         * 없다(`mutations.ts` 의 `useHandlingUnitCancel` 머리말 참고). 저장 실패·네트워크
         * 오류로 보이면 사용자가 「다시」를 반복하므로, 사유를 그대로 보여 «아직 지원하지
         * 않는 기능»임을 드러낸다 — 열린 포장은 그대로 남는다.
         */}
        {!isLabelMode && cancelUnit.isError && (
          <p className="packing-lock">{HANDLING_UNIT_CANCEL_NOT_READY_MESSAGE}</p>
        )}

        {/*
         * ⛔ **읽은 것이 없으면 무를 것도 없다.** 아무것도 읽지 않은 채로 열려 있어, 눌러도
         *    아무 일이 없는 단추였다(사용자 지적 2026-09-07). 되돌릴 것이 있을 때만 연다.
         */}
        {!isLabelMode && (
          <>
            <Button
              type="button"
              variant="outlined"
              size="xl"
              className="pop-touch-target"
              disabled={labelCode === null && matched === null}
              onClick={() => {
                /* 「다시 스캔」은 **마지막 스캔을 취소한다** — 담긴 것은 표에서 줄 단위로 뺀다. */
                setMatched(null);
                setQty('');
              }}
            >
              {t.actions.rescan}
            </Button>

            <Button
              type="button"
              variant="filled"
              size="2xl"
              disabled={lockReason !== undefined || confirm.isPending}
              /*
               * ⭐ **누르면 바로 확정하지 않고 먼저 되묻는다**(사용자 지시 2026-09-17). 확정하면
               *    포장 라벨이 곧장 종이로 나가 되돌릴 수 없다. 스펙 §6 에는 없는 팝업이다.
               */
              onClick={() => setConfirmOpen(true)}
            >
              {confirm.isPending ? t.actions.confirming : t.actions.confirm}
            </Button>
          </>
        )}
      </div>

      <Dialog
        open={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t.confirmDialog.title}
        /* ⭐ 스크롤 없이 한 번에 보인다(사용자 지시 2026-09-17) — pop.css `.packing-confirm-dialog`. */
        className="packing-confirm-dialog"
        /* ⛔ 바닥의 [취소]와 같은 일을 하므로 X 를 두지 않는다 — 나가는 길은 하나다. */
        showCloseButton={false}
        /* ⛔ 팝업 바깥을 눌러 닫히지 않는다(사용자 지시 2026-09-10 · #1005) — 터치 단말의 오조작. */
        closeOnBackdropClick={false}
        footer={
          <>
            <Button variant="outlined" onClick={() => setConfirmOpen(false)}>
              {t.confirmDialog.cancel}
            </Button>
            <Button
              disabled={lockReason !== undefined || confirm.isPending}
              onClick={() => {
                setConfirmOpen(false);
                if (
                  lockReason !== undefined ||
                  warehouseId === null ||
                  identity.workerNo === null
                ) {
                  return;
                }

                if (openUnit === null) return;

                confirm.mutate({ handlingUnit: openUnit, lines, workerNo: identity.workerNo });
              }}
            >
              {t.confirmDialog.confirm}
            </Button>
          </>
        }
      >
        {/* ⭐ 이름 아래에 값을 세운다 — 한 줄에 셋을 늘어놓지 않는다(사용자 지시 2026-09-17). */}
        <dl className="filter-bar packing-confirm-summary">
          <div>
            <dt>{t.confirmDialog.shipment}</dt>
            <dd>{entry?.shipmentNo ?? labelCode ?? '—'}</dd>
          </div>
          <div>
            <dt>{t.confirmDialog.type}</dt>
            <dd>
              {typeOptions.options.find((option) => option.value === handlingUnitTypeCode)?.label ??
                '—'}
            </dd>
          </div>
          <div>
            <dt>{t.confirmDialog.contents}</dt>
            <dd>
              {/* 단위가 섞이면 수량을 더하지 않는다 — 다른 단위의 합은 뜻이 없다. */}
              {new Set(lines.map((line) => line.uomId)).size === 1
                ? t.confirmDialog.lotCountWithQty(
                    lines.length,
                    String(lines.reduce((sum, line) => sum + line.qty, 0)),
                  )
                : t.confirmDialog.lotCount(lines.length)}
            </dd>
          </div>
        </dl>
        <p>{t.confirmDialog.labelNotice}</p>
      </Dialog>
    </main>
  );
};
