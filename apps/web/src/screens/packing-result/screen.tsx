import { AlertBanner, Button, Chip, NumberPad, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { toApiError } from '../../patterns/request';

import { confirmLockReason } from './confirm-lock';
import { ContentsTable } from './contents-table';
import { usePackingIdentity } from './entry-context';
import { usePackingConfirm } from './mutations';
import { addLine, qtyError, removeLine, toProgress } from './packing-draft';
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

  const confirm = usePackingConfirm({
    shipmentId,
    onSuccess: (handlingUnit) => {
      /* 확정하면 이 포장은 끝났다 — 다음 포장을 위해 담긴 것을 비우되 라벨은 남긴다(같은 출하를 계속 싼다). */
      setLines([]);
      setMatched(null);
      setQty('');
      setMergeNote(null);
      setParentId(NO_PARENT);
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

  const addToPacking = (): void => {
    if (packable === undefined || qtyIssue !== undefined) return;

    const outcome = addLine(lines, packable, Number(qty));

    setLines(outcome.lines);
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
    <main className="pop-shell" aria-labelledby={titleId}>
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

      {confirmedNo !== null && (
        <div className="banner-slot">
          <AlertBanner variant="success">{t.confirmed(confirmedNo)}</AlertBanner>
        </div>
      )}

      {confirm.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error">{`${String(toApiError(confirm.error).kind)}`}</AlertBanner>
        </div>
      )}

      <div className="pop-panes">
        <section className="pop-section" aria-label={t.panes.scan}>
          <h2 className="pane-title">{t.panes.scan}</h2>

          <ScanField
            label={t.scan.label.deliveryLabel}
            isScanning={labelScan.isPending}
            onScan={scanLabel}
          />

          <ScanField
            label={t.scan.label.productionLot}
            isScanning={lotScan.isPending}
            lockReason={shipmentId === null ? t.scan.lotLocked : undefined}
            onScan={scanLot}
          />

          <p className="scan-outcome" role="status">
            {matchMessage === null ? '' : matchMessage.text}
          </p>

          {packable !== undefined && (
            <>
              {/*
               * 숫자 키패드는 **디자인 시스템 부품**이다(DS `#41` 종결 · 공유계약 D-4).
               * ⛔ 화면이 다시 만들지 않는다 — 같은 것이 둘이 되면 자릿수 규칙이 갈린다.
               *
               * ⛔ **`max` 로 키를 막지 않는다.** 막으면 넘긴 순간 아무 일도 일어나지 않아
               * 작업자는 패드가 고장 난 것으로 읽는다 — **넘겼다고 말하고** 담기를 잠근다(§6).
               */}
              <NumberPad
                aria-label={t.qty.label}
                value={qty}
                allowDecimal
                onChange={setQty}
                onConfirm={addToPacking}
              />
              {/* 잠긴 사유는 감추지 않는다 — 무엇을 고쳐야 하는지가 그 문장에 있다. */}
              {qty !== '' && qtyIssue !== undefined && <p className="field-note">{qtyIssue}</p>}
            </>
          )}

          {mergeNote !== null && (
            <div className="banner-slot">
              <AlertBanner variant="warning">{mergeNote}</AlertBanner>
            </div>
          )}
        </section>

        <section className="pop-section" aria-label={t.panes.packing}>
          <h2 className="pane-title">{t.panes.packing}</h2>

          <Select
            aria-label={t.fields.handlingUnitType}
            placeholder={t.fields.handlingUnitType}
            value={handlingUnitTypeCode === '' ? null : handlingUnitTypeCode}
            onChange={(value) => {
              setHandlingUnitTypeCode(value ?? '');
            }}
            options={typeOptions.options}
          />
          {typeOptions.isUnavailable && <p className="field-note">{t.notes.typeUnavailable}</p>}

          <ContentsTable
            lines={lines}
            onRemove={(allocationId) => {
              setLines(removeLine(lines, allocationId));
              setMergeNote(null);
            }}
          />

          <Select
            aria-label={t.fields.parentHandlingUnit}
            placeholder={t.fields.parentNone}
            value={parentId === NO_PARENT ? null : parentId}
            onChange={(value) => {
              setParentId(value ?? NO_PARENT);
            }}
            /*
             * ⛔ **후보를 계층으로 거르지 않는다**(§5-2-1). 계층 깊이가 확정이 아니고, 이 화면은
             * 매번 새 취급 단위를 만들므로 자기 하위가 존재할 수 없다 — 순환이 불가능하다.
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

          <p className="packing-progress">
            {`${t.progress.packed(progress.packedCount)} · ${t.progress.unpacked(progress.unpackedQty)}`}
          </p>
        </section>
      </div>

      <div className="pop-actions">
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

            confirm.mutate({
              handlingUnitTypeCode,
              parentHandlingUnitId: parentId === NO_PARENT ? null : Number(parentId),
              warehouseId,
              lines,
              workerNo: identity.workerNo,
              now: new Date(),
            });
          }}
        >
          {confirm.isPending ? t.actions.confirming : t.actions.confirm}
        </Button>

        {lockReason !== undefined && <p className="field-note">{lockReason}</p>}

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
      </div>
    </main>
  );
};
