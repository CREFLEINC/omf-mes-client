import { AlertBanner, Button, Chip, NumberPad, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { toApiError } from '../../patterns/request';

import { confirmLockReason } from './confirm-lock';
import { ContentsTable } from './contents-table';
import { usePackingIdentity } from './entry-context';
import { useHandlingUnitCreate, usePackingConfirm, type OpenHandlingUnit } from './mutations';
import { addLine, lineOf, qtyError, remainingOf, removeLine, toProgress } from './packing-draft';
import {
  useHandlingUnitTypeOptions,
  useLabelScan,
  useLotScan,
  useParentCandidates,
  useShipmentAllocations,
} from './queries';
import { ScanField } from './scan-field';
import { useTerminalGate } from './terminal-gating';
import type { MatchedLot, PackedLine, ShipmentLotAllocation } from './types';
import { useOnline } from './use-online';

const t = messages.packingResult;

/** 상위 포장을 고르지 않은 상태. `Select` 가 문자열만 다루므로 「없음」에 값을 하나 준다. */
const NO_PARENT = '';

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
export const PackingResultScreen = () => {
  const titleId = useId();
  const identity = usePackingIdentity();
  const isOnline = useOnline();
  const gate = useTerminalGate(identity.terminalId, identity.processId);

  /** ① 이 라벨이 정한 출하. 둘째 스캔의 질의 축이며 **첫 스캔 응답에서 그대로 온다**. */
  const [label, setLabel] = useState<ShipmentLotAllocation | null>(null);
  const [labelMissing, setLabelMissing] = useState(false);
  /** ② 마지막 판정. 담은 뒤에도 남겨 둔다 — 방금 읽은 것이 무엇이었는지가 사라지면 안 된다. */
  const [matched, setMatched] = useState<MatchedLot | null>(null);
  const [lines, setLines] = useState<PackedLine[]>([]);
  const [qty, setQty] = useState('');
  const [mergeNote, setMergeNote] = useState<string | null>(null);
  const [handlingUnitTypeCode, setHandlingUnitTypeCode] = useState('');
  /**
   * 담는 동안 열려 있는 포장. **번호는 서버가 매기므로 먼저 만들어야 ③ 구획에 설 수 있다**
   * (스펙 §3). 확정이 이 포장을 닫는다.
   */
  const [openUnit, setOpenUnit] = useState<OpenHandlingUnit | null>(null);
  const [parentId, setParentId] = useState<string>(NO_PARENT);
  const [confirmedNo, setConfirmedNo] = useState<string | null>(null);

  const labelScan = useLabelScan();
  const lotScan = useLotScan();
  const typeOptions = useHandlingUnitTypeOptions();
  const shipmentId = label?.shipmentId ?? null;
  const warehouseId = label?.warehouseId ?? null;
  const parents = useParentCandidates(warehouseId);
  const shipmentAllocations = useShipmentAllocations(shipmentId);
  const progress = toProgress(shipmentAllocations.allocations);

  const createUnit = useHandlingUnitCreate();

  const confirm = usePackingConfirm({
    shipmentId,
    onSuccess: (handlingUnit) => {
      /* 확정하면 이 포장은 끝났다 — 다음 포장을 위해 담긴 것을 비우되 라벨은 남긴다(같은 출하를 계속 싼다). */
      setLines([]);
      setMatched(null);
      setQty('');
      setMergeNote(null);
      setParentId(NO_PARENT);
      /* 이 포장은 닫혔다 — 다음 포장은 새로 만든다. */
      setOpenUnit(null);
      setConfirmedNo(handlingUnit.handlingUnitNo);
    },
  });

  const scanLabel = (code: string): void => {
    setMergeNote(null);
    setConfirmedNo(null);
    labelScan.mutate(code, {
      onSuccess: (outcome) => {
        if (outcome.kind === 'not-found') {
          setLabelMissing(true);
          setLabel(null);

          return;
        }

        setLabelMissing(false);
        setLabel(outcome.allocations[0] ?? null);
        setMatched(null);
      },
    });
  };

  const scanLot = (code: string): void => {
    if (shipmentId === null) return;

    setMergeNote(null);
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
        parentHandlingUnitId: parentId === NO_PARENT ? null : Number(parentId),
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
    /* ⛔ **조용히 합치지 않는다** — 합친 사실을 말하지 않으면 중복 스캔을 알아채지 못한다(§5-3). */
    setMergeNote(
      outcome.merged === undefined
        ? null
        : t.qty.merged(outcome.merged.before, outcome.merged.added, outcome.merged.after),
    );
  };

  const lockReason = confirmLockReason({
    isOnline,
    gate: gate.verdict,
    workerNo: identity.workerNo,
    handlingUnitTypeCode,
    lines,
  });

  const matchMessage = ((): { tone: 'success' | 'error'; text: string } | null => {
    if (labelMissing) return { tone: 'error', text: t.match.labelNotFound };
    if (labelScan.isError || lotScan.isError) return { tone: 'error', text: t.match.lookupFailed };
    if (matched === null) return null;
    if (matched.verdict.matched) return { tone: 'success', text: t.match.ok };

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
    <main className="packing-shell" aria-labelledby={titleId}>
      {/* 헤더 64 — 「무엇을」이 왼쪽, 「어디서·누가」가 오른쪽이다(스펙 §3). */}
      <header className="pop-header">
        <h1 className="pop-title" id={titleId}>
          {t.title}
        </h1>
        <p className="pop-context">
          {shipmentId === null ? t.header.shipmentUnknown : t.header.shipment(shipmentId)}
        </p>
        <div className="pop-context-right">
          <Chip variant="status" size="sm" status={isOnline ? 'success' : 'error'}>
            {identity.workerNo === null
              ? t.header.terminalUnknown
              : t.header.worker(identity.workerNo)}
          </Chip>
        </div>
      </header>

      {/*
       * 본문 616 — ① 88 + ② 88 + ③ 320 + ④ 88 (스펙 §3-1 세로 예산 · 슬랙 0).
       * ⛔ 구획을 좌우로 펴지 않는다 — 스캔이 «순서»이기 때문이다. 위에서 아래로 읽는 차례가
       * 곧 작업 순서이고, 좌우로 나누면 ①과 ②의 선후가 사라진다.
       */}
      <div className="packing-body">
        {(confirmedNo !== null || confirm.isError) && (
          <div className="banner-slot">
            {confirmedNo !== null ? (
              <AlertBanner variant="success">{t.confirmed(confirmedNo)}</AlertBanner>
            ) : (
              <AlertBanner variant="error">{String(toApiError(confirm.error).kind)}</AlertBanner>
            )}
          </div>
        )}

        {/* ① 납품라벨 스캔 */}
        {/* ⛔ 구획에 칸과 «같은 이름»을 달지 않는다 — 이름이 겹치면 무엇을 가리키는지 흐려진다. */}
        <section className="packing-scan">
          <ScanField
            label={t.scan.label.deliveryLabel}
            isScanning={labelScan.isPending}
            onScan={scanLabel}
          />
        </section>

        {/* ② 생산LOT 스캔 — 판정 문구가 칸 바로 아래 붙는다. 떨어뜨리면 어느 스캔의 답인지 흐려진다. */}
        <section className="packing-scan">
          <ScanField
            label={t.scan.label.productionLot}
            isScanning={lotScan.isPending}
            lockReason={shipmentId === null ? t.scan.lotLocked : undefined}
            onScan={scanLot}
          />
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
              <p className="packing-unit-no">
                {openUnit === null ? t.fields.handlingUnitPending : openUnit.handlingUnitNo}
              </p>
              <Select
                aria-label={t.fields.handlingUnitType}
                placeholder={t.fields.handlingUnitType}
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
                setMergeNote(null);
              }}
            />

            <div className="packing-parent">
              <Select
                aria-label={t.fields.parentHandlingUnit}
                placeholder={t.fields.parentNone}
                value={parentId === NO_PARENT ? null : parentId}
                onChange={(value) => {
                  setParentId(value ?? NO_PARENT);
                }}
                /*
                 * ⛔ **후보를 계층으로 거르지 않는다**(§5-2-1). 계층 깊이가 확정이 아니고, 이
                 * 화면은 매번 새 취급 단위를 만들므로 자기 하위가 존재할 수 없다.
                 */
                options={parents.candidates.map((candidate) => ({
                  value: String(candidate.handlingUnitId),
                  label: candidate.handlingUnitNo,
                }))}
              />
              <p className="field-note">
                {warehouseId !== null && !parents.isPending && parents.candidates.length === 0
                  ? t.notes.parentEmpty
                  : t.notes.parentHint}
              </p>
            </div>
          </div>

          {/*
           * 수량 키패드는 ③ 안에서 «옆»에 선다. 스펙 그림에 키패드 자리가 따로 없는데 D-4 는
           * 화면 내장 키패드를 요구한다 — 세로 예산이 슬랙 0 이라 새 구획을 아래에 붙일 수 없어
           * 이 구획의 남는 «가로»를 쓴다. 담을 LOT 이 정해졌을 때만 선다.
           */}
          <div className="packing-keypad">
            {packable === undefined ? (
              <p className="field-note">{t.notes.qtyWaiting}</p>
            ) : (
              <>
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
                <NumberPad
                  aria-label={t.qty.label}
                  value={qty}
                  allowDecimal
                  onChange={setQty}
                  onConfirm={addToPacking}
                />
                {qty !== '' && qtyIssue !== undefined && <p className="field-note">{qtyIssue}</p>}
                {mergeNote !== null && <p className="field-note">{mergeNote}</p>}
              </>
            )}
          </div>
        </section>

        {/* ④ 진행 — ⛔ 「예상 N」이 없어 분모가 없다. 진행 막대를 그리지 않는다(§3-3). */}
        <section className="packing-progress" aria-label={t.panes.progress}>
          <span>{t.progress.packed(progress.packedCount)}</span>
          <span>{t.progress.unpacked(progress.unpackedQty)}</span>
        </section>
      </div>

      {/* 액션바 88 — 화면 바닥에 고정한다. 본문이 밀어내면 확정이 화면 밖으로 나간다. */}
      <div className="packing-actions">
        {lockReason !== undefined && <p className="packing-lock">{lockReason}</p>}

        {gate.verdict === 'unavailable' && (
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
          size="xl"
          className="pop-touch-target"
          onClick={() => {
            /* 「다시 스캔」은 **마지막 스캔을 취소한다** — 담긴 것은 표에서 줄 단위로 뺀다. */
            setMatched(null);
            setQty('');
            setMergeNote(null);
          }}
        >
          {t.actions.rescan}
        </Button>

        <Button
          type="button"
          variant="filled"
          size="2xl"
          disabled={lockReason !== undefined || confirm.isPending}
          onClick={() => {
            if (lockReason !== undefined || warehouseId === null || identity.workerNo === null) {
              return;
            }

            if (openUnit === null) return;

            confirm.mutate({
              handlingUnit: openUnit,
              lines,
              workerNo: identity.workerNo,
              now: new Date(),
            });
          }}
        >
          {confirm.isPending ? t.actions.confirming : t.actions.confirm}
        </Button>
      </div>
    </main>
  );
};
