import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { FULL_INSPECTION, SAMPLING_METHOD_OPTIONS, ensureOption } from './code-options';
import type { SelectOption, VersionFormValues } from './types';

const t = messages.inspectionStandard;

export interface VersionSummaryProps {
  /** 저장된 값(편집 중인 초안이 아니다) — 요약은 서버에 있는 사실을 말한다. */
  values: VersionFormValues;
  /** 검사 주기 · 주기 단위 선택지 — 공통코드에서 받은 것(버전 폼과 같은 출처 · #194). */
  inspectionFrequencyOptions: SelectOption[];
  frequencyIntervalUomOptions: SelectOption[];
  /** 안내 문구 언어별 「수정」 — 작성중 버전에서만 넘긴다(확정 버전은 잠긴다 · #252). */
  onEditGuide?: (field: GuideTextField) => void;
}

export type GuideTextField = 'guideTextKo' | 'guideTextVi';

const labelOf = (options: { value: string; label: string }[], value: string): string =>
  value === ''
    ? messages.common.reference.empty
    : (ensureOption(options, value).find((option) => option.value === value)?.label ?? value);

const orNotSet = (value: string): string => (value === '' ? t.versionSection.notSet : value);

/**
 * 고른 버전의 요약 한 줄 — 유효기간 · 샘플링(샘플링 검사면 비율을 함께) · 검사 주기(사용자 시안 · omf-all-around#196).
 * 버전 번호 · 상태는 위 선택칸이 말한다. 고칠 수 없는 버전의 「버전 설정」 탭은 이 값들을 되풀이하지 않는다.
 */
export const VersionSummary = ({
  values,
  inspectionFrequencyOptions,
  frequencyIntervalUomOptions,
  onEditGuide,
}: VersionSummaryProps) => {
  const sampling = labelOf(SAMPLING_METHOD_OPTIONS, values.samplingMethodCode);
  /* 샘플링 검사면 비율(%) 또는 개수 중 들어 있는 쪽을 함께 낸다(#201). */
  const isSampling =
    values.samplingMethodCode !== FULL_INSPECTION && values.samplingMethodCode !== '';
  const withRatio = !isSampling
    ? sampling
    : values.samplingRatio !== ''
      ? `${sampling} · ${values.samplingRatio}%`
      : values.samplingQty !== ''
        ? `${sampling} · ${t.versionSection.samplingQtyValue(values.samplingQty)}`
        : sampling;

  const facts: { label: string; value: string }[] = [
    {
      label: t.versionSection.effectivePeriod,
      value: `${values.effectiveFrom === '' ? messages.common.reference.empty : values.effectiveFrom} ~ ${
        values.effectiveTo === '' ? t.versionSection.noEnd : values.effectiveTo
      }`,
    },
    { label: t.versionSection.sampling, value: withRatio },
    {
      label: t.fields.inspectionFrequency,
      value: labelOf(inspectionFrequencyOptions, values.inspectionFrequencyCode),
    },
    /* 「버전 설정」 탭을 걷고 그 값도 이 줄에 싣는다 — 비었으면 「미설정」(사용자 지시 · #196). */
    { label: t.fields.aqlValue, value: orNotSet(values.aqlValue) },
    { label: t.fields.acceptanceNumber, value: orNotSet(values.acceptanceNumber) },
    { label: t.fields.rejectionNumber, value: orNotSet(values.rejectionNumber) },
    {
      label: t.fields.frequencyIntervalValue,
      value:
        values.frequencyIntervalValue === ''
          ? t.versionSection.notSet
          : [
              values.frequencyIntervalValue,
              values.frequencyIntervalUomCode === ''
                ? ''
                : labelOf(frequencyIntervalUomOptions, values.frequencyIntervalUomCode),
            ]
              .filter((part) => part !== '')
              .join(' '),
    },
  ];

  /*
   * 안내 문구(#252)는 길 수 있어 요약 줄 아래에 언어별로 따로 보인다. 고칠 수 있는 버전이면 비어도 두 줄 다 두고 줄마다 「수정」 —
   * 긴 글을 버전 설정 창에서 고치지 않고 언어별 창에서 고친다(사용자 지시). 잠긴 버전은 문구가 있는 줄만, 둘 다 비면 두지 않는다.
   */
  const guides = (['guideTextKo', 'guideTextVi'] as const).filter(
    (field) => onEditGuide !== undefined || values[field].trim() !== '',
  );

  return (
    <>
      <dl className="inspection-standard-facts-line">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="field-label">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {guides.length > 0 && (
        <dl className="inspection-standard-guide-line">
          {guides.map((field) => (
            <div key={field}>
              <dt className="field-label">
                {t.fields[field]}
                {onEditGuide !== undefined && (
                  <Button
                    variant="outlined"
                    size="sm"
                    aria-label={t.versionSection.editGuide(t.fields[field])}
                    onClick={() => onEditGuide(field)}
                  >
                    {t.versionSection.guideEdit}
                  </Button>
                )}
              </dt>
              <dd>{values[field].trim() === '' ? t.versionSection.notSet : values[field]}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
};
