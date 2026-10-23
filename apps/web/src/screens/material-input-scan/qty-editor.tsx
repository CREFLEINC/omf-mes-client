import { Button, Chip, TextField } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';

import { POP_TOUCH_SIZE } from '../work-start/touch-spec';
import { readQty, validateQty, type QtyDrafts } from './input-qty';
import type { LotStatusLabels } from './lot-status-labels';
import { RECEIPT_STATUS_LABEL, RECEIPT_STATUS_TONE, type MaterialRow } from './material-list';

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
  /** 이 화면에서 기록한 LOT인가. 기록하면 수량을 고칠 수 없다. */
  isRecorded: boolean;
  /** 이 W/O에 기록된 투입 수량(LOT별 합). 없으면 `null`. */
  recordedQty: { qty: number; uomId: number } | null;
  qtyDrafts: QtyDrafts;
  statusLabels: LotStatusLabels;
  describeItem: (itemId: number) => string;
  describeUom: (uomId: number) => string;
  describeFourMType: (code: string) => string;
  /**
   * 이 단말이 이 공정에서 투입할 수 있는가(스펙 §5-1). **기록이 곧 쓰기다**(§5-8) — 게이트가
   * 닫혔으면 여기서 막는다. 잠긴 이유는 하단 바 「남은 일」이 말한다.
   */
  canRecord: boolean;
  /** 「남은 일」 문단 id. 잠긴 [기록]이 `aria-describedby`로 잇는다(C-4). */
  remainingId: string;
  onQtyChange: (lotId: number, value: string) => void;
  onRecord: (lotId: number) => void;
  onRemove: (lotId: number) => void;
}

/**
 * 투입 수량 편집 영역. 자재 목록에서 고른 LOT 하나를 보이고, 스캔해 담은 LOT이면 수량을 넣고
 * 기록한다.
 *
 * LOT마다 키패드를 펼치지 않는다. 키패드 하나를 고른 LOT에 쓴다(T-W-C 「대상 안의 하위 항목」과
 * 같은 왼쪽 목록, 오른쪽 편집 영역). 수량은 작업 내내 반복해 넣는 값이라 창으로 열지 않고 화면에
 * 둔다(C-12). 키패드는 작업 시작의 사번 창과 같은 공용 부품이다.
 *
 * 머리 줄에 구획 제목과 [빼기](작게), 그 아래 LOT 번호, 라벨 값 쌍(품목, 출고, 수령, 차이, 수령 상태,
 * 이 W/O에 기록된 투입, LOT 상태), 투입 수량 칸과 [투입 기록], 키패드 순서다. [빼기]는 테두리, [투입 기록]은 이 영역의 채움
 * 버튼 하나다(C-3 영역마다 하나). 기록된 LOT은 고칠 수 없다(이력 불변 B-3) — 수량과 「기록됨」만 보인다.
 *
 * 스캔해 담으면 투입 수량 칸에 수령 − 기록 양이 미리 채워진다(PI-05, 화면이 채운다). 작업자가 바꿀 수 있다.
 */
export const QtyEditor = ({
  row,
  isRecorded,
  recordedQty,
  qtyDrafts,
  statusLabels,
  describeItem,
  describeUom,
  describeFourMType,
  canRecord,
  remainingId,
  onQtyChange,
  onRecord,
  onRemove,
}: QtyEditorProps) => {
  if (row === null) {
    return (
      <section className="pane material-input-qty" aria-label={t.panes.qty}>
        <h2 className="pane-title">{t.panes.qty}</h2>
        <p className="field-note">{t.scanned.noSelection}</p>
      </section>
    );
  }

  const { material, receipt } = row;
  const uomId = material?.uomId ?? receipt?.uomId;
  const uom = uomId === undefined ? '' : describeUom(uomId);
  const withUom = (qty: number, ofUomId: number | undefined = uomId): string => {
    const unit = ofUomId === undefined ? '' : describeUom(ofUomId);

    return unit === '' ? String(qty) : `${String(qty)} ${unit}`;
  };
  const itemCode = receipt?.itemCode ?? describeItem(row.itemId);
  const qty = readQty(qtyDrafts, row.lotId);
  const canSubmit = canRecord && !isRecorded && validateQty(qty) === null;
  const fourM = material?.fourMChange ?? null;
  const fourMText =
    fourM === null
      ? null
      : [describeFourMType(fourM.changeTypeCode ?? ''), fourM.remarks]
          .filter((part) => part !== undefined && part !== '')
          .join(', ');

  return (
    <section className="pane material-input-qty" aria-label={t.panes.qty}>
      {/*
       * 머리 줄: 구획 제목과 행 동작 [빼기](작게, 테두리). 저장 [투입 기록]과 떨어뜨려 잘못 누르지
       * 않게 한다(PI-08). 기록된 LOT에는 [빼기]를 두지 않는다 — 화면에서 빼도 서버 기록은 남아
       * 정정 경로조차 없다(이력 불변 B-3).
       */}
      <div className="material-input-qty-head">
        <h2 className="pane-title">{t.panes.qty}</h2>
        {material !== undefined && !isRecorded && (
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

      <h3 className="material-input-qty-lot">{row.lotNo}</h3>

      {/* 라벨 값 쌍. 가운뎃점으로 값을 잇지 않는다(C-10, C-13). */}
      <dl className="material-input-pairs">
        <div className="material-input-pair material-input-pair-wide">
          <dt>{t.pairs.item}</dt>
          <dd>{named(receipt?.itemName, itemCode)}</dd>
        </div>
        {receipt === undefined ? (
          <div className="material-input-pair material-input-pair-wide">
            <dt>{t.pairs.receivedQty}</dt>
            <dd>{t.scanned.receivedNone}</dd>
          </div>
        ) : (
          <>
            <div className="material-input-pair">
              <dt>{t.pairs.issuedQty}</dt>
              <dd>{withUom(receipt.issuedQty)}</dd>
            </div>
            <div className="material-input-pair">
              <dt>{t.pairs.receivedQty}</dt>
              <dd>{withUom(receipt.receivedQty)}</dd>
            </div>
            <div className="material-input-pair">
              <dt>{t.pairs.varianceQty}</dt>
              <dd>{withUom(receipt.varianceQty)}</dd>
            </div>
            <div className="material-input-pair">
              <dt>{t.pairs.receiptStatus}</dt>
              <dd>
                <Chip variant="status" size="md" status={RECEIPT_STATUS_TONE[receipt.status]}>
                  {RECEIPT_STATUS_LABEL[receipt.status]}
                </Chip>
              </dd>
            </div>
          </>
        )}
        {recordedQty !== null && (
          <div className="material-input-pair material-input-pair-wide">
            <dt>{t.pairs.recordedQty}</dt>
            <dd>{withUom(recordedQty.qty, recordedQty.uomId)}</dd>
          </div>
        )}
        {material !== undefined && (
          <div className="material-input-pair material-input-pair-wide">
            <dt>{t.pairs.lotStatus}</dt>
            <dd className="material-input-pair-chips">
              <span>{statusLabels.describe(material.statusCode)}</span>
              {material.isHeld && (
                <Chip variant="status" size="md" status="warning">
                  {t.scanned.heldMark}
                </Chip>
              )}
              {statusLabels.isUnavailable && (
                <span className="field-note">{t.scanned.statusLabelUnavailable}</span>
              )}
            </dd>
          </div>
        )}
        {fourMText !== null && (
          <div className="material-input-pair material-input-pair-wide">
            <dt>{t.scanned.fourMChangeMark}</dt>
            <dd>{fourMText}</dd>
          </div>
        )}
      </dl>

      {material === undefined ? (
        /* 담기는 스캔으로만 한다. 라벨을 읽어야 실물 LOT과 상태를 확인할 수 있다. */
        <p className="field-note">{t.scanned.scanToInput}</p>
      ) : (
        <>
          <div className="material-input-qty-row">
            <TextField
              size="xl"
              label={t.scanned.qtyField}
              aria-label={t.scanned.qtyLabel(row.lotNo)}
              value={qty}
              inputMode="decimal"
              autoComplete="off"
              fullWidth
              /* 기록된 뒤에는 고칠 수 없다. 투입은 새 기록으로만 고친다(B-3). */
              readOnly={isRecorded}
              trailingIcon={
                uom === '' ? undefined : <span className="material-input-uom">{uom}</span>
              }
              error={isRecorded ? undefined : qtyError(qty)}
              onChange={(event) => {
                onQtyChange(row.lotId, event.target.value);
              }}
            />

            {isRecorded ? (
              <Chip variant="status" size="md" status="success">
                {t.scanned.recordedMark}
              </Chip>
            ) : (
              /*
               * [투입 기록]이 이 화면의 유일한 저장이다(§5-8 건별 저장, 사용자 화면 확인 결정
               * 2026-10-23). 편집 영역의 채움 버튼 하나다(C-3 영역마다 하나). 수량이 없거나 단말이
               * 막혔으면 누르지 못하고, 사유는 하단 바 「남은 일」이다.
               */
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
            )}
          </div>

          {!isRecorded && (
            /* 소수점 키를 세우지 않는다(사용자 지시 2026-09-19, omf-all-around#35). */
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
          )}
        </>
      )}
    </section>
  );
};
