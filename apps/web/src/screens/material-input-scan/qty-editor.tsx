import { Button, Chip, TextField } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';

import { POP_TOUCH_SIZE } from '../work-start/touch-spec';
import { readQty, validateQty, type QtyDrafts } from './input-qty';
import {
  QtyProgress,
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

/** 편집 영역의 투입 기록 한 줄(PI-30). */
export interface InputRecordView {
  key: string;
  qty: number;
  uomId: number;
  occurredAt: string;
  /** 「미전송」(단말에 있음) 또는 「전송 완료」. */
  state: 'pending' | 'sent';
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** 투입 기록 줄의 시각. 오늘이면 「HH:mm」, 아니면 「MM-DD HH:mm」. */
const timeOf = (iso: string, now: Date = new Date()): string => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
  const isToday =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();

  return isToday ? time : `${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${time}`;
};

export interface QtyEditorProps {
  /** 편집 영역에 연 줄. 없으면 `null`. */
  row: MaterialRow | null;
  /** 투입 중인가(스캔하거나 다시 스캔하고 아직 기록하지 않음). 그때만 [스캔 취소]를 둔다. */
  isPending: boolean;
  /** 이 W/O에 투입량(LOT별 합). 없으면 `null`. */
  recordedQty: { qty: number; uomId: number } | null;
  /** 잔량(불출량 − 투입량). 모르면 `null`. */
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
  /** 「남은 일」 문단 id. 잠긴 [투입 등록]이 `aria-describedby`로 잇는다(C-4). */
  remainingId: string;
  onQtyChange: (lotId: number, value: string) => void;
  onRecord: (lotId: number) => void;
  onRemove: (lotId: number) => void;
  /** 이 LOT이 「미전송」인가(PI-26). 그때 [취소]와 보내는 때 안내를 둔다. */
  isAutoPending: boolean;
  /** 이 W/O의 이 LOT 투입 기록(서버, 전송 완료, 미전송). */
  records: readonly InputRecordView[];
  /** [추가 투입]: 다 투입한 LOT에 직접 입력을 연다(PI-28). */
  onExtraInput: (lotId: number) => void;
  /**
   * 투입 기록 한 줄을 취소한다. **취소 자리**다 — omf-mes-server#828 의 취소 기록 API가 생기면
   * 화면이 넘기고, 그때 줄마다 [취소]가 선다(PI-30). 넘기지 않으면 아무것도 그리지 않는다(C-4).
   */
  onCancelRecord?: (record: InputRecordView) => void;
  /** 자동으로 보내지 않고 직접 입력으로 돌린 까닭. 없으면 `null`(PI-28). */
  manualReason: 'unknown' | 'none' | 'unit' | null;
  /** [취소]: 창의 투입을 버린다. */
  onUndo: () => void;
}

/**
 * 편집 영역: 고른 자재 하나(C-21).
 *
 * - 제목 줄은 고른 품목 「이름 (코드)」와 오른쪽 끝의 예외 칩, [스캔 취소](작게, 테두리, 투입 중이고
 *   미전송이 아닐 때만)다(C-21 영역 제목, 목록 줄과 같은 나눔). LOT 번호는 목록 줄에만 있다(PI-19).
 * - 예외 칩(덜 받음, 못 받음, 단위 다름, 보류 확인 필요, 4M 변경품, 출고 미귀속)만 보인다. 정상 값
 *   (수령 완료, LOT 상태 정상)과 다른 담당의 값(출고, 차이)은 두지 않는다(C-21).
 * - 정보 영역은 「투입량 30 / 100 KG」과 막대(목록 줄과 같은 부품 `QtyProgress`). 잔량은 이번 투입
 *   곁에만 「잔량 70 KG」, 불출량을 넘으면 음수 대신 「불출량보다 5 KG 더 투입했습니다.」(C-21).
 * - 소제목 「이번 투입」 아래 칸과 [투입 등록], 키패드(C-19 소제목 위, 상자 안 상자 없음).
 *
 * 지난 기록은 고치지 않는다(B-3). 더 넣으면 새 기록이 덧붙는다(PI-18). 스캔하면 이번 투입 칸에 잔량이
 * 미리 채워진다(PI-05). [투입 등록]은 이 영역의 채움 버튼 하나다(C-3 영역마다 하나, PI-14).
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
  isAutoPending,
  records,
  onExtraInput,
  onCancelRecord,
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
  const withUnit = (value: number): string =>
    uom === '' ? String(value) : `${String(value)} ${uom}`;
  const received = receipt?.receivedQty ?? null;
  const overQty =
    received !== null && recordedQty !== null && recordedQty.qty > received
      ? recordedQty.qty - received
      : null;
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
      {/* 제목 줄(C-21): 품목 「이름 (코드)」, 오른쪽 끝에 예외 칩과 [스캔 취소]. 정보 영역과 간격으로 나눈다. */}
      <div className="material-input-qty-head">
        <h2 className="pane-title">{named(receipt?.itemName, itemCode)}</h2>
        {hasException && (
          <span className="material-input-lot-chips">
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
          </span>
        )}
        {material !== undefined && isPending && !isAutoPending && (
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
      {fourMText !== null && fourMText !== '' && (
        <p className="field-note">{t.scanned.fourMChangeLine(fourMText)}</p>
      )}

      {/* 정보 영역(C-21): 목록 줄과 같은 「투입량」 쌍과 막대. */}
      <span className="material-input-info material-input-qty-line">
        <span className="material-input-info-label">{t.pairs.progressLabel}</span>
        <QtyProgress
          received={receipt?.receivedQty ?? null}
          recorded={recordedQty?.qty ?? 0}
          uom={uom}
        />
      </span>
      {/* 불출량을 넘으면 음수 대신 한 줄로 말한다(C-21). */}
      {overQty !== null && <p className="field-note">{t.pairs.over(withUnit(overQty))}</p>}

      {material !== undefined && !isPending && manualReason === 'none' ? (
        /* 다 투입한 LOT: 정보만. 더 넣을 때만 직접 입력을 연다(PI-28 다시). */
        <div className="material-input-auto">
          {/* 과투입이면 위 한 줄이 이미 말한다. */}
          {overQty === null && <p className="material-input-auto-hint">{t.scanned.allInput}</p>}
          <Button
            type="button"
            variant="outlined"
            size={POP_TOUCH_SIZE}
            onClick={() => {
              onExtraInput(row.lotId);
            }}
          >
            {t.scanned.extraInput}
          </Button>
        </div>
      ) : material === undefined || !isPending ? (
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
          {/* 남은 양은 지금 넣을 칸 곁에만 둔다(C-21). 0 이하는 두지 않는다. */}
          <div className="material-input-qty-head">
            <h3 className="material-input-subtitle">{t.pairs.thisInput}</h3>
            {remainingQty !== null && remainingQty > 0 && (
              <span className="material-input-remaining">
                {t.pairs.remaining(withUnit(remainingQty))}
              </span>
            )}
          </div>
          {manualReason !== null && !isAutoPending && (
            <p className="field-note">{t.scanned.manualReasons[manualReason]}</p>
          )}
          {isAutoPending && (
            /*
             * 「미전송」(PI-26): 보내는 때 안내와 [취소]. 칸을 고치면 고친 양을 보내고, [투입 등록]은
             * 다음 동작을 기다리지 않고 지금 보낸다.
             */
            <div className="material-input-auto">
              <p className="material-input-auto-hint" role="status">
                {t.scanned.pendingHint}
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
             * [투입 등록]이 이 화면의 유일한 저장이다(§5-8 건별 저장, 사용자 화면 확인 결정
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
      {/* 투입 내역은 입력 아래에 둔다. 이번 투입이 먼저 보이고 내역은 구획 안에서 스크롤된다. */}
      {records.length > 0 && (
        <>
          <h3 className="material-input-subtitle">{t.scanned.recordsTitle}</h3>
          <ul className="material-input-records" aria-label={t.scanned.recordsTitle}>
            {records.map((record) => (
              <li key={record.key} className="material-input-record">
                <span className="material-input-record-qty">
                  {(() => {
                    const unit = describeUom(record.uomId);

                    return unit === '' ? String(record.qty) : `${String(record.qty)} ${unit}`;
                  })()}
                </span>
                <span className="material-input-record-time">{timeOf(record.occurredAt)}</span>
                <Chip
                  variant="status"
                  size="md"
                  status={record.state === 'pending' ? 'info' : 'success'}
                >
                  {record.state === 'pending' ? t.scanned.pendingState : t.scanned.sentState}
                </Chip>
                {onCancelRecord !== undefined && (
                  <Button
                    type="button"
                    variant="outlined"
                    size="sm"
                    onClick={() => {
                      onCancelRecord(record);
                    }}
                  >
                    {t.scanned.cancelRecord}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
