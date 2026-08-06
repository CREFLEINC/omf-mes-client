import { messages } from '@omf-mes/i18n';

import type { LocationFormValues } from './types';

const t = messages.warehouseLocation.validation;

/** Location 다이얼로그가 소유한 입력칸 이름. 서버 오류를 인라인으로 낼지 가르는 기준이다. */
export const LOCATION_FORM_FIELDS: readonly string[] = [
  'locationCode',
  'locationName',
  'locationTypeCode',
  'qualityZoneCode',
  'storageConditionCode',
  'allowMixedItem',
  'allowMixedLot',
  'capacityQty',
  'capacityUomId',
];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 * 수용량과 단위의 짝 제약은 계약이 정의한 것이라 저장 시점이 아니라 여기서 알린다.
 */
export const validateLocation = (values: LocationFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.locationCode === '') {
    errors.locationCode = t.required;
  } else if (values.locationCode.trim() === '') {
    errors.locationCode = t.codeBlank;
  }

  if (values.locationName.trim() === '') {
    errors.locationName = t.required;
  }

  const capacityQty = values.capacityQty.trim();
  const hasUom = values.capacityUomId !== '';

  if (capacityQty === '') {
    // 둘 다 비었으면 「지정하지 않음」이다. 한쪽만 있으면 제약 위반이다.
    if (hasUom) {
      errors.capacityQty = t.capacityNeedsUom;
    }
  } else {
    const parsed = Number(capacityQty);

    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.capacityQty = t.capacityInvalid;
    } else if (!hasUom) {
      errors.capacityUomId = t.capacityNeedsUom;
    }
  }

  return errors;
};
