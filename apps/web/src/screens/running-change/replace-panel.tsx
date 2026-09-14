import { AlertBanner, Button, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';
import { toLookupDisplayState, type LookupSource } from '../../patterns/lookup-display';
import { validateQty, type QtyDraft, type QtyProblem } from './input-qty';
import type { ReferenceLabels } from './reference-labels';
import type { ScannedPart } from './scan';
import type { GateVerdict } from './terminal-gating';
import type { CurrentInputView } from './types';

import { QuantityPad } from './quantity-pad';

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
  hasWorkOrder: boolean;
  hasWorker: boolean;
  part: ScannedPart | null;
  targets: readonly CurrentInputView[];
  selectedTargetId: number | null;
  qty: QtyDraft;
  labels: ReferenceLabels;
  /** LOT 품질 상태의 표시명. 칩에 코드가 그대로 서지 않게 한다(#1045). */
  lotStatuses: LookupSource;
  /** 등록을 담은 뒤의 안내. 담지 않았으면 `false`. */
  recorded: boolean;
  /** 교체 사유 선택지 — 고객이 마스터에서 채운다. 비어 올 수 있다(스펙 §6). */
  reasons: readonly { code: string; codeName: string }[];
  reasonsPending: boolean;
  reasonsFailed: boolean;
  reasonCode: string | null;
  onReasonChange: (code: string) => void;

  /** 서버가 거부했으면 그 사유 한 줄. */
  rejection: string | null;
  onClearPart: () => void;
  onSelectTarget: (materialConsumptionId: number) => void;
  onQtyChange: (value: QtyDraft) => void;
  onSubmit: () => void;
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

const describeBlock = (reason: BlockReason): string | null => {
  switch (reason) {
    case null:
    case 'allowed':
    /* 수량은 칸 옆이 말한다 — 여기서 되풀이하지 않는다. */
    case 'qtyInvalid':
      return null;
    case 'checking':
      return t.disabled.checking;
    case 'denied':
      return t.disabled.denied;
    case 'unavailable':
      return t.disabled.unavailable;
    case 'unidentified':
      return t.disabled.unidentified;
    case 'workerMissing':
      return t.disabled.workerMissing;
    case 'workOrderMissing':
      return t.disabled.workOrderMissing;
    case 'partMissing':
      return t.disabled.partMissing;
    case 'targetMissing':
      return t.disabled.targetMissing;
  }
};

/**
 * 《부품 교체》 — 스펙 §3 우단. 읽은 부품·교체 대상·수량·사유를 모아 **한 건**을 등록한다.
 *
 * ⭐ **교체 사유는 열려 있다.** 값 목록은 고객이 마스터(`W-06-06`)에서 채우고 받는 곳은 이미
 * 있다(스펙 §4-A · §8 미결 1 · 2026-09-03 판정). 비어서 오면 그때만 잠그고 «왜» 비었는지
 * 말한다 — 칸만 비워 두면 「고를 것이 없다」와 「아직 안 골랐다」가 같은 모양이 된다(`G-2`).
 * 사유 없이도 등록은 선다(스펙 §6 — 권고).
 */
export const ReplacePanel = ({
  gate,
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
  recorded,
  rejection,
  onClearPart,
  onSelectTarget,
  onQtyChange,
  onSubmit,
  onRetryGate,
}: ReplacePanelProps) => {
  const reasonId = useId();
  const targetId = useId();
  /*
   * ⭐ **수량은 화면 내장 키패드로 받는다**(공유계약 D-4). 단말에는 자판이 없다 — 칸을 누르면
   *    그때 키패드가 뜬다(사용자 결정 2026-09-07 · 전례 PQC 제품 검사).
   */
  const [isPadOpen, setPadOpen] = useState(false);

  const qtyProblem = toQtyProblem({ qty, part, selectedTargetId });
  const blocked = toBlockReason({ gate, hasWorkOrder, hasWorker, part, selectedTargetId, qty });
  const blockText = describeBlock(blocked);

  return (
    <>
      {/* 읽어 담은 신규 부품. 하나뿐이라 목록이 아니라 한 줄이다. */}
      <p className="pop-rc-part">
        <span className="pop-rc-part-label">{t.replace.partLabel}</span>
        {part === null ? (
          <span>{t.replace.partNone}</span>
        ) : (
          <>
            <span>{`${labels.describeItem(part.itemId)} ${part.lotNo}`}</span>
            {part.isHeld && (
              <Chip variant="status" size="md" status="warning">
                {statusText(lotStatuses, part.statusCode)}
              </Chip>
            )}
            <Button variant="text" size="sm" onClick={onClearPart}>
              {t.replace.clearPart}
            </Button>
          </>
        )}
      </p>

      <div className="pop-rc-field">
        <label htmlFor={targetId}>{t.replace.targetLabel}</label>
        <Select
          id={targetId}
          className="pop-rc-select"
          size="xl"
          /*
           * ⭐ **대화상자 제목은 «명사»로 선다**(#1094). 선택기는 제목을 「접근 이름 + 선택」
           *    으로 만드는데, 접근 이름이 비면 자리글(「교체 대상을 고르세요」)을 집어
           *    **「교체 대상을 고르세요 선택」**이 됐다 — 다른 대화상자는 전부 「명사 + 선택」이다.
           *    자리글은 칸 안의 안내로 그대로 두고, 제목에 쓸 이름만 따로 준다.
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
          onChange={(value) => {
            onSelectTarget(Number(value));
          }}
        />
      </div>

      {/* 수량도 같은 칸 규격으로 감싼다 — 감싸지 않으면 위 칸과 사이가 다르게 벌어진다. */}
      <div className="pop-rc-field">
        <TextField
          size="xl"
          label={t.replace.qtyLabel}
          value={qty}
          inputMode="decimal"
          autoComplete="off"
          fullWidth
          error={qtyProblem === null ? undefined : t.replace.qtyProblems[qtyProblem]}
          /*
           * 칸을 «누르면» 키패드가 뜬다. ⛔ 칸을 잠그지 않는다 — 자판이 달린 자리(개발·검수)
           * 에서 그대로 칠 수 있어야 한다.
           *
           * ⛔ **포커스로 열지 않는다.** 창이 닫히면 포커스가 이 칸으로 돌아오는데, 그것을
           *    열림 신호로 삼으면 [ 취소 ]·[ 확인 ]을 누르는 순간 창이 다시 뜬다 — 닫을 수
           *    없는 창이 된다(실측 · 사용자 지적 2026-09-07).
           */
          onClick={() => {
            setPadOpen(true);
          }}
          onChange={(event) => {
            onQtyChange(event.target.value);
          }}
        />
      </div>

      <div className="pop-rc-field">
        <label htmlFor={reasonId}>{t.replace.reasonLabel}</label>
        <Select
          id={reasonId}
          className="pop-rc-select"
          size="xl"
          placeholder={
            reasons.length === 0 && !reasonsPending && !reasonsFailed
              ? t.replace.reasonEmpty
              : t.replace.reasonPlaceholder
          }
          value={reasonCode}
          options={reasons.map((reason) => ({ value: reason.code, label: reason.codeName }))}
          disabled={reasons.length === 0}
          onChange={onReasonChange}
        />
        {/* 셋을 갈라 말한다 — 받는 중 · 못 받음 · 아직 안 채움. 셋의 다음 행동이 다르다. */}
        {reasonsPending && <p className="field-note">{t.replace.reasonLoading}</p>}
        {!reasonsPending && reasonsFailed && <p className="field-note">{t.replace.reasonFailed}</p>}
      </div>

      {/* W/O 가 나뉘지 않는다는 안내 — 스펙 §3 이 등록 버튼 위에 세워 둔 자리다. */}
      <div className="banner-slot">
        <AlertBanner variant="info">{t.notices.noWorkOrderSplit}</AlertBanner>
      </div>

      {rejection !== null && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.replace.rejected}>
            {rejection}
          </AlertBanner>
        </div>
      )}

      <QuantityPad
        open={isPadOpen}
        value={qty}
        /* 소수점 키는 **읽은 부품의 단위**가 정한다 — 개수로 세는 자재에는 그리지 않는다. */
        allowDecimal={labels.allowsDecimal(part?.uomId ?? null)}
        onCommit={(next) => {
          onQtyChange(next);
          setPadOpen(false);
        }}
        onClose={() => {
          setPadOpen(false);
        }}
      />

      <div className="pop-rc-submit">
        <Button
          variant="filled"
          size="2xl"
          className="pop-rc-submit-button"
          disabled={blocked !== null}
          onClick={onSubmit}
        >
          {t.replace.submit}
        </Button>
        {/*
         * 막힌 사유는 **버튼 옆에 항상 보이는 글로** 낸다. 잠긴 버튼만 두면 작업자는 무엇을
         * 풀어야 하는지 알 수 없다.
         */}
        {blockText !== null && <p className="field-note">{blockText}</p>}
        {/*
         * ⭐ **「확인할 수 없다」에만 다시 시도를 준다**(G-3). 「권한이 없다」는 같은 권한으로
         * 다시 물어도 같은 답이 오므로 길을 주면 작업자가 헛되이 반복한다.
         */}
        {blocked === 'unavailable' && (
          <Button variant="outlined" size="sm" onClick={onRetryGate}>
            {t.retry}
          </Button>
        )}
        {recorded && (
          <p className="field-note" role="status">
            {t.replace.recorded}
          </p>
        )}
      </div>
    </>
  );
};
