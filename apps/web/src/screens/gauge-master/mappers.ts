import type { components } from '@omf-mes/api-client';

import { PENDING_CODE_VALUE } from './code-options';
import type { CarriedGaugeValues, Equipment, GaugeFormValues } from './types';

type EquipmentCreate = components['schemas']['EquipmentCreate'];
type EquipmentUpdate = components['schemas']['EquipmentUpdate'];

/** 선택칸에 담을 식별자. 없는 값은 빈 문자열이라 「고르지 않음」과 같은 모양이 된다. */
const optionalIdToText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

const textToOptionalId = (value: string): number | null => (value === '' ? null : Number(value));

/** 수 칸의 문자열을 계약의 수로. 빈 칸은 「없음」이다. */
const textToOptionalNumber = (value: string): number | null =>
  value.trim() === '' ? null : Number(value);

const numberToText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

/** 상세에서 받은 계측기를 폼 값으로. */
export const formValuesFrom = (gauge: Equipment): GaugeFormValues => ({
  equipmentCode: gauge.equipmentCode,
  equipmentName: gauge.equipmentName,
  equipmentTypeCode: gauge.equipmentTypeCode,
  plantId: String(gauge.plantId),
  calibrationRequired: gauge.calibrationRequired,
  calibrationCycleTypeCode: gauge.calibrationCycleTypeCode ?? '',
  calibrationCycleInterval: numberToText(gauge.calibrationCycleInterval),
  precisionValue: numberToText(gauge.precisionValue),
  precisionUomId: optionalIdToText(gauge.precisionUomId),
});

/** 이 화면이 소유하지 않는 값을 상세에서 그대로 떠 둔다. */
export const carriedFrom = (gauge: Equipment): CarriedGaugeValues => ({
  productionLineId: gauge.productionLineId ?? null,
  processId: gauge.processId ?? null,
});

/** 신규 계측기 폼의 초기값. 공장은 목록에서 고른 것이 있으면 그것을 따른다. */
export const emptyFormValues = (plantId: string): GaugeFormValues => ({
  equipmentCode: '',
  equipmentName: '',
  equipmentTypeCode: PENDING_CODE_VALUE,
  plantId,
  calibrationRequired: false,
  calibrationCycleTypeCode: '',
  calibrationCycleInterval: '',
  precisionValue: '',
  precisionUomId: '',
});

/** 신규 계측기에는 설비 마스터가 정한 소속이 아직 없다. */
export const emptyCarriedValues = (): CarriedGaugeValues => ({
  productionLineId: null,
  processId: null,
});

/**
 * 계측기 수정 요청 본문.
 *
 * ⛔ **`statusCode` 는 실리지 않는다** — 폐기는 `:dispose` 가, 사용 중지는 `:deactivate` 가
 * 받는다. `lastCalibrationDate`·`calibrationDueDate` 도 받지 않는다 — **검교정 이력 등록이
 * 정한다**(스펙 §6). 이 화면은 그 둘을 읽기만 한다.
 *
 * ⛔ **`plantId` 는 실리지 않는다** — 계약이 수정 본문에 두지 않았다. 공장을 옮기는 것은
 * 자산을 옮기는 일이라 이 화면의 일이 아니다.
 *
 * ⭐ **검교정 대상이 아니면 주기를 비운다.** 짝 제약이 「대상일 때만 뜻이 있다」는 말이므로
 * 값을 남겨 두면 서버 자료가 모순 상태가 된다 — 대상이 아닌데 3개월 주기가 붙어 있는 꼴이다.
 * 폼에는 남겨 둔다(다시 켜면 방금 적은 것이 그대로 있다) — **지우는 자리는 보낼 때 하나다.**
 *
 * ⭐ **`carried` 를 그대로 되돌려 보낸다** — 전체 교체라 빼면 설비 마스터가 정한 소속이 지워진다.
 */
export const toGaugeUpdate = (
  values: GaugeFormValues,
  carried: CarriedGaugeValues,
  codeEditable: boolean,
): EquipmentUpdate => ({
  ...(codeEditable ? { equipmentCode: values.equipmentCode.trim() } : {}),
  equipmentName: values.equipmentName.trim(),
  equipmentTypeCode: values.equipmentTypeCode,
  productionLineId: carried.productionLineId,
  processId: carried.processId,
  calibrationRequired: values.calibrationRequired,
  calibrationCycleTypeCode: values.calibrationRequired ? values.calibrationCycleTypeCode : null,
  calibrationCycleInterval: values.calibrationRequired
    ? textToOptionalNumber(values.calibrationCycleInterval)
    : null,
  precisionValue: textToOptionalNumber(values.precisionValue),
  precisionUomId: textToOptionalId(values.precisionUomId),
});

/** 계측기 등록 요청 본문. 계약상 수정 본문에 `plantId` 를 더한 형태다. */
export const toGaugeCreate = (
  values: GaugeFormValues,
  carried: CarriedGaugeValues,
): EquipmentCreate => ({
  ...toGaugeUpdate(values, carried, true),
  equipmentCode: values.equipmentCode.trim(),
  plantId: Number(values.plantId),
});

/** 기준값과 지금 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameGaugeValues = (a: GaugeFormValues, b: GaugeFormValues): boolean =>
  a.equipmentCode === b.equipmentCode &&
  a.equipmentName === b.equipmentName &&
  a.equipmentTypeCode === b.equipmentTypeCode &&
  a.plantId === b.plantId &&
  a.calibrationRequired === b.calibrationRequired &&
  a.calibrationCycleTypeCode === b.calibrationCycleTypeCode &&
  a.calibrationCycleInterval === b.calibrationCycleInterval &&
  a.precisionValue === b.precisionValue &&
  a.precisionUomId === b.precisionUomId;
