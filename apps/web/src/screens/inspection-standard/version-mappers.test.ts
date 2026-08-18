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
  samplingRatio: '30',
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
      samplingRatio: '30',
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

  /* 계약이 소수를 허용한다 — 자릿수를 잃으면 2.5%가 2% 또는 3%가 된다. */
  it('소수 비율의 자릿수를 잃지 않는다', () => {
    expect(versionToFormValues(inspectionPlanVersionFixtures[1]!).samplingRatio).toBe('2.5');
  });

  /* 선택 필드라 키 자체가 없는 응답이 정상이다 — undefined 가 입력칸으로 새면 비제어 경고가 난다. */
  it('비율 키가 없는 응답은 빈 문자열이 된다', () => {
    const { samplingRatio: _omitted, ...withoutRatio } = inspectionPlanVersionFixtures[0]!;

    expect(versionToFormValues(withoutRatio).samplingRatio).toBe('');
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
      samplingRatio: 30,
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
      samplingRatio: '',
      aqlValue: '',
      acceptanceNumber: '',
      rejectionNumber: '',
      frequencyIntervalValue: '',
      frequencyIntervalUomCode: '',
    });

    expect(body.effectiveTo).toBeNull();
    expect(body.samplingRatio).toBeNull();
    expect(body.acceptanceNumber).toBeNull();
    expect(body.frequencyIntervalUomCode).toBeNull();
  });

  /*
   * **환산하지 않는다**(#201 ④). 실제 검사 수량은 검사 시점에 로트 크기로 정해지는 파생값이라
   * 이 화면이 정하지 않는다. 100 으로 곱하거나 나누면 30%가 0.3% 또는 3000%로 저장된다.
   */
  it('입력한 비율을 그대로 싣는다 — 100으로 곱하거나 나누지 않는다', () => {
    const body = toVersionUpdate({ ...filled, samplingRatio: '30' });

    expect(body.samplingRatio).toBe(30);
    expect(body.samplingRatio).not.toBe(0.3);
    expect(body.samplingRatio).not.toBe(3000);
  });

  it('소수 비율도 자릿수 그대로 싣는다', () => {
    expect(toVersionUpdate({ ...filled, samplingRatio: '30.5' }).samplingRatio).toBe(30.5);
    expect(toVersionUpdate({ ...filled, samplingRatio: '2.5' }).samplingRatio).toBe(2.5);
  });

  /* 두 필드를 함께 두지 않는다(#201 ⛔) — 어긋난 자료가 쌓이지 않게 옛 이름은 본문에서 사라진다. */
  it('본문 키 목록에 옛 수량 필드가 없다', () => {
    const body = toVersionUpdate(filled) as Record<string, unknown>;

    // 음성 단언은 짝 양성과 같은 시점에 잰다 — 값이 실려 있음을 먼저 확인한다.
    expect(body.samplingRatio).toBe(30);
    expect(Object.keys(body)).toContain('samplingRatio');
    expect(Object.keys(body)).not.toContain('samplingQty');
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
    expect(isSameVersionValues(filled, { ...filled, samplingRatio: '31' })).toBe(false);
    expect(isSameVersionValues(filled, { ...filled, effectiveTo: '' })).toBe(false);
  });
});
