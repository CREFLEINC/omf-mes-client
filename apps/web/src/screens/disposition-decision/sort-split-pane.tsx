import { Checkbox, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { InfoLabel, InfoTip } from '../../patterns/info-tip';
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
  const goodQtyId = useId();
  const defectQtyId = useId();
  const unit = uomLabel === '' ? '' : ` ${uomLabel}`;
  const selected = new Set(value.sortLotIds);
  const moved = lots.filter((lot) => selected.has(lot.lotId));
  const rest = lots.filter((lot) => !selected.has(lot.lotId));
  const isAll = lots.length > 0 && moved.length >= lots.length;
  /* 요약은 끝 번호로 부른다 — 끝 번호가 겹치는 LOT 이 있으면 헷갈리지 않게 전체 번호로(#352 사용자 지시). */
  const tails = lots.map((lot) => lotTail(lot.lotNoText));
  const useTail = new Set(tails).size === tails.length;
  const names = (rows: readonly NonconformanceLotRow[]): string =>
    rows.map((row) => (useTail ? lotTail(row.lotNoText) : row.lotNoText)).join(', ');

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
      {/* 선별 규칙은 제목 옆 ⓘ 로 — 늘 펼쳐 둘 문장은 아니다(관리웹 정리 시안 A). */}
      {/* LOT 을 하나 이상 골라야 저장된다 — 제목에 필수 표시(#352 사용자 지시). */}
      <h4 className="disposition-sort-heading" id={headingId}>
        {t.heading}
        <span className="required-mark" aria-hidden="true">
          {' *'}
        </span>
        <InfoTip text={t.help} />
      </h4>
      {/* 목록 바로 위 안내 — 고르기 전에도 보인다(#352 사용자 지시). */}
      <p className="iqc-inspection-action-note disposition-sort-note" data-tone="info">
        <Icon name="info" size={14} aria-hidden />
        {t.selectNote}
      </p>
      <ul className="disposition-sort-lots" aria-label={t.lotsLabel}>
        {lots.map((lot) => (
          <li
            key={lot.nonconformanceLotId}
            className="disposition-sort-lot"
            data-checked={selected.has(lot.lotId) ? 'true' : undefined}
          >
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
      {/* 정보 수량이 재고를 바꾸지 않는다는 사실은 칸 이름 옆 ⓘ 로(관리웹 정리 시안 A). */}
      <div className="disposition-sort-qty">
        <div className="field-cell">
          <InfoLabel htmlFor={goodQtyId} label={t.goodQty} info={t.qtyNote} />
          <TextField
            id={goodQtyId}
            value={value.goodQty}
            inputMode="decimal"
            placeholder={formatQty(sumQty(rest))}
            disabled={disabled}
            aria-describedby={describedBy}
            error={errors.goodQty}
            onChange={(event) => onChange({ ...value, goodQty: event.target.value })}
          />
        </div>
        <div className="field-cell">
          <InfoLabel htmlFor={defectQtyId} label={t.defectQty} info={t.qtyNote} />
          <TextField
            id={defectQtyId}
            value={value.defectQty}
            inputMode="decimal"
            placeholder={formatQty(sumQty(moved))}
            disabled={disabled}
            aria-describedby={describedBy}
            error={errors.defectQty}
            onChange={(event) => onChange({ ...value, defectQty: event.target.value })}
          />
        </div>
      </div>
      {/* 저장 후 처리 — 고른 LOT 이 있을 때만(고르기 전엔 위 안내만). 처리 결과와 대상 LOT 을 먼저 보인다(#352 사용자 지시). */}
      {moved.length > 0 && !isAll && (
        <div className="disposition-sort-preview" aria-label={t.previewTitle} role="group">
          <strong>{t.previewTitle}</strong>
          <dl className="disposition-sort-preview-rows">
            <div>
              <dt>
                <Icon name="check_circle" size={16} aria-hidden />
                {t.previewRestLabel}
              </dt>
              <dd>{t.previewTarget(names(rest), `${formatQty(sumQty(rest))}${unit}`)}</dd>
            </div>
            <div>
              <dt>
                <Icon name="call_split" size={16} aria-hidden />
                {t.previewMovedLabel}
              </dt>
              <dd>{t.previewTarget(names(moved), `${formatQty(sumQty(moved))}${unit}`)}</dd>
            </div>
          </dl>
          <ul className="disposition-sort-preview-notes">
            {t.previewNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
            {inspectionRequestNo !== null && inspectionRequestNo !== undefined && (
              <li>{t.previewIqc(inspectionRequestNo)}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
