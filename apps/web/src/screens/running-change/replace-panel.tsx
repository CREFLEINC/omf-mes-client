import { AlertBanner, Button, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { validateQty, type QtyDraft, type QtyProblem } from './input-qty';
import type { ReferenceLabels } from './reference-labels';
import type { ScannedPart } from './scan';
import type { GateVerdict } from './terminal-gating';
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
  hasWorkOrder: boolean;
  hasWorker: boolean;
  part: ScannedPart | null;
  targets: readonly CurrentInputView[];
  selectedTargetId: number | null;
  qty: QtyDraft;
  labels: ReferenceLabels;
  /** 등록을 담은 뒤의 안내. 담지 않았으면 `false`. */
  recorded: boolean;
  /** 서버가 거부했으면 그 사유 한 줄. */
  rejection: string | null;
  onClearPart: () => void;
  onSelectTarget: (materialConsumptionId: number) => void;
  onQtyChange: (value: QtyDraft) => void;
  onSubmit: () => void;
  /** 게이팅 조회를 다시 건다. **「확인할 수 없다」에만 길을 준다**(G-3). */
  onRetryGate: () => void;
}

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
 * ⛔ **교체 사유는 고를 수 없는 상태로 선다.** 값 목록이 확정 전이라(검토 요청 omf-mes#397 ②)
 * 지어낸 값을 넣으면 승인된 적 없는 코드가 **지워지지 않는 기록**에 남는다. 감추지 않고
 * 사유를 말한다 — 칸만 비워 두면 「고를 것이 없다」와 「아직 안 골랐다」가 같은 모양이 된다.
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
  labels,
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
              <Chip variant="status" size="sm" status="warning">
                {part.statusCode}
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
          size="xl"
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

      <TextField
        label={t.replace.qtyLabel}
        value={qty}
        inputMode="decimal"
        autoComplete="off"
        fullWidth
        error={qtyProblem === null ? undefined : t.replace.qtyProblems[qtyProblem]}
        onChange={(event) => {
          onQtyChange(event.target.value);
        }}
      />

      <div className="pop-rc-field">
        <label htmlFor={reasonId}>{t.replace.reasonLabel}</label>
        <Select
          id={reasonId}
          size="xl"
          placeholder={t.replace.reasonPlaceholder}
          options={[]}
          disabled
          onChange={() => {
            /* 고를 것이 없다 — 이 자리는 값 목록이 정해지면 열린다. */
          }}
        />
        <p className="field-note">{t.replace.reasonUnavailable}</p>
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

      <div className="pop-rc-submit">
        <Button variant="filled" size="2xl" disabled={blocked !== null} onClick={onSubmit}>
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
        <p className="field-note">{t.replace.keepsHistory}</p>
        {recorded && (
          <p className="field-note" role="status">
            {t.replace.recorded}
          </p>
        )}
      </div>
    </>
  );
};
