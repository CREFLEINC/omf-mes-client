import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';
import {
  PuButton,
  PuChip,
  PuField,
  PuInput,
  PuNote,
  PuSection,
  PuTiles,
  PuUnit,
} from '../../patterns/pop-uniform';
import { toLookupDisplayState, type LookupSource } from '../../patterns/lookup-display';
import { validateQty, type QtyDraft, type QtyProblem } from './input-qty';
import type { ReferenceLabels } from './reference-labels';
import type { ScannedPart } from './scan';
import type { PopGateVerdict as GateVerdict } from '../../patterns/pop-process-gate';
import type { CurrentInputView } from './types';

const t = messages.runningChange;

/**
 * 등록을 막는 사유. **하나만 고른다** — 여러 개를 늘어놓으면 무엇을 먼저 풀어야 할지 알 수
 * 없다. 순서는 **풀 수 없는 것부터**다: 단말·사번은 작업자가 못 고치고, 부품·대상은 고친다.
 */
export type BlockReason =
  | GateVerdict
  | 'workerMissing'
  | 'workOrderMissing'
  | 'partMissing'
  | 'targetMissing'
  | 'qtyInvalid'
  | null;

export interface ReplacePanelProps {
  gate: GateVerdict;
  /** 단말 기능이 꺼져 있을 때의 문구 — 어느 공정의 무슨 기능인지와 켜는 곳 */
  gateDeniedText: string;
  /** 판정할 공정을 모를 때의 문구 — 원인·조치와 서버가 준 이유 */
  gateUnidentifiedText: string;
  hasWorkOrder: boolean;
  hasWorker: boolean;
  part: ScannedPart | null;
  targets: readonly CurrentInputView[];
  selectedTargetId: number | null;
  qty: QtyDraft;
  labels: ReferenceLabels;
  /** LOT 품질 상태의 표시명. 칩에 코드가 그대로 서지 않게 한다(#1045). */
  lotStatuses: LookupSource;
  /** 교체 사유 선택지 — 고객이 마스터에서 채운다. 비어 올 수 있다(스펙 §6). */
  reasons: readonly { code: string; codeName: string }[];
  reasonsPending: boolean;
  reasonsFailed: boolean;
  reasonCode: string | null;
  onReasonChange: (code: string) => void;
  /** 서버가 거부했으면 그 사유 한 줄. */
  rejection: string | null;
  /** 구획 맨 위 안내 줄(작업지시 없음 · 사번 없음 · 멈춤). */
  notes?: ReactNode;
  /** 신규 부품 LOT 스캔 칸. */
  scan: ReactNode;
  onClearPart: () => void;
  onSelectTarget: (materialConsumptionId: number) => void;
  /** 게이팅 조회를 다시 건다. **「확인할 수 없다」에만 길을 준다**(G-3). */
  onRetryGate: () => void;
}

/**
 * 보류 칩에 세울 글자 — **코드가 아니라 표시명이다**(#1045).
 *
 * ⛔ 이름을 지어내지 않는다. 아직 받는 중인 것과 못 받은 것, 목록에 없는 것을 각각 다르게
 * 말한다 — 셋을 뭉치면 「이름이 없다」로 해 두었다가 이름으로 바뀌는 칸이 된다.
 */
export const statusText = (source: LookupSource, statusCode: string): string => {
  const state = toLookupDisplayState(source, statusCode);

  switch (state.kind) {
    case 'named':
      return state.label;
    case 'loading':
      return t.replace.statusLoading;
    case 'failed':
      return t.replace.statusFailed;
    /*
     * 코드가 비는 일은 계약상 없다(`Lot.statusCode` 필수). 그래도 비면 「코드 (표시명 없음)」이
     * 아니라 값이 없다고 적는다 — 같은 자리를 P-04-04 도 그렇게 다룬다(`typeText`).
     */
    case 'empty':
      return t.replace.statusEmpty;
    case 'unknown':
      return t.replace.statusUnknown(statusCode);
  }
};

/** 막는 사유를 하나 고른다. 풀 수 없는 것을 앞에 둔다. */
export const toBlockReason = (props: {
  gate: GateVerdict;
  hasWorkOrder: boolean;
  hasWorker: boolean;
  part: ScannedPart | null;
  selectedTargetId: number | null;
  qty: QtyDraft;
}): BlockReason => {
  if (props.gate !== 'allowed') return props.gate;
  if (!props.hasWorkOrder) return 'workOrderMissing';
  if (!props.hasWorker) return 'workerMissing';
  if (props.part === null) return 'partMissing';
  if (props.selectedTargetId === null) return 'targetMissing';
  /*
   * 수량 문제도 등록을 막지만 **사유를 버튼 옆에 되풀이하지 않는다** — 칸 옆에 이미 서 있고,
   * 같은 말이 두 곳에 있으면 어느 쪽을 고쳐야 하는지가 흐려진다(`describeBlock`이 `null`).
   */
  return validateQty(props.qty) === null ? null : 'qtyInvalid';
};

/**
 * 수량 문제를 **언제** 말하는가. 무엇이 문제인지는 `validateQty` 가 정한다.
 *
 * ⛔ **손댈 차례가 오기 전에 붉은 글씨를 내지 않는다.** 부품을 담는 순간 빈 칸이 붉어지면
 * 아직 아무것도 잘못하지 않은 작업자가 오류를 본다 — 경고가 흔해지면 진짜 경고가 묻힌다.
 *
 * ⛔ **친 값은 언제나 잰다.** 부품보다 수량을 먼저 치는 순서도 있고, 그때 「abc」가 조용히
 * 남아 있으면 나중에 등록이 왜 잠겼는지 알 방법이 없다 — 버튼 옆은 수량을 되풀이하지 않는다.
 *
 * ⚠ **비어 있음은 부품·대상이 갖춰진 뒤에만 말한다.** 그때부터 수량이 마지막 칸이라
 * 「비었다」가 곧 등록이 잠긴 사유가 된다.
 */
export const toQtyProblem = (props: {
  qty: QtyDraft;
  part: ScannedPart | null;
  selectedTargetId: number | null;
}): QtyProblem | null => {
  const entered = props.qty.trim() !== '';
  const ready = props.part !== null && props.selectedTargetId !== null;

  return entered || ready ? validateQty(props.qty) : null;
};

const describeBlock = (
  reason: BlockReason,
  gateDeniedText: string,
  gateUnidentifiedText: string,
): string | null => {
  switch (reason) {
    case null:
    case 'allowed':
    /* 수량은 칸 옆이 말한다 — 여기서 되풀이하지 않는다. */
    case 'qtyInvalid':
    /* 사번은 화면 맨 위 공용 띠가 말한다(사용자 지시 2026-09-17) — 여기서 되풀이하지 않는다. */
    case 'workerMissing':
    /* 작업지시 없음은 화면 맨 위 띠가 말한다 — 버튼 옆 문구는 지운다(사용자 지시 2026-09-17). */
    case 'workOrderMissing':
    /* 신규 부품 LOT 미스캔 문구도 지운다 — 스캔 칸이 바로 위에 있다(사용자 지시 2026-09-17). */
    case 'partMissing':
    /* 교체 대상 미선택도 지운다 — 대상 칸의 빨간 테두리가 말한다(POP 통일 시안 규칙 3·5). */
    case 'targetMissing':
      return null;
    case 'checking':
      return t.disabled.checking;
    case 'denied':
      return gateDeniedText;
    case 'unavailable':
      return t.disabled.unavailable;
    case 'unidentified':
      return gateUnidentifiedText;
  }
};

/** 교체 사유가 이만큼 이하면 바로 누르는 칸(타일), 넘으면 칸 + 선택 창(시안 규칙 7). */
const REASON_TILE_MAX = 6;

/**
 * 《부품 교체》 — 스펙 §3 · POP 통일 시안(#295). 읽은 부품 · 교체 대상 · 수량 · 사유를 모아 **한 건**을 등록한다.
 * [교체 등록]은 아래 작업 줄이 갖는다. 수량 칸 옆 [투입]은 같은 잠금 · 같은 처리(`onSubmit`)라 하나로 합쳤다.
 *
 * ⭐ **교체 사유는 열려 있다.** 값 목록은 고객이 마스터(`W-06-06`)에서 채운다. 비어서 오면 그때만 잠그고
 * «왜» 비었는지 말한다(`G-2`). 사유 없이도 등록은 선다(스펙 §6 — 권고).
 */
export const ReplacePanel = ({
  gate,
  gateDeniedText,
  gateUnidentifiedText,
  hasWorkOrder,
  hasWorker,
  part,
  targets,
  selectedTargetId,
  qty,
  reasons,
  reasonsPending,
  reasonsFailed,
  reasonCode,
  onReasonChange,
  labels,
  lotStatuses,
  rejection,
  notes,
  scan,
  onClearPart,
  onSelectTarget,
  onRetryGate,
}: ReplacePanelProps) => {
  const targetId = useId();
  const qtyId = useId();
  const reasonId = useId();
  const qtyProblem = toQtyProblem({ qty, part, selectedTargetId });
  const blocked = toBlockReason({ gate, hasWorkOrder, hasWorker, part, selectedTargetId, qty });
  /*
   * 사번 사유는 맨 위 줄이 말하므로, 그 다음 사유를 그대로 말한다. 잠금(`blocked`)은 바꾸지 않는다.
   */
  const blockText = describeBlock(
    blocked === 'workerMissing'
      ? toBlockReason({ gate, hasWorkOrder, hasWorker: true, part, selectedTargetId, qty })
      : blocked,
    gateDeniedText,
    gateUnidentifiedText,
  );
  const uom = part === null ? '' : labels.describeUom(part.uomId);
  const useTiles = reasons.length > 0 && reasons.length <= REASON_TILE_MAX;

  return (
    <PuSection title={t.panes.replace} className="rc-work">
      {notes}
      {blockText !== null && (
        <PuNote
          tone="warn"
          action={
            /* ⭐ 「확인할 수 없다」에만 다시 시도를 준다(G-3) — 「권한이 없다」는 다시 물어도 같은 답이다. */
            blocked === 'unavailable' ? (
              <PuButton size="sm" onClick={onRetryGate}>
                {t.retry}
              </PuButton>
            ) : undefined
          }
        >
          {blockText}
        </PuNote>
      )}
      {rejection !== null && (
        <PuNote tone="bad">
          <b>{t.replace.rejected}</b> {rejection}
        </PuNote>
      )}

      {scan}

      {/* 읽어 담은 신규 부품. 하나뿐이라 목록이 아니라 한 줄이다. */}
      {part !== null && (
        <div className="rc-part">
          <span className="lbl">{t.replace.partLabel}</span>
          <span>
            {labels.describeItem(part.itemId)} <b className="pu-mono">{part.lotNo}</b>
          </span>
          {part.isHeld && <PuChip tone="warn">{statusText(lotStatuses, part.statusCode)}</PuChip>}
          <PuButton size="sm" variant="ghost" onClick={onClearPart}>
            {t.replace.clearPart}
          </PuButton>
        </div>
      )}

      <div className="rc-pair">
        <PuField label={t.replace.targetLabel} required htmlFor={targetId}>
          <Select
            id={targetId}
            /*
             * ⭐ **대화상자 제목은 «명사»로 선다**(#1094) — 접근 이름이 비면 자리글을 집어 「…고르세요 선택」이 됐다.
             */
            aria-label={t.replace.targetLabel}
            placeholder={t.replace.targetPlaceholder}
            value={selectedTargetId === null ? null : String(selectedTargetId)}
            options={targets.map((row) => ({
              value: String(row.materialConsumptionId),
              label: t.replace.targetOption(
                labels.describeItem(row.itemId),
                labels.describeLot(row.lotId),
              ),
            }))}
            disabled={targets.length === 0}
            invalid={targets.length > 0 && selectedTargetId === null}
            onChange={(value) => {
              onSelectTarget(Number(value));
            }}
          />
        </PuField>
        <PuField label={t.replace.qtyLabel} required htmlFor={qtyId}>
          <div className="pu-row">
            {/*
             * ⛔ **칸을 직접 치게 두지 않는다**(전례 `P-02-08`). 포커스가 가면 단말의 운영체제 키보드가 화면을
             *    덮는다 — 값은 오른쪽 「수량」 키패드가 넣는다.
             */}
            <PuInput
              id={qtyId}
              numeric
              target
              readOnly
              inputMode="none"
              placeholder="0"
              value={qty}
              need={qtyProblem !== null}
              autoComplete="off"
            />
            <PuUnit>{uom === '' ? '—' : uom}</PuUnit>
          </div>
        </PuField>
      </div>
      {qtyProblem !== null && <PuNote tone="bad">{t.replace.qtyProblems[qtyProblem]}</PuNote>}

      <PuField
        label={t.replace.reasonLabel}
        optional={t.replace.optional}
        htmlFor={useTiles ? undefined : reasonId}
      >
        {useTiles ? (
          <PuTiles
            label={t.replace.reasonLabel}
            cols={4}
            options={reasons.map((reason) => ({ value: reason.code, label: reason.codeName }))}
            value={reasonCode}
            onChange={onReasonChange}
          />
        ) : (
          <Select
            id={reasonId}
            aria-label={t.replace.reasonLabel}
            placeholder={t.replace.reasonPlaceholder}
            value={reasonCode}
            options={reasons.map((reason) => ({ value: reason.code, label: reason.codeName }))}
            disabled={reasons.length === 0}
            onChange={onReasonChange}
          />
        )}
      </PuField>
      {/* 셋을 갈라 말한다 — 받는 중 · 못 받음 · 아직 안 채움. 셋의 다음 행동이 다르다. */}
      {reasonsPending && <p className="pu-help">{t.replace.reasonLoading}</p>}
      {!reasonsPending && reasonsFailed && <p className="pu-help">{t.replace.reasonFailed}</p>}
      {/* 사유 목록이 비었다는 말은 칸 안에 넣으면 좁은 화면에서 잘린다 — 칸 아래 한 줄로 둔다. */}
      {!reasonsPending && !reasonsFailed && reasons.length === 0 && (
        <p className="pu-help">{t.replace.reasonEmpty}</p>
      )}
    </PuSection>
  );
};
