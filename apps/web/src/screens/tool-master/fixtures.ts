import type { components } from '@omf-mes/api-client';

import type { Mold } from './types';

/**
 * 시험용 합성 자료. **실 운영 값을 쓰지 않는다** — 공장명·툴코드는 전부 지어낸 것이다.
 * 공개 저장소 경계(루트 `CLAUDE.md`)가 테스트 픽스처에도 그대로 적용된다.
 */

type PageMeta = components['schemas']['PageMeta'];
type Plant = components['schemas']['Plant'];
type CodeValue = components['schemas']['CodeValue'];

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

export const makeTool = (
  moldId: number,
  moldCode: string,
  overrides: Partial<Mold> = {},
): Mold => ({
  moldId,
  plantId: 11,
  moldCode,
  moldName: `${moldCode} 툴`,
  toolTypeCode: 'MOLD',
  cavityCount: 1,
  currentShotCount: 0,
  statusCode: 'IN_SERVICE',
  isActive: true,
  pmTriggerTypeCode: 'NONE',
  ...overrides,
});

/** 예방보전을 하지 않기로 한 툴. 셀 것이 없어 중립이다. */
export const toolNotRequired = makeTool(7001, 'TL-01', {
  guaranteedShotCount: 500_000,
  currentShotCount: 128_400,
  availableShotCount: 371_600,
  shotUsageRatio: 25.68,
});

/** 타발수 축으로 도래한 툴. **적정타수를 넘겨 사용 가능 타수가 음수다.** */
export const toolDueByShot = makeTool(7002, 'TL-02', {
  pmTriggerTypeCode: 'BOTH',
  pmDue: true,
  pmDueAxisCode: 'SHOT',
  guaranteedShotCount: 100_000,
  currentShotCount: 102_500,
  availableShotCount: -2_500,
  shotUsageRatio: 102.5,
});

/** 날짜 축으로 도래한 툴 — 같은 「도래」라도 왜 도래했는지가 갈린다. */
export const toolDueByDate = makeTool(7003, 'TL-03', {
  pmTriggerTypeCode: 'DATE',
  pmDue: true,
  pmDueAxisCode: 'DATE',
  pmCycleInterval: 6,
  pmCycleUnitCode: 'MONTH',
  lastPmDate: '2026-01-02',
  nextPmDate: '2026-07-02',
  guaranteedShotCount: 300_000,
  currentShotCount: 12_000,
  availableShotCount: 288_000,
  shotUsageRatio: 4,
});

/**
 * ⭐ **적정타수가 비어 있는 툴** — 사용 가능 타수도 초과율도 셀 수 없다.
 * 「적정타수 없는 것만」 조건이 세는 것이 이것이다.
 */
export const toolWithoutGuaranteed = makeTool(7004, 'TL-04', {
  pmTriggerTypeCode: 'SHOT',
  pmDue: false,
  currentShotCount: 5_000,
});

/**
 * ⭐ **적정타수는 있는데 서버가 셈을 내려 주지 않은 툴** — 사용자가 할 수 있는 일이 없어
 * 「산출 불가」다. `pmDue` 도 오지 않아 도래 여부를 «모른다».
 */
export const toolUnknown = makeTool(7005, 'TL-05', {
  pmTriggerTypeCode: 'DATE',
  guaranteedShotCount: 200_000,
  currentShotCount: 1_000,
});

/** 폐기된 툴. 사용 중지와 다른 축이라 두 칸이 따로 선다. */
export const toolDisposed = makeTool(7006, 'TL-06', {
  statusCode: 'DISPOSED',
  isActive: false,
  guaranteedShotCount: 50_000,
  currentShotCount: 50_000,
  availableShotCount: 0,
  shotUsageRatio: 100,
});

/**
 * ⭐ **예방보전 네 모양과 타수 세 모양을 한 벌에 담는다.**
 * 함께 서야 「판정 없음」과 「도래 전」이, 「적정타수 미입력」과 「산출 불가」가 갈리는지 볼 수 있다.
 */
export const toolItems: Mold[] = [
  toolNotRequired,
  toolDueByShot,
  toolDueByDate,
  toolWithoutGuaranteed,
  toolUnknown,
  toolDisposed,
];

export const toolsResponse = (items: Mold[] = toolItems) => ({
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
