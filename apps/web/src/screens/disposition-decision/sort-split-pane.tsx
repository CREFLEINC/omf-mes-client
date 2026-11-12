import { Checkbox, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { DecisionFormErrors, DecisionFormValue } from './decision-form';
import { IqcMatchChips } from './iqc-match';
import { formatQty, type NonconformanceLotRow } from './types';

const t = messages.dispositionDecision.sort;

/** 「CAP-2041|1000|261111|HB01|0003」 → 「0003」 — 미리 보기 · 결과에서 LOT 을 짧게 부른다(시안 W0310-After). */
export const lotTail = (lotNo: string): string =>
  lotNo.includes('|') ? (lotNo.split('|').pop() ?? lotNo) : lotNo;

const sumQty = (lots: readonly NonconformanceLotRow[]): number =>
  lots.reduce((sum, lot) => sum + (lot.affectedQty ?? 0), 0);

export interface SortSplitPaneProps {
  lots: readonly NonconformanceLotRow[];
  value: DecisionFormValue;
  errors: DecisionFormErrors;
  /** 판정 전체가 잠겼다 — 고르기 · 정보 수량도 함께 잠근다. */
  disabled: boolean;
  /** 잠금 사유의 id — 칸마다 잇는다. */
  describedBy: string | undefined;
  /** 「전부 고름」 오류 문구에 붙일 id — 저장 단추가 같은 이유로 잠긴다. */
  allSelectedId: string;
  uomLabel: string;
  /** 원래 IQC 검사(의뢰) 번호 — 미리 보기 「원래 IR-… 와 연결」. */
  inspectionRequestNo: string | null | undefined;
  onChange: (value: DecisionFormValue) => void;
}

/**
 * 선별(005 US7-2 · FR-041) — 불량 자재 관리 LOT 을 골라 새 입하 LOT 로 옮긴다. 수량으로 LOT 를 쪼개지 않는다.
 * 고르지 않은 LOT 은 정상, 고른 LOT 은 불량 그대로 새 부적합(판정 대기)이 된다. 전부를 고를 수는 없다.
 * 양품 · 불량 수량은 정보(선택)일 뿐 재고 · LOT 수량을 바꾸지 않는다.
 */
export const SortSplitPane = ({
  lots,
  value,
  errors,
  disabled,
  describedBy,
  allSelectedId,
  uomLabel,
  inspectionRequestNo,
  onChange,
}: SortSplitPaneProps) => {
  const headingId = useId();
  const noteId = useId();
  const unit = uomLabel === '' ? '' : ` ${uomLabel}`;
  const selected = new Set(value.sortLotIds);
  const moved = lots.filter((lot) => selected.has(lot.lotId));
  const rest = lots.filter((lot) => !selected.has(lot.lotId));
  const isAll = lots.length > 0 && moved.length >= lots.length;
  const names = (rows: readonly NonconformanceLotRow[]): string =>
    rows.map((row) => lotTail(row.lotNoText)).join(', ');

  const toggle = (lotId: number, checked: boolean): void => {
    onChange({
      ...value,
      sortLotIds: checked
        ? [...value.sortLotIds, lotId]
        : value.sortLotIds.filter((id) => id !== lotId),
    });
  };

  return (
    <div className="disposition-sort" role="group" aria-labelledby={headingId}>
      <h4 className="disposition-sort-heading" id={headingId}>
        {t.heading}
      </h4>
      <p className="field-note">{t.help}</p>
      <ul className="disposition-sort-lots" aria-label={t.lotsLabel}>
        {lots.map((lot) => (
          <li key={lot.nonconformanceLotId} className="disposition-sort-lot">
            <Checkbox
              checked={selected.has(lot.lotId)}
              disabled={disabled}
              aria-describedby={describedBy}
              onChange={(event) => toggle(lot.lotId, event.target.checked)}
            >
              {lot.lotNoText}
            </Checkbox>
            <span className="disposition-sort-lot-qty">{`${lot.affectedQtyText}${unit}`}</span>
            <IqcMatchChips
              results={lot.matchedResults}
              rejectedCount={lot.rejectedResultCount}
              emptyText={t.noMatch}
            />
          </li>
        ))}
      </ul>
      {isAll && (
        <p id={allSelectedId} className="field-error" role="alert">
          {t.allSelected}
        </p>
      )}
      <div className="disposition-sort-qty">
        <TextField
          label={t.goodQty}
          value={value.goodQty}
          inputMode="decimal"
          placeholder={formatQty(sumQty(rest))}
          disabled={disabled}
          aria-describedby={[noteId, describedBy ?? ''].join(' ').trim()}
          error={errors.goodQty}
          onChange={(event) => onChange({ ...value, goodQty: event.target.value })}
        />
        <TextField
          label={t.defectQty}
          value={value.defectQty}
          inputMode="decimal"
          placeholder={formatQty(sumQty(moved))}
          disabled={disabled}
          aria-describedby={[noteId, describedBy ?? ''].join(' ').trim()}
          error={errors.defectQty}
          onChange={(event) => onChange({ ...value, defectQty: event.target.value })}
        />
        <p id={noteId} className="field-note">
          {t.qtyNote}
        </p>
      </div>
      {moved.length > 0 && !isAll && (
        <div className="disposition-sort-preview" aria-label={t.previewTitle} role="group">
          <strong>{t.previewTitle}</strong>
          <p>
            <Icon name="check_circle" size={16} aria-hidden />
            {t.previewRest(names(rest), `${formatQty(sumQty(rest))}${unit}`)}
          </p>
          <p>
            <Icon name="call_split" size={16} aria-hidden />
            {t.previewMoved(names(moved), `${formatQty(sumQty(moved))}${unit}`)}
          </p>
          <p>
            <Icon name="fact_check" size={16} aria-hidden />
            {t.previewIqc(inspectionRequestNo ?? null)}
          </p>
        </div>
      )}
    </div>
  );
};
