import type { components } from '@omf-mes/api-client';

import type { Equipment } from './types';

/**
 * 시험용 합성 자료. **실 운영 값을 쓰지 않는다** — 공장명·계측기번호는 전부 지어낸 것이다.
 * V3 워크플로의 공개 저장소 경계가 테스트 픽스처에도 그대로 적용된다.
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

/** 검교정 대상이 아닌 계측기 — 정상이라 결을 두지 않는다. */
export const gaugeNotRequired = makeGauge(3001, 'GA-01');

/** 대상인데 아직 한 번도 안 한 계측기 — **채워야 할 것**이다. */
export const gaugeNeverCalibrated = makeGauge(3002, 'GA-02', { calibrationRequired: true });

/** 유효한 계측기. */
export const gaugeValid = makeGauge(3003, 'GA-03', {
  calibrationRequired: true,
  calibrationCycleTypeCode: 'MONTH',
  calibrationCycleInterval: 3,
  lastCalibrationDate: '2026-01-05',
  calibrationDueDate: '2026-04-05',
});

/** 만료된 계측기. */
export const gaugeExpired = makeGauge(3004, 'GA-04', {
  calibrationRequired: true,
  lastCalibrationDate: '2025-02-01',
  calibrationDueDate: '2026-02-01',
});

/**
 * ⭐ **검교정 네 모양을 한 벌에 담는다** — 대상 아님 · 아직 안 함 · 유효 · 만료.
 * 넷이 같은 목록에 서야 「아직 안 함」과 「대상 아님」이 갈리는지 볼 수 있다.
 */
export const gaugeItems: Equipment[] = [
  gaugeNotRequired,
  gaugeNeverCalibrated,
  gaugeValid,
  gaugeExpired,
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

export const cycleCodeValues: CodeValue[] = [
  makeCodeValue('DAY', '일'),
  makeCodeValue('MONTH', '개월'),
  makeCodeValue('YEAR', '년'),
];

/**
 * 계측기 세부유형. ⭐ **설계가 확정해 알려 준 값이다**(`omf-mes#195` 회신) — 합성값이
 * 아니라 실제 코드지만, 업계 표준 어휘라 공개 저장소에 둬도 무방하다.
 */
export const typeCodeValues: CodeValue[] = [
  makeCodeValue('CALIPER', '캘리퍼스'),
  makeCodeValue('MICROMETER', '마이크로미터'),
  makeCodeValue('GAUGE', '게이지'),
];

export const codeValuesResponse = (items: CodeValue[] = statusCodeValues) => ({
  items,
  page: pageOf(items),
});

type Uom = components['schemas']['Uom'];

/** ⭐ `decimalScale` 이 다르다 — 정밀도 입력칸의 자릿수 판정이 단위마다 갈린다. */
export const uomItems: Uom[] = [
  { uomId: 1001, uomCode: 'MM', uomName: '밀리미터', decimalScale: 2, isActive: true },
  { uomId: 1002, uomCode: 'UM', uomName: '마이크로미터', decimalScale: 0, isActive: true },
  { uomId: 1003, uomCode: 'OLD', uomName: '쓰지 않는 단위', decimalScale: 3, isActive: false },
];

export const uomsResponse = (items: Uom[] = uomItems) => ({
  items,
  page: pageOf(items),
});

type EquipmentDetailResponse = components['schemas']['EquipmentDetailResponse'];
type Editability = components['schemas']['Editability'];

export const editableCode: Editability = { codeEditable: true, reason: 'EDITABLE' };

/** 참조가 있어 코드가 잠긴 상태. 건수는 서버가 준 값을 그대로 쓴다. */
export const lockedCode: Editability = {
  codeEditable: false,
  reason: 'REFERENCED',
  referenceCount: 3,
};

export const gaugeDetail = (
  gauge: Equipment,
  overrides: Partial<EquipmentDetailResponse> = {},
): EquipmentDetailResponse => ({
  equipment: gauge,
  editability: editableCode,
  hierarchy: {
    plantName: '제1공장',
    groupNames: [],
    equipmentName: gauge.equipmentName,
    groupAssigned: gauge.productionLineId !== null && gauge.productionLineId !== undefined,
  },
  ...overrides,
});

type Calibration = components['schemas']['Calibration'];

export const makeCalibration = (
  calibrationId: number,
  performedOn: string,
  overrides: Partial<Calibration> = {},
): Calibration => ({
  calibrationId,
  equipmentId: 3003,
  historyTypeCode: 'REGULAR',
  performedOn,
  resultCode: 'PASS',
  blocksUse: false,
  ...overrides,
});

/** 최근 것이 위로 온다고 가정하지 않는다 — 서버가 준 차례를 그대로 그린다. */
export const calibrationItems: Calibration[] = [
  makeCalibration(9001, '2026-01-05', {
    nextDueOn: '2026-04-05',
    agencyName: '한빛교정원',
    certificateNo: 'CERT-1',
  }),
  makeCalibration(9002, '2025-10-05', { nextDueOn: '2026-01-05' }),
];

export const calibrationsResponse = (
  items: Calibration[] = calibrationItems,
  totalCount?: number,
) => (totalCount === undefined ? { items } : { items, totalCount });
