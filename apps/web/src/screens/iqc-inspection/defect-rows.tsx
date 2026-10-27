import { Button, Checkbox, Icon, IconButton, TextField } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { FieldLabel, unitSuffix } from './field-label';
import { dropLeadingZeros } from './quantity-draft';
import { EMPTY_DEFECT, RejectionReason, type DefectDraft } from './rejection-reason';

const t = messages.iqcInspection.result.rejection;

type DefectCode = components['schemas']['DefectCode'];
type CauseCode = components['schemas']['CauseCode'];

/** 불량 내역 수량의 합 — 불합격 수량이 된다(#197). 수가 아닌 칸은 세지 않는다. */
export const defectSumOf = (rows: readonly DefectDraft[]): number =>
  rows.reduce((total, row) => {
    const qty = Number(row.qty.trim());
    return Number.isFinite(qty) ? total + qty : total;
  }, 0);

export interface DefectRowsProps {
  /** 「불량 등록」 체크 — 켜야 불량 내역 줄이 선다. */
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  codes: readonly DefectCode[];
  causes: readonly CauseCode[];
  rows: readonly DefectDraft[];
  onChange: (rows: DefectDraft[]) => void;
  uomCode: string | null;
  disabled: boolean;
  /** 최종 판정이 불합격이 아니면 저장되지 않는다는 안내를 붙인다(서버가 불합격 판정에만 불량 기록을 받는다). */
  notSaved: boolean;
}

/**
 * 불량 내역(사용자 지시 · 시안 2026-10-28 · #197) — 제목 옆 「불량 등록」을 체크하면 불량 유형별로 코드 · 수량 · 추정 원인 · 사유를
 * 받는다. 불량 유형이 여럿일 수 있어 줄을 더하고 뺀다. 불합격 수량은 따로 받지 않고 이 수량의 합이 된다(부르는 쪽이 맞춘다).
 */
export const DefectRows = ({
  checked,
  onCheckedChange,
  codes,
  causes,
  rows,
  onChange,
  uomCode,
  disabled,
  notSaved,
}: DefectRowsProps) => {
  const idPrefix = useId();
  const update = (index: number, next: DefectDraft): void =>
    onChange(rows.map((row, at) => (at === index ? next : row)));

  return (
    <section className="iqc-inspection-defects" aria-label={t.defectsHeading}>
      <div className="iqc-inspection-defects-head">
        <h4>{t.defectsHeading}</h4>
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
        >
          {t.hasDefects}
        </Checkbox>
        {/* [불량 추가]는 제목 줄 오른쪽 끝(사용자 시안 2026-10-29). */}
        <div className="iqc-inspection-defects-actions">
          {checked && (
            <Button
              type="button"
              variant="outlined"
              size="md"
              leadingIcon={<Icon name="add" size={18} aria-hidden />}
              disabled={disabled}
              onClick={() => onChange([...rows, EMPTY_DEFECT])}
            >
              {t.addDefect}
            </Button>
          )}
        </div>
      </div>
      {checked && notSaved && (
        <p className="iqc-inspection-action-note" data-tone="info">
          <Icon name="info" size={14} aria-hidden />
          {t.defectsNotSaved}
        </p>
      )}
      {checked && (
        <div className="iqc-inspection-defect-table">
          {/*
           * 열 제목 한 번 — 넓은 자리에서만 보인다(사용자 지시 2026-10-29 · #197). 칸마다 라벨이 따로 있어(넓으면 화면 읽기용으로만)
           * 이 줄은 화면 읽기에서 뺀다.
           */}
          <div className="iqc-inspection-defect-header" aria-hidden>
            <span>
              {t.defectType}
              <span className="required-mark">{' *'}</span>
            </span>
            <span>
              {t.defectQty}
              {uomCode !== null && (
                <span className="iqc-inspection-label-unit">{unitSuffix(uomCode)}</span>
              )}
              <span className="required-mark">{' *'}</span>
            </span>
            <span>{t.cause}</span>
            <span>{t.description}</span>
          </div>
          <ol className="iqc-inspection-defect-list">
            {rows.map((row, index) => {
              const qtyId = `${idPrefix}-qty-${String(index)}`;
              return (
                <li key={index} className="iqc-inspection-defect-row">
                  <RejectionReason
                    codes={codes}
                    causes={causes}
                    draft={row}
                    onChange={(next) => update(index, { ...row, ...next })}
                    disabled={disabled}
                    extraFields={
                      <div className="field-cell iqc-inspection-defect-qty">
                        <FieldLabel htmlFor={qtyId} label={t.defectQty} unit={uomCode} required />
                        <TextField
                          id={qtyId}
                          inputMode="decimal"
                          placeholder="0"
                          value={row.qty}
                          disabled={disabled}
                          onChange={(event) =>
                            update(index, { ...row, qty: dropLeadingZeros(event.target.value) })
                          }
                        />
                      </div>
                    }
                  />
                  {/*
                   * 줄 끝 휴지통 — 줄이 하나여도 선다(사용자 지시 2026-10-29). 마지막 한 줄을 지우면 빈 표 대신 그 줄을 비운다.
                   */}
                  <IconButton
                    icon="delete"
                    size="md"
                    className="iqc-inspection-defect-remove"
                    aria-label={t.removeDefect}
                    title={t.removeDefect}
                    disabled={disabled}
                    onClick={() =>
                      onChange(
                        rows.length > 1 ? rows.filter((_, at) => at !== index) : [EMPTY_DEFECT],
                      )
                    }
                  />
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
};
