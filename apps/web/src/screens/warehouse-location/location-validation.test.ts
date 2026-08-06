import { describe, expect, it } from 'vitest';

import { LOCATION_FORM_FIELDS, validateLocation } from './location-validation';
import { emptyLocationFormValues } from './mappers';
import type { LocationFormValues } from './types';

const filled: LocationFormValues = {
  ...emptyLocationFormValues(),
  locationCode: 'A-01',
  locationName: 'A구역',
};

describe('validateLocation', () => {
  it('코드와 명칭만 채워도 통과한다 — 수용량은 선택이다', () => {
    expect(validateLocation(filled)).toEqual({});
  });

  it('위치코드가 비면 필수 오류다', () => {
    expect(validateLocation({ ...filled, locationCode: '' }).locationCode).toBe(
      '필수 입력 항목입니다.',
    );
  });

  it('위치코드가 공백만이면 별도 오류를 낸다', () => {
    expect(validateLocation({ ...filled, locationCode: '  ' }).locationCode).toBe(
      '코드는 공백만으로 지정할 수 없습니다.',
    );
  });

  it('위치명이 비면 필수 오류다', () => {
    expect(validateLocation({ ...filled, locationName: ' ' }).locationName).toBe(
      '필수 입력 항목입니다.',
    );
  });

  it('수용량만 입력하면 단위를 요구한다 — 계약의 짝 제약이다', () => {
    const errors = validateLocation({ ...filled, capacityQty: '500', capacityUomId: '' });

    expect(errors.capacityUomId).toBe('수용량과 단위는 함께 입력하거나 함께 비워야 합니다.');
  });

  it('단위만 고르면 수용량을 요구한다 — 반대 방향도 같다', () => {
    const errors = validateLocation({ ...filled, capacityQty: '', capacityUomId: '41' });

    expect(errors.capacityQty).toBe('수용량과 단위는 함께 입력하거나 함께 비워야 합니다.');
  });

  it('수용량과 단위를 함께 채우면 통과한다', () => {
    expect(validateLocation({ ...filled, capacityQty: '500', capacityUomId: '41' })).toEqual({});
  });

  it('음수 수용량은 거부한다', () => {
    expect(
      validateLocation({ ...filled, capacityQty: '-1', capacityUomId: '41' }).capacityQty,
    ).toBe('수용량은 0 이상의 숫자로 입력하세요.');
  });

  it('숫자가 아닌 수용량은 거부한다', () => {
    expect(
      validateLocation({ ...filled, capacityQty: '스무개', capacityUomId: '41' }).capacityQty,
    ).toBe('수용량은 0 이상의 숫자로 입력하세요.');
  });

  it('0은 유효한 수용량이다', () => {
    expect(validateLocation({ ...filled, capacityQty: '0', capacityUomId: '41' })).toEqual({});
  });
});

describe('LOCATION_FORM_FIELDS', () => {
  it('다이얼로그가 소유한 입력칸 이름을 전부 담는다', () => {
    for (const field of Object.keys(emptyLocationFormValues())) {
      expect(LOCATION_FORM_FIELDS).toContain(field);
    }
  });
});
