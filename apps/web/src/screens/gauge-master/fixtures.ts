import type { components } from '@omf-mes/api-client';

import type { Equipment } from './types';

/**
 * 시험용 합성 자료. **실 운영 값을 쓰지 않는다** — 공장명·계측기번호는 전부 지어낸 것이다.
 * 공개 저장소 경계(루트 `CLAUDE.md`)가 테스트 픽스처에도 그대로 적용된다.
 */

type PageMeta = components['schemas']['PageMeta'];
type Plant = components['schemas']['Plant'];
type CodeValue = components['schemas']['CodeValue'];

/** 시험이 고정해 쓰는 오늘. 검교정 판정이 실행 날짜에 흔들리지 않게 한다. */
export const TODAY = '2026-03-10';

export const pageOf = (items: unknown[], total = items.length): PageMeta => ({
  page: 1,
  size: 20,
  total,
});

export const plantItems: Plant[] = [
  {
    plantId: 11,
    legalEntityId: 1,
    businessUnitId: 1,
    plantCode: 'PL-1',
    plantName: '제1공장',
    timezoneCode: 'UTC',
    isActive: true,
  },
  {
    plantId: 12,
    legalEntityId: 1,
    businessUnitId: 1,
    plantCode: 'PL-2',
    plantName: '제2공장',
    timezoneCode: 'UTC',
    isActive: true,
  },
];

/** 문 닫은 공장. 이름은 남아 있어야 하고 고를 목록에서는 빠져야 한다. */
export const closedPlant: Plant = {
  plantId: 13,
  legalEntityId: 1,
  businessUnitId: 1,
  plantCode: 'PL-3',
  plantName: '제3공장',
  timezoneCode: 'UTC',
  isActive: false,
};

export const plantsResponse = (items: Plant[] = plantItems) => ({
  items,
  page: pageOf(items),
});

export const makeGauge = (
  equipmentId: number,
  equipmentCode: string,
  overrides: Partial<Equipment> = {},
): Equipment => ({
  equipmentId,
  plantId: 11,
  equipmentCode,
  equipmentName: `${equipmentCode} 계측기`,
  equipmentTypeCode: 'PENDING',
  productionLineId: null,
  statusCode: 'IN_SERVICE',
  calibrationRequired: false,
  isActive: true,
  ...overrides,
});

/**
 * ⭐ **검교정 네 모양을 한 벌에 담는다** — 대상 아님 · 아직 안 함 · 유효 · 만료.
 * 넷이 같은 목록에 서야 「아직 안 함」과 「대상 아님」이 갈리는지 볼 수 있다.
 */
export const gaugeItems: Equipment[] = [
  makeGauge(3001, 'GA-01'),
  makeGauge(3002, 'GA-02', { calibrationRequired: true }),
  makeGauge(3003, 'GA-03', {
    calibrationRequired: true,
    lastCalibrationDate: '2026-01-05',
    calibrationDueDate: '2026-04-05',
  }),
  makeGauge(3004, 'GA-04', {
    calibrationRequired: true,
    lastCalibrationDate: '2025-02-01',
    calibrationDueDate: '2026-02-01',
  }),
];

export const gaugesResponse = (items: Equipment[] = gaugeItems) => ({
  items,
  page: pageOf(items),
});

export const makeCodeValue = (code: string, codeName: string, isActive = true): CodeValue => ({
  codeValueId: code.length,
  codeGroupId: 1,
  code,
  codeName,
  displayOrder: 1,
  isActive,
});

/**
 * ⚠ **쓰지 않기로 한 코드값도 이름은 남아야 한다** — 그 값을 가진 자산이 이미 있다.
 * 목록이 «고를 것»이 아니라 «읽는 값의 이름표»라 거르지 않는 이유가 그것이다.
 */
export const statusCodeValues: CodeValue[] = [
  makeCodeValue('IN_SERVICE', '사용중'),
  makeCodeValue('DISPOSED', '폐기'),
  makeCodeValue('RETIRED_CODE', '쓰지 않는 상태', false),
];

export const codeValuesResponse = (items: CodeValue[] = statusCodeValues) => ({
  items,
  page: pageOf(items),
});
