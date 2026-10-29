import { describe, expect, it } from 'vitest';

import { LOCATION_FORM_FIELDS, validateLocation } from './location-validation';
import { emptyLocationFormValues } from './mappers';
import type { LocationFormValues } from './types';

const filled: LocationFormValues = {
  ...emptyLocationFormValues(),
  locationCode: 'Z01',
  locationTypeCode: 'RACK',
};

describe('validateLocation', () => {
  it('별칭은 비어도 통과한다 — 없으면 코드로 부른다', () => {
    expect(validateLocation(filled)).toEqual({});
  });

  it('발행한 코드가 없으면 필수 오류다', () => {
    expect(validateLocation({ ...filled, locationCode: '' }).locationCode).toBe(
      '필수 입력 항목입니다.',
    );
  });

  it('별칭이 200자를 넘으면 거부한다', () => {
    expect(validateLocation({ ...filled, aliasName: '가'.repeat(201) }).aliasName).toBe(
      '별칭은 200자 이하로 입력하세요.',
    );
    expect(validateLocation({ ...filled, aliasName: '가'.repeat(200) })).toEqual({});
  });
});

describe('LOCATION_FORM_FIELDS', () => {
  it('화면에 칸이 있는 값만 담는다 — 위치유형 · 혼적 허용은 칸 없이 실려 간다', () => {
    expect([...LOCATION_FORM_FIELDS].sort()).toEqual(
      ['aliasName', 'locationCode', 'parentLocationId'].sort(),
    );
  });
});
