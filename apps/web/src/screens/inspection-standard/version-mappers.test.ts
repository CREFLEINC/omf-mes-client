import { describe, expect, it } from 'vitest';

import { inspectionPlanVersionFixtures } from './fixtures';
import type { VersionFormValues } from './types';
import {
  emptyVersionFormValues,
  isSameVersionValues,
  toVersionCreate,
  toVersionUpdate,
  versionToFormValues,
} from './version-mappers';

const filled: VersionFormValues = {
  effectiveFrom: '2026-08-01',
  effectiveTo: '2026-08-31',
  samplingMethodCode: 'PENDING',
  samplingQty: '30',
  aqlValue: '1',
  acceptanceNumber: '0',
  rejectionNumber: '2',
  inspectionFrequencyCode: 'PENDING',
  frequencyIntervalValue: '4',
  frequencyIntervalUomCode: 'PENDING',
};

describe('versionToFormValues', () => {
  it('계약의 값을 폼 문자열로 옮긴다', () => {
    expect(versionToFormValues(inspectionPlanVersionFixtures[0]!)).toEqual({
      effectiveFrom: '2026-08-01',
      effectiveTo: '',
      samplingMethodCode: 'PENDING',
      samplingQty: '30',
      aqlValue: '',
      acceptanceNumber: '0',
      rejectionNumber: '2',
      inspectionFrequencyCode: 'PENDING',
      frequencyIntervalValue: '',
      frequencyIntervalUomCode: '',
    });
  });

  /* 0과 「지정하지 않음」은 다르다 — 널만 빈 문자열이 된다. */
  it('0은 빈 문자열이 되지 않는다', () => {
    expect(versionToFormValues(inspectionPlanVersionFixtures[0]!).acceptanceNumber).toBe('0');
  });
});

describe('emptyVersionFormValues', () => {
  it('모든 칸이 빈 폼을 만든다', () => {
    const empty = emptyVersionFormValues();

    expect(Object.values(empty).every((value) => value === '')).toBe(true);
  });
});

describe('toVersionUpdate', () => {
  it('폼 문자열을 계약의 숫자로 옮긴다', () => {
    expect(toVersionUpdate(filled)).toEqual({
      effectiveFrom: '2026-08-01',
      effectiveTo: '2026-08-31',
      samplingMethodCode: 'PENDING',
      samplingQty: 30,
      aqlValue: 1,
      acceptanceNumber: 0,
      rejectionNumber: 2,
      inspectionFrequencyCode: 'PENDING',
      frequencyIntervalValue: 4,
      frequencyIntervalUomCode: 'PENDING',
    });
  });

  it('비운 선택 값은 널로 보낸다', () => {
    const body = toVersionUpdate({
      ...filled,
      effectiveTo: '',
      samplingQty: '',
      aqlValue: '',
      acceptanceNumber: '',
      rejectionNumber: '',
      frequencyIntervalValue: '',
      frequencyIntervalUomCode: '',
    });

    expect(body.effectiveTo).toBeNull();
    expect(body.samplingQty).toBeNull();
    expect(body.acceptanceNumber).toBeNull();
    expect(body.frequencyIntervalUomCode).toBeNull();
  });

  /*
   * 판 번호는 시스템 채번이고 상태는 전이 오퍼레이션으로만 바뀐다.
   * 기준 번호는 버전이 붙은 뒤 바꿀 수 없다 — 셋 다 실어 보내면 계약 위반이다.
   */
  it('기준 번호·판 번호·상태를 싣지 않는다', () => {
    const body = toVersionUpdate(filled) as Record<string, unknown>;

    expect('inspectionPlanId' in body).toBe(false);
    expect('planVersion' in body).toBe(false);
    expect('statusCode' in body).toBe(false);
  });
});

describe('toVersionCreate', () => {
  /* 첫 버전 등록에만 기준 번호가 실린다 — 계약이 required 로 두었다. */
  it('등록 본문에는 기준 번호가 실린다', () => {
    expect(toVersionCreate(filled, 3001).inspectionPlanId).toBe(3001);
  });

  it('등록 본문에도 판 번호와 상태를 싣지 않는다', () => {
    const body = toVersionCreate(filled, 3001) as Record<string, unknown>;

    expect('planVersion' in body).toBe(false);
    expect('statusCode' in body).toBe(false);
  });
});

describe('isSameVersionValues', () => {
  it('모든 칸이 같으면 같다고 본다', () => {
    expect(isSameVersionValues(filled, { ...filled })).toBe(true);
  });

  it('한 칸이라도 다르면 다르다고 본다', () => {
    expect(isSameVersionValues(filled, { ...filled, samplingQty: '31' })).toBe(false);
    expect(isSameVersionValues(filled, { ...filled, effectiveTo: '' })).toBe(false);
  });
});
