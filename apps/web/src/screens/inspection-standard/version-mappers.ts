import type { components } from '@omf-mes/api-client';

import type { InspectionPlanVersion, VersionFormValues } from './types';

type InspectionPlanVersionCreate = components['schemas']['InspectionPlanVersionCreate'];
type InspectionPlanVersionUpdate = components['schemas']['InspectionPlanVersionUpdate'];

/** 널·없음을 빈 문자열로 모은다. **0은 빈 문자열이 아니다** — 「지정하지 않음」과 구분해야 한다. */
const optionalNumberToText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

const optionalTextToNumber = (value: string): number | null =>
  value === '' ? null : Number(value);

const optionalText = (value: string): string | null => (value === '' ? null : value);

export const versionToFormValues = (version: InspectionPlanVersion): VersionFormValues => ({
  effectiveFrom: version.effectiveFrom,
  effectiveTo: version.effectiveTo ?? '',
  samplingMethodCode: version.samplingMethodCode,
  samplingQty: optionalNumberToText(version.samplingQty),
  aqlValue: optionalNumberToText(version.aqlValue),
  acceptanceNumber: optionalNumberToText(version.acceptanceNumber),
  rejectionNumber: optionalNumberToText(version.rejectionNumber),
  inspectionFrequencyCode: version.inspectionFrequencyCode,
  frequencyIntervalValue: optionalNumberToText(version.frequencyIntervalValue),
  frequencyIntervalUomCode: version.frequencyIntervalUomCode ?? '',
});

export const emptyVersionFormValues = (): VersionFormValues => ({
  effectiveFrom: '',
  effectiveTo: '',
  samplingMethodCode: '',
  samplingQty: '',
  aqlValue: '',
  acceptanceNumber: '',
  rejectionNumber: '',
  inspectionFrequencyCode: '',
  frequencyIntervalValue: '',
  frequencyIntervalUomCode: '',
});

/**
 * 버전 수정 요청 본문.
 *
 * **기준 번호·판 번호·상태를 싣지 않는다** — 판 번호는 시스템 채번이고 상태는
 * `:new-revision`·`:confirm`·`:obsolete`로만 전이한다. 실어 보내면 계약 위반이다.
 */
export const toVersionUpdate = (values: VersionFormValues): InspectionPlanVersionUpdate => ({
  effectiveFrom: values.effectiveFrom,
  effectiveTo: optionalText(values.effectiveTo),
  samplingMethodCode: values.samplingMethodCode,
  // 개수다. 비율로 환산하지 않는다 — 환산하면 30이 0.3으로 저장된다.
  samplingQty: optionalTextToNumber(values.samplingQty),
  aqlValue: optionalTextToNumber(values.aqlValue),
  acceptanceNumber: optionalTextToNumber(values.acceptanceNumber),
  rejectionNumber: optionalTextToNumber(values.rejectionNumber),
  inspectionFrequencyCode: values.inspectionFrequencyCode,
  frequencyIntervalValue: optionalTextToNumber(values.frequencyIntervalValue),
  frequencyIntervalUomCode: optionalText(values.frequencyIntervalUomCode),
});

/**
 * 첫 버전 등록 요청 본문. 수정 본문에 기준 번호를 더한 것이 전부다 —
 * 판 번호는 서버가 항상 1로, 상태는 항상 작성중으로 채운다(계약).
 */
export const toVersionCreate = (
  values: VersionFormValues,
  inspectionPlanId: number,
): InspectionPlanVersionCreate => ({
  ...toVersionUpdate(values),
  inspectionPlanId,
});

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameVersionValues = (a: VersionFormValues, b: VersionFormValues): boolean =>
  (Object.keys(a) as (keyof VersionFormValues)[]).every((key) => a[key] === b[key]);
