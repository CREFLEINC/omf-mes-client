import { messages } from '@omf-mes/i18n';

import type { LocationFormValues } from './types';

const t = messages.warehouseLocation.validation;

/** Location 다이얼로그가 소유한 칸 이름. 서버 오류를 인라인으로 낼지 가르는 기준이다. */
export const LOCATION_FORM_FIELDS: readonly string[] = [
  'parentLocationId',
  'locationCode',
  'aliasName',
];

/** 서버 한도(#875) — 넘으면 400 INVALID 다. */
const ALIAS_MAX_LENGTH = 200;

/** 보내기 전에 화면에서 잡을 수 있는 것만 잡는다. 별칭은 비어도 된다 — 없으면 코드로 부른다. */
export const validateLocation = (values: LocationFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  /* 코드는 발행해 채운다 — 비었다면 계층을 아직 받지 못한 것이다. */
  if (values.locationCode.trim() === '') {
    errors.locationCode = t.required;
  }

  if (values.aliasName.trim().length > ALIAS_MAX_LENGTH) {
    errors.aliasName = t.aliasTooLong(ALIAS_MAX_LENGTH);
  }

  return errors;
};
