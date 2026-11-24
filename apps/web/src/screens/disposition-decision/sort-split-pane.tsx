import { Checkbox, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { InfoLabel } from '../../patterns/info-tip';
import type { DecisionFormErrors, DecisionFormValue } from './decision-form';
import { IqcMatchChips } from './iqc-match';
import { formatQty, type NonconformanceLotRow } from './types';

const t = messages.dispositionDecision.sort;

/** 「CAP-2041|1000|261111|HB01|0003」 → 「0003」 — 미리 보기 · 결과에서 LOT 을 짧게 부른다(시안 W0310-After). */
export const lotTail = (lotNo: string): string =>
  lotNo.includes('|') ? (lotNo.split('|').pop() ?? lotNo) : lotNo;

export const sumQty = (lots: readonly NonconformanceLotRow[]): number =>
  lots.reduce((sum, lot) => sum + (lot.affectedQty ?? 0), 0);

/**
 * 고른 대로의 양품 · 불량 수량 «값» — 고르지 않은 LOT 합이 양품, 고른 LOT 합이 불량이다. 하나도 고르지 않았으면 전부 양품 · 불량 0
 * (선별을 고르자마자 칸이 채워져 있게 · omf-all-around#354 사용자 지시).
 */
export const sortQtyValues = (
  lots: readonly NonconformanceLotRow[],
  sortLotIds: readonly number[],
): { goodQty: string; defectQty: string } => {
  const picked = new Set(sortLotIds);
  const text = (rows: readonly NonconformanceLotRow[]): string =>
    String(Math.round(sumQty(rows) * 1e6) / 1e6);
  return {
    goodQty: text(lots.filter((lot) => !picked.has(lot.lotId))),
    defectQty: text(lots.filter((lot) => picked.has(lot.lotId))),
  };
};

/**
 * 요약에서 LOT 을 부르는 이름 — 끝 번호로 부르되, 끝 번호가 겹치는 LOT 이 있으면 헷갈리지 않게 전체 번호로(#352 사용자 지시).
 * 저장 후 처리 상자와 판정 확인 팝업이 같은 이름을 쓴다.
 */
export const lotNames = (
  lots: readonly NonconformanceLotRow[],
  rows: readonly NonconformanceLotRow[],
): string => {
  const tails = lots.map((lot) => lotTail(lot.lotNoText));
  const useTail = new Set(tails).size === tails.length;
  return rows.map((row) => (useTail ? lotTail(row.lotNoText) : row.lotNoText)).join(', ');
};

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
  const names = (rows: readonly NonconformanceLotRow[]): string => lotNames(lots, rows);

  /*
   * LOT 을 고르거나 풀 때마다 양품 · 불량 수량 칸에 고른 대로의 합을 «값으로» 채운다 — 사용자가 그대로 고쳐 쓸 수 있다(#352 사용자 지시).
   * 하나도 고르지 않으면 전부 양품 · 불량 0 으로(#354 사용자 지시).
   */
  const toggle = (lotId: number, checked: boolean): void => {
    const sortLotIds = checked
      ? [...value.sortLotIds, lotId]
      : value.sortLotIds.filter((id) => id !== lotId);
    onChange({ ...value, sortLotIds, ...sortQtyValues(lots, sortLotIds) });
  };

  return (
    <div className="disposition-sort" role="group" aria-labelledby={headingId}>
      {/*
       * 제목 옆 ⓘ 설명은 두지 않는다. 고른 LOT 이 어떻게 되는지는 [취소] 왼쪽 안내 라벨로(omf-all-around#354 사용자 지시).
       * LOT 을 하나 이상 골라야 저장된다 — 제목에 필수 표시(#352 사용자 지시).
       */}
      <div className="disposition-sort-head">
        <h4 className="disposition-sort-heading" id={headingId}>
          {t.heading}
          <span className="required-mark" aria-hidden="true">
            {' *'}
          </span>
        </h4>
        {/* 제목 오른쪽 안내 라벨(omf-all-around#354 사용자 지시). */}
        <p className="iqc-inspection-action-note disposition-sort-note" data-tone="info">
          <Icon name="info" size={14} aria-hidden />
          {t.headNote}
        </p>
      </div>
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
          {/* 제목 앞 아이콘 · 아래 보조 안내는 같은 화면의 저장 결과 카드와 같은 모양(#352 사용자 지시). */}
          <strong>
            <Icon name="fact_check" size={18} aria-hidden />
            {t.previewTitle}
          </strong>
          {/* 처리 한 줄씩 아이콘 + 처리 이름 + 대상 LOT · 수량 — 저장 결과 카드의 줄과 같은 모양(#352 사용자 지시). */}
          <p>
            <Icon name="check_circle" size={16} aria-hidden />
            <span>{t.previewRestLabel}</span>
            <span>{t.previewTarget(names(rest), `${formatQty(sumQty(rest))}${unit}`)}</span>
          </p>
          <p>
            <Icon name="call_split" size={16} aria-hidden />
            <span>{t.previewMovedLabel}</span>
            <span>{t.previewTarget(names(moved), `${formatQty(sumQty(moved))}${unit}`)}</span>
          </p>
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
