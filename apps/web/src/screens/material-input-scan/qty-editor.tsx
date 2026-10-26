import { Button, Chip, TextField } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';

import { POP_TOUCH_SIZE } from '../work-start/touch-spec';
import { readQty, validateQty, type QtyDrafts } from './input-qty';
import {
  QtyRelation,
  RECEIPT_STATUS_LABEL,
  RECEIPT_STATUS_TONE,
  type MaterialRow,
} from './material-list';

const t = messages.materialInputScan;

/**
 * 친 수량의 문제를 문장으로 옮긴다. **빈 칸은 아직 오류가 아니다** — 담자마자 붉은 글씨가
 * 뜨면 작업자가 무언가 잘못한 것으로 읽는다(C-7). 빈 칸은 하단 바 「남은 일」이 말한다.
 */
const qtyError = (draft: string): string | undefined => {
  const problem = validateQty(draft);
  if (problem === null || problem === 'empty') return undefined;

  return t.scanned.qtyProblems[problem];
};

export interface QtyEditorProps {
  /** 편집 영역에 연 줄. 없으면 `null`. */
  row: MaterialRow | null;
  /** 이번 투입 입력 중인가(스캔하거나 다시 스캔하고 아직 기록하지 않음). 그때만 [스캔 취소]를 둔다. */
  isPending: boolean;
  /** 이 W/O에 투입한 수량(LOT별 합). 없으면 `null`. */
  recordedQty: { qty: number; uomId: number } | null;
  /** 남은 수량(받은 수량 − 투입한 수량). 모르면 `null`. */
  remainingQty: number | null;
  qtyDrafts: QtyDrafts;
  describeItem: (itemId: number) => string;
  describeUom: (uomId: number) => string;
  describeFourMType: (code: string) => string;
  /** 서버가 기록만 한 것(출고 미귀속)인가. 예외 칩으로 보인다. */
  isUnlinked: boolean;
  /**
   * 이 단말이 이 공정에서 투입할 수 있는가(스펙 §5-1). **기록이 곧 쓰기다**(§5-8) — 게이트가
   * 닫혔으면 여기서 막는다. 잠긴 이유는 하단 바 「남은 일」이 말한다.
   */
  canRecord: boolean;
  /** 「남은 일」 문단 id. 잠긴 [투입 기록]이 `aria-describedby`로 잇는다(C-4). */
  remainingId: string;
  onQtyChange: (lotId: number, value: string) => void;
  onRecord: (lotId: number) => void;
  onRemove: (lotId: number) => void;
  /** 이 LOT의 자동 투입 창이 열려 있으면 남은 초. 아니면 `null`(PI-26). */
  autoSecondsLeft: number | null;
  /** 자동으로 보내지 않고 직접 입력으로 돌린 까닭. 없으면 `null`(PI-28). */
  manualReason: 'unknown' | 'none' | 'unit' | null;
  /** [되돌리기]: 창의 투입을 버린다. */
  onUndo: () => void;
}

/**
 * 편집 영역: 고른 자재 하나(C-21).
 *
 * - 제목은 고른 품목 「이름 (코드)」다(C-21 영역 제목). LOT 번호는 목록 줄에만 있다(번호 반복 금지,
 *   PI-19). 오른쪽에 [스캔 취소](작게, 테두리, 이번 투입 입력 중일 때만).
 * - 예외 칩(덜 받음, 못 받음, 단위 다름, 보류 확인 필요, 4M 변경품, 출고 미귀속)만 보인다. 정상 값
 *   (수령 완료, LOT 상태 정상)과 다른 담당의 값(출고, 차이)은 두지 않는다(C-21).
 * - 수량 한 줄: 받은 수량 → 투입한 수량 → 남은 수량(목록 줄과 같은 이름, `QtyRelation`).
 * - 소제목 「이번 투입」 아래 칸과 [투입 기록], 키패드(C-19 소제목 위, 상자 안 상자 없음).
 *
 * 지난 기록은 고치지 않는다(B-3). 더 넣으면 새 기록이 덧붙는다(PI-18). 스캔하면 이번 투입 칸에 남은
 * 수량이 미리 채워진다(PI-05). [투입 기록]은 이 영역의 채움 버튼 하나다(C-3 영역마다 하나, PI-14).
 * 수량은 작업 내내 반복해 넣는 값이라 키패드를 창이 아니라 화면에 둔다(C-12).
 */
export const QtyEditor = ({
  row,
  isPending,
  recordedQty,
  remainingQty,
  qtyDrafts,
  describeItem,
  describeUom,
  describeFourMType,
  isUnlinked,
  canRecord,
  remainingId,
  onQtyChange,
  onRecord,
  onRemove,
  autoSecondsLeft,
  manualReason,
  onUndo,
}: QtyEditorProps) => {
  if (row === null) {
    return (
      <section className="pane material-input-qty" aria-label={t.panes.noSelection}>
        <h2 className="pane-title">{t.panes.noSelection}</h2>
        <p className="field-note">{t.scanned.noSelection}</p>
      </section>
    );
  }

  const { material, receipt } = row;
  const uomId = material?.uomId ?? receipt?.uomId;
  const uom = uomId === undefined ? '' : describeUom(uomId);
  const itemCode = receipt?.itemCode ?? describeItem(row.itemId);
  const qty = readQty(qtyDrafts, row.lotId);
  const canSubmit = canRecord && validateQty(qty) === null;
  const isUnitMismatch =
    material !== undefined && receipt !== undefined && material.uomId !== receipt.uomId;
  const fourM = material?.fourMChange ?? null;
  const fourMText =
    fourM === null
      ? null
      : [describeFourMType(fourM.changeTypeCode ?? ''), fourM.remarks]
          .filter((part) => part !== undefined && part !== '')
          .join(', ');
  const hasException =
    (receipt !== undefined && receipt.status !== 'matched') ||
    isUnitMismatch ||
    material?.isHeld === true ||
    fourM !== null ||
    isUnlinked;

  return (
    <section className="pane material-input-qty" aria-label={t.panes.noSelection}>
      <div className="material-input-qty-head">
        <h2 className="pane-title">{named(receipt?.itemName, itemCode)}</h2>
        {material !== undefined && isPending && autoSecondsLeft === null && (
          <Button
            type="button"
            variant="outlined"
            size="sm"
            aria-label={t.scanned.removeMaterial(row.lotNo)}
            onClick={() => {
              onRemove(row.lotId);
            }}
          >
            {t.scanned.remove}
          </Button>
        )}
      </div>

      {hasException && (
        <div className="material-input-exceptions">
          {receipt !== undefined && receipt.status !== 'matched' && (
            <Chip variant="status" size="md" status={RECEIPT_STATUS_TONE[receipt.status]}>
              {RECEIPT_STATUS_LABEL[receipt.status]}
            </Chip>
          )}
          {isUnitMismatch && (
            <Chip variant="status" size="md" status="warning">
              {t.scanned.unitMismatch}
            </Chip>
          )}
          {material?.isHeld === true && (
            <Chip variant="status" size="md" status="warning">
              {t.scanned.heldMark}
            </Chip>
          )}
          {fourM !== null && (
            <Chip variant="status" size="md" status="warning">
              {t.scanned.fourMChangeMark}
            </Chip>
          )}
          {isUnlinked && (
            <Chip variant="status" size="md" status="info">
              {t.scanned.unlinkedIssue}
            </Chip>
          )}
        </div>
      )}
      {fourMText !== null && fourMText !== '' && (
        <p className="field-note">{t.scanned.fourMChangeLine(fourMText)}</p>
      )}

      <p className="material-input-qty-line">
        <QtyRelation
          received={receipt?.receivedQty ?? null}
          recorded={recordedQty?.qty ?? null}
          remaining={remainingQty}
          uom={uom}
        />
      </p>

      {material === undefined || !isPending ? (
        /*
         * 입력은 스캔에서만 시작한다(PI-29). 담기는 스캔으로만 한다 — 라벨을 읽어야 실물 LOT과
         * 상태를 확인할 수 있다. 보낸 투입은 고치지 않는다(서버 취소 미구현, omf-mes-server#828).
         */
        <p className="field-note">
          {material !== undefined && recordedQty !== null
            ? t.scanned.sentReadOnly
            : t.scanned.scanToInput}
        </p>
      ) : (
        <>
          <h3 className="material-input-subtitle">{t.pairs.thisInput}</h3>
          {manualReason !== null && autoSecondsLeft === null && (
            <p className="field-note">{t.scanned.manualReasons[manualReason]}</p>
          )}
          {autoSecondsLeft !== null && (
            /*
             * 자동 투입 창(PI-26): 남은 초와 [되돌리기]. 칸을 고치면 고친 양을 보내고, [투입 기록]은
             * 기다리지 않고 지금 보낸다.
             */
            <div className="material-input-auto">
              <p className="material-input-auto-hint" role="status">
                {t.scanned.autoCountdown(Math.max(autoSecondsLeft, 0))}
              </p>
              <Button
                type="button"
                variant="outlined"
                size={POP_TOUCH_SIZE}
                aria-label={t.scanned.undoMaterial(row.lotNo)}
                onClick={onUndo}
              >
                {t.scanned.undo}
              </Button>
            </div>
          )}
          <div className="material-input-qty-row">
            <TextField
              size="xl"
              aria-label={t.scanned.qtyLabel(row.lotNo)}
              value={qty}
              inputMode="decimal"
              autoComplete="off"
              fullWidth
              trailingIcon={
                uom === '' ? undefined : <span className="material-input-uom">{uom}</span>
              }
              error={qtyError(qty)}
              onChange={(event) => {
                onQtyChange(row.lotId, event.target.value);
              }}
            />
            {/*
             * [투입 기록]이 이 화면의 유일한 저장이다(§5-8 건별 저장, 사용자 화면 확인 결정
             * 2026-10-23). 수량이 없거나 단말이 막혔으면 누르지 못하고, 사유는 하단 바 「남은 일」이다.
             */}
            <Button
              type="button"
              variant="filled"
              size={POP_TOUCH_SIZE}
              disabled={!canSubmit}
              aria-describedby={canSubmit ? undefined : remainingId}
              onClick={() => {
                onRecord(row.lotId);
              }}
            >
              {t.scanned.keypadSubmit}
            </Button>
          </div>

          {/* 소수점 키를 세우지 않는다(사용자 지시 2026-09-19, omf-all-around#35). */}
          <NumericKeypad
            value={qty}
            onChange={(next) => {
              onQtyChange(row.lotId, next);
            }}
            dropLeadingZero
            label={t.scanned.keypadLabel(row.lotNo)}
            clearLabel={t.scanned.keypadClear}
            backspaceLabel={t.scanned.keypadBackspace}
            keySize={POP_TOUCH_SIZE}
            className="material-input-keypad"
          />
        </>
      )}
    </section>
  );
};
