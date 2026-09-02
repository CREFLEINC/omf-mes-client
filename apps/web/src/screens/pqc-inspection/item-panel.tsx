import { Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { lacksLimits } from './auto-judgment';
import { isKnownCode, type CodeOption } from './code-options';
import {
  DATA_TYPES,
  EMPTY_MEASUREMENT_DRAFT,
  isValueInvalid,
  judgedCount,
  type MeasurementDraft,
  type MeasurementDrafts,
} from './measurement-draft';
import { isOutOfSpec, type MeasurementRow, type SpecRange } from './measurement-rows';

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
const tDetail = messages.pqcInspection.detail;

export interface ItemPanelProps {
  /** 검사 시점에 고정된 기준 버전. §3 도면이 이 구획 머리에 둔다 */
  inspectionPlanVersionId: number;
  rows: MeasurementRow[];
  drafts: MeasurementDrafts;
  onChange: (key: string, draft: MeasurementDraft) => void;
  /** 항목 판정 선택지 — **두 값이다**(합격·불합격). 종합 판정과 그룹이 다르다 */
  judgmentOptions: CodeOption[];
  isLoading: boolean;
}

export const ItemPanel = ({
  inspectionPlanVersionId,
  rows,
  drafts,
  onChange,
  judgmentOptions,
  isLoading,
}: ItemPanelProps) => (
  <section className="pane" aria-label={t.heading}>
    <h2 className="field-label">{t.heading}</h2>

    {/*
     * ⭐ **기준 버전과 샘플 수가 이 구획의 머리다**(§3 도면 「기준 IP-… v2 / 샘플 30」).
     * 검사 시점의 기준 버전이 그 검사에 고정되고, 이후 기준이 바뀌어도 이 검사는 당시
     * 버전으로 남는다 — 감추면 어느 기준으로 잰 값인지 아무도 모른다.
     */}
    <p className="field-note">
      {tDetail.fields.inspectionPlanVersionId} {inspectionPlanVersionId}
    </p>
    <p className="field-note">{tDetail.planVersionNote}</p>

    {/*
     * ⚠ **샘플 수의 단위가 확정되지 않았다**(§8 #5 · 공유계약 A-8). ⛔ 어느 한쪽으로 읽어
     * 계산하지 않고 **단위가 미확정이라는 사실을 화면에 밝힌다.**
     */}
    <p className="field-note">{tDetail.sampleUnitPending}</p>

    {/* ⭐ 무엇이 남았는지가 이 구획의 정보다(§3 「진행 2 / 3」). */}
    <p className="field-note">{t.progress(judgedCount(rows, drafts), rows.length)}</p>

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
}

const ItemRow = ({ row, draft, onChange, judgmentOptions }: ItemRowProps) => {
  const judgmentId = useId();
  const outOfSpec = isOutOfSpec(row);

  return (
    <li className="pop-item">
      <p className="field-label">
        {row.displayNo}. {row.itemName}
        {row.required && ` (${t.requiredMark})`}
      </p>

      {/*
       * 규격은 **한쪽만 있어도 규격이다** — 둘 다 있을 때만 내면 흔한 공차가 사라진다.
       *
       * ⚠ 규격과 샘플을 **한 줄에 잇지 않는다.** 이으면 「목표 1 · 1 ~ 1 · 1 중 1」처럼 숫자만
       * 늘어서 무엇이 공차이고 무엇이 샘플 번호인지 읽히지 않는다.
       */}
      <p className="field-note">
        {t.columns.spec} {describeSpec(row.spec)}
      </p>
      <p className="field-note">
        {t.columns.sample} {t.sampleOf(row.sampleNo, row.sampleCount)}
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

            onChange={(value) => onChange(row.key, { ...draft, value })}
          />
        ) : (
          <TextField
            label={t.columns.value}
            inputMode={row.dataTypeCode === DATA_TYPES.numeric ? 'decimal' : 'text'}
            value={draft.value}

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
            disabled={judgmentOptions.length === 0}
            onChange={(judgment) => onChange(row.key, { ...draft, judgment })}
          />
          {judgmentOptions.length === 0 && <p className="field-note">{t.judgmentUnavailable}</p>}
          {/*
           * ⚠ 저장된 판정이 목록에서 사라졌다. 조용히 비우면 **선택칸은 비어 보이는데 화면은
           * 값을 들고 있어**, 아무도 판정하지 않은 줄로 읽히고 「진행 n / m」도 어긋나 보인다.
           */}
          {!isKnownCode(judgmentOptions, draft.judgment) && (
            <p className="field-note">{t.judgmentUnknown(draft.judgment)}</p>
          )}
          {/*
           * ⚠ 자동 판정 플래그는 켜졌는데 기준이 없어 판정이 서지 않는다(§6). ⛔ 저장을
           * 막지 않고 사유만 보인다 — 사람이 고르면 된다(조항 G-15).
           */}
          {lacksLimits(row) && <p className="field-note">{t.autoJudgmentNoLimits}</p>}
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
