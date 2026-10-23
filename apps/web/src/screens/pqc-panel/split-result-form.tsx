import { Chip, Radio, RadioGroup, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactElement, type ReactNode } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';
import { isKnownCode, type CodeOption } from '../pqc-inspection/code-options';
import { canChooseDisposition, type DispositionState } from '../pqc-inspection/disposition';
import {
  formatMicro,
  toMicro,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from '../pqc-inspection/quantity-draft';

const t = messages.pqcInspection.result;
const tDisposition = messages.pqcInspection.disposition;
const tPanel = messages.pqcInspection.panel;
const unknownValue = messages.pqcInspection.emptyValue;

type PadTarget = { key: keyof QuantityDraft | 'inspected'; label: string };

export interface SplitResultFormProps {
  inspectedDraft: string;
  onInspectedChange: (raw: string) => void;
  inspectedQty: number;
  uomCode: string | null;
  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;
  fieldErrors: Record<string, string>;
  errorBanner?: ReactNode;
  showErrors: boolean;
  judgmentOptions: CodeOption[];
  judgment: string;
  onJudgmentChange: (code: string) => void;
  disposition: DispositionState;
  onDispositionChange: (choice: DispositionState) => void;
  onPadFieldChange: (target: PadTarget | null) => void;
  isLocked: boolean;
  /** 관리웹 폼과 같은 꼴을 맞추려 받는다 — POP 분할 화면은 쓰지 않는다. */
  targetQty?: number;
}

const FIELD_OF: Record<string, keyof QuantityDraft> = {
  acceptedQty: 'accepted',
  rejectedQty: 'rejected',
  heldQty: 'held',
};

const rejectedMicro = (raw: string): bigint | null => (raw.trim() === '' ? 0n : toMicro(raw));

const toDisposition = (value: string): DispositionState =>
  value === 'REWORK' || value === 'SCRAP' ? value : null;

/**
 * POP 생산 실적 분할 패널의 《결과 입력》(omf-all-around#107 UI/UX) — 수량 넷을 한 줄에, 종합 판정 옆에 처분을 둔다.
 * 관리웹 W-03-11 은 `result-form` 을 그대로 쓴다(웹 UI/UX 는 하지 않기로 했다).
 *
 * 판정·수량 규칙은 단독 화면 P-02-13 의 `pqc-inspection/result-panel` 과 같다 — 그 화면은 건드리지 않기로 해
 * (사용자 결정) 패널 몫을 따로 둔다. ⛔ 적용 생산구간(시작·종료 시각) 칸이 없다 — 서버가 그 값을 어디에도
 * 저장하지 않아(계약 저장 본문에 칸이 없다) 패널에서 걷었다(담당자 결정 2026-10-19).
 */
export const SplitResultForm = ({
  inspectedDraft,
  onInspectedChange,
  inspectedQty,
  uomCode,
  draft,
  onChange,
  fieldErrors,
  errorBanner,
  showErrors,
  judgmentOptions,
  judgment,
  onJudgmentChange,
  onPadFieldChange,
  disposition,
  onDispositionChange,
  isLocked,
}: SplitResultFormProps) => {
  const judgmentId = useId();
  const dispositionName = useId();
  const dispositionLabelId = useId();
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);
  const inspectedInvalid = inspectedDraft.trim() !== '' && toMicro(inspectedDraft) === null;
  const canChoose = canChooseDisposition(rejectedMicro(draft.rejected));

  const serverErrorOf = (key: keyof QuantityDraft): string | undefined => {
    const entry = Object.entries(FIELD_OF).find(([, local]) => local === key);

    return entry === undefined ? undefined : fieldErrors[entry[0]];
  };

  const withUnit = (value: string): string => (uomCode === null ? value : `${value} ${uomCode}`);
  const totalsNote =
    isLocked || totals.kind === 'uncountable'
      ? null
      : totals.matches
        ? t.matched
        : totals.remaining > 0n
          ? tPanel.short(withUnit(formatMicro(totals.remaining)))
          : tPanel.over(withUnit(formatMicro(-totals.remaining)));
  const uomSuffix = uomCode === null ? undefined : <span className="pop-uom">{uomCode}</span>;

  const field = (key: keyof QuantityDraft, label: string, invalid: boolean): ReactElement => (
    <TextField
      size="xl"
      label={label}
      trailingIcon={uomSuffix}
      inputMode="decimal"
      value={draft[key]}
      disabled={isLocked}
      error={serverErrorOf(key) ?? (showErrors && invalid ? t.quantityInvalid : undefined)}
      onClick={() => onPadFieldChange({ key, label })}
      onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
    />
  );

  return (
    <section className="pqc-panel-result" aria-label={t.heading}>
      {errorBanner}

      <div className="pqc-panel-qty">
        <TextField
          size="xl"
          label={t.fields.inspectedQty}
          trailingIcon={uomSuffix}
          inputMode="decimal"
          value={inspectedDraft}
          disabled={isLocked}
          error={showErrors && inspectedInvalid ? t.quantityInvalid : undefined}
          onClick={() => onPadFieldChange({ key: 'inspected', label: t.fields.inspectedQty })}
          onChange={(event) => onInspectedChange(event.target.value)}
        />
        {field('accepted', t.fields.accepted, errors.accepted)}
        {field('rejected', t.fields.rejected, errors.rejected)}
        {field('held', t.fields.held, errors.held)}
      </div>

      <p className="pqc-panel-totals">
        <span className="field-label">{t.sum}</span>
        <span className="pqc-panel-totals__value">
          {totals.kind === 'counted'
            ? t.of(formatMicro(totals.sum), withUnit(formatMicro(totals.inspected)))
            : unknownValue}
        </span>
        {totalsNote !== null && (
          <Chip
            className="pqc-panel-totals__note"
            status={totals.kind === 'counted' && totals.matches ? 'success' : 'warning'}
            size="md"
            leadingIcon={
              <span aria-hidden="true">
                {totals.kind === 'counted' && totals.matches ? '✓' : '⚠'}
              </span>
            }
          >
            {totalsNote}
          </Chip>
        )}
      </p>

      <div className="pqc-panel-verdict">
        <div className="field-cell">
          <label className="field-label" htmlFor={judgmentId}>
            {t.judgment}
          </label>
          <Select
            id={judgmentId}
            size="xl"
            aria-label={t.judgment}
            options={judgmentOptions}
            value={judgmentOptions.length === 0 ? null : judgment}
            placeholder={
              judgmentOptions.length === 0 ? t.judgmentUnavailable : tPanel.judgmentPlaceholder
            }
            disabled={isLocked || judgmentOptions.length === 0}
            onChange={onJudgmentChange}
          />
          {judgmentOptions.length > 0 && !isKnownCode(judgmentOptions, judgment) && (
            <p className="field-note">{t.judgmentUnknown(judgment)}</p>
          )}
        </div>

        <div className="field-cell">
          <p className="field-label" id={dispositionLabelId}>
            {tDisposition.heading}
          </p>
          <RadioGroup
            className="pqc-disposition"
            name={dispositionName}
            value={disposition ?? ''}
            disabled={isLocked || !canChoose}
            aria-labelledby={dispositionLabelId}
            onChange={(value) => onDispositionChange(value === '' ? null : toDisposition(value))}
          >
            <Radio value="REWORK">{tDisposition.rework}</Radio>
            <Radio value="SCRAP">{tDisposition.scrap}</Radio>
          </RadioGroup>
          <p className="field-note">{tPanel.dispositionNote}</p>
        </div>
      </div>
    </section>
  );
};
