import { AlertBanner, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { CodeOption } from './code-options';
import {
  DATA_TYPES,
  EMPTY_MEASUREMENT_DRAFT,
  isValueInvalid,
  judgedCount,
  type MeasurementDraft,
  type MeasurementDrafts,
} from './measurement-draft';
import {
  hasCalibrationWarning,
  hasOutOfSpec,
  isOutOfSpec,
  type MeasurementRow,
  type SpecRange,
} from './measurement-rows';

/**
 * 좌측 《검사 항목》 구획 — 화면 스펙 §3 의 왼쪽 464 다.
 *
 * ⭐ **읽기 표가 아니라 입력 구획이다.** 이 화면의 액션 일곱 중 둘이 여기 있다(§5-9) —
 * 항목 판정과 측정값 입력. 줄은 「항목 × 샘플」이고, 검사기준이 「치수를 셋 재라」고 하면
 * 세 줄이 선다.
 *
 * ⛔ **규격 밖이어도 판정을 대신 채우지 않는다**(§6). 벗어난 값에 표를 달아 **눈에 띄게만**
 * 하고, 판정은 사람이 고른다. 자동으로 매기면 검사자가 보지 못한 사이에 판정이 굳는다.
 *
 * ⭐ **진행 n / m 을 보인다**(§3). 무엇이 남았는지가 이 구획의 정보다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.pqcInspection.measurements;

export interface ItemPanelProps {
  rows: MeasurementRow[];
  drafts: MeasurementDrafts;
  onChange: (key: string, draft: MeasurementDraft) => void;
  /** 항목 판정 선택지 — **두 값이다**(합격·불합격). 종합 판정과 그룹이 다르다 */
  judgmentOptions: CodeOption[];
  isLoading: boolean;
  /** 확정된 회차는 고치지 않는다 — 정정이 아니라 재검사로 새 회차를 쌓는다 */
  isLocked: boolean;
}

export const ItemPanel = ({
  rows,
  drafts,
  onChange,
  judgmentOptions,
  isLoading,
  isLocked,
}: ItemPanelProps) => (
  <section className="pane" aria-label={t.heading}>
    <h2 className="field-label">{t.heading}</h2>

    {/* ⭐ 무엇이 남았는지가 이 구획의 정보다(§3 「진행 2 / 3」). */}
    <p className="field-note">{t.progress(judgedCount(rows, drafts), rows.length)}</p>

    {/*
     * ⚠ 규격을 벗어난 값이 있다. ⛔ **차단하지 않는다** — 표시하고 사람이 판정한다.
     * 문구도 「불합격」이라고 말하지 않는다.
     */}
    {hasOutOfSpec(rows) && (
      <div className="banner-slot">
        <AlertBanner variant="warning" title={t.outOfSpec}>
          {t.outOfSpecNote}
        </AlertBanner>
      </div>
    )}

    {/*
     * ⛔ 경고일 뿐 차단이 아니다. 무효화 정책이 미결이라 화면이 값을 빼거나 확정을 막지
     * 않는다 — 무엇을 다시 볼지만 알린다.
     */}
    {hasCalibrationWarning(rows) && (
      <div className="banner-slot">
        <AlertBanner variant="warning" title={t.calibrationWarningTitle}>
          {t.calibrationWarning}
        </AlertBanner>
      </div>
    )}

    <div className="pop-inspect-scroll">
      {rows.length === 0 ? (
        <p className="field-note">{isLoading ? t.loading : t.noItems}</p>
      ) : (
        <ol className="pop-item-list">
          {rows.map((row) => (
            <ItemRow
              key={row.key}
              row={row}
              draft={drafts[row.key] ?? EMPTY_MEASUREMENT_DRAFT}
              onChange={onChange}
              judgmentOptions={judgmentOptions}
              isLocked={isLocked}
            />
          ))}
        </ol>
      )}
    </div>
  </section>
);

interface ItemRowProps {
  row: MeasurementRow;
  draft: MeasurementDraft;
  onChange: (key: string, draft: MeasurementDraft) => void;
  judgmentOptions: CodeOption[];
  isLocked: boolean;
}

const ItemRow = ({ row, draft, onChange, judgmentOptions, isLocked }: ItemRowProps) => {
  const judgmentId = useId();
  const outOfSpec = isOutOfSpec(row);

  return (
    <li className="pop-item">
      <p className="field-label">
        {row.displayNo}. {row.itemName}
        {row.required && ` (${t.requiredMark})`}
      </p>

      {/* 규격은 **한쪽만 있어도 규격이다** — 둘 다 있을 때만 내면 흔한 공차가 사라진다. */}
      <p className="field-note">
        {describeSpec(row.spec)} · {t.sampleOf(row.sampleNo, row.sampleCount)}
      </p>

      <div className="form-grid">
        {/*
         * ⛔ **값 칸은 그 항목의 유형이 정한다.** 육안 항목에는 값 칸이 아예 없고 판정만으로
         * 성립한다 — 없는 칸을 그리면 검사자가 무엇을 채워야 하는지 헷갈린다.
         */}
        {row.dataTypeCode === DATA_TYPES.boolean ? (
          <Select
            aria-label={`${row.itemName} ${t.columns.value}`}
            options={BOOLEAN_OPTIONS}
            value={draft.value}
            placeholder={t.notMeasured}
            disabled={isLocked}
            onChange={(value) => onChange(row.key, { ...draft, value })}
          />
        ) : (
          <TextField
            label={t.columns.value}
            inputMode={row.dataTypeCode === DATA_TYPES.numeric ? 'decimal' : 'text'}
            value={draft.value}
            disabled={isLocked}
            error={isValueInvalid(row, draft) ? t.valueInvalid : undefined}
            onChange={(event) => onChange(row.key, { ...draft, value: event.target.value })}
          />
        )}

        <div className="field-cell">
          <label className="field-label" htmlFor={judgmentId}>
            {t.columns.judgment}
          </label>
          <Select
            id={judgmentId}
            options={judgmentOptions}
            value={draft.judgment}
            placeholder={t.judgmentPlaceholder}
            disabled={isLocked || judgmentOptions.length === 0}
            onChange={(judgment) => onChange(row.key, { ...draft, judgment })}
          />
          {judgmentOptions.length === 0 && <p className="field-note">{t.judgmentUnavailable}</p>}
        </div>
      </div>

      {/*
       * ⛔ **표시일 뿐 판정이 아니다**(§6). 이 표가 붙어도 위 판정 칸은 비어 있는 채로 남고,
       * 사람이 고르기 전까지 아무 판정도 저장되지 않는다.
       */}
      {outOfSpec && (
        <Chip variant="status" size="sm" status="error">
          {t.outOfSpec}
        </Chip>
      )}
      {row.measured?.calibrationExpired === true && (
        <Chip variant="status" size="sm" status="warning">
          {t.calibrationExpired}
        </Chip>
      )}
    </li>
  );
};

/** 불리언 항목의 값 선택지. **판정과 다른 축이다** — 이 칸은 「측정 결과」다. */
const BOOLEAN_OPTIONS: CodeOption[] = [
  { value: 'true', label: t.booleanTrue },
  { value: 'false', label: t.booleanFalse },
];

/**
 * 규격을 한 줄로. **한쪽만 있는 것도 규격이다** — 「9.9 이상」 같은 공차가 실제 검사기준에
 * 흔하다. ⛔ 둘 다 있을 때만 내면 화면이 「규격 없음」이라고 말해 검사자가 공차를 모르고 잰다.
 */
const describeSpec = (spec: SpecRange): string => {
  const parts: string[] = [];

  if (spec.target !== null) parts.push(t.target(spec.target));

  if (spec.lower !== null && spec.upper !== null) parts.push(t.range(spec.lower, spec.upper));
  else if (spec.lower !== null) parts.push(t.atLeast(spec.lower));
  else if (spec.upper !== null) parts.push(t.atMost(spec.upper));

  return parts.length === 0 ? t.notMeasured : parts.join(' · ');
};
