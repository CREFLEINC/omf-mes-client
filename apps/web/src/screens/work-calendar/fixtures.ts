import type { components } from '@omf-mes/api-client';

import type { WorkCalendar } from './types';

/**
 * 시험용 합성 자료. **실 운영 값을 쓰지 않는다** — 캘린더 코드·이름은 전부 지어낸 것이다.
 * 공개 저장소 경계(루트 `CLAUDE.md`)가 테스트 픽스처에도 그대로 적용된다.
 */

type PageMeta = components['schemas']['PageMeta'];
type WorkCalendarDetailResponse = components['schemas']['WorkCalendarDetailResponse'];
type Editability = components['schemas']['Editability'];

export const pageOf = (items: unknown[], total = items.length): PageMeta => ({
  page: 1,
  size: 20,
  total,
});

export const makeCalendar = (
  workCalendarId: number,
  calendarCode: string,
  overrides: Partial<WorkCalendar> = {},
): WorkCalendar => ({
  workCalendarId,
  calendarCode,
  calendarName: `${calendarCode} 캘린더`,
  isActive: true,
  ...overrides,
});

export const calendarDefault = makeCalendar(5001, 'CAL-A');

/** 쓰지 않기로 한 캘린더. 「미사용 포함」을 켰을 때만 보인다. */
export const calendarInactive = makeCalendar(5002, 'CAL-B', { isActive: false });

export const calendarItems: WorkCalendar[] = [calendarDefault, calendarInactive];

export const calendarsResponse = (items: WorkCalendar[] = calendarItems) => ({
  items,
  page: pageOf(items),
});

export const editableCode: Editability = { codeEditable: true, reason: 'EDITABLE' };

/**
 * 따르는 대상이 있어 코드가 잠긴 상태.
 * ⭐ 계약이 「`calendarCode` 는 참조가 0일 때만 보낼 수 있다」고 못박았다.
 */
export const referencedCode: Editability = {
  codeEditable: false,
  reason: 'REFERENCED',
  referenceCount: 3,
};

export const calendarDetail = (
  calendar: WorkCalendar,
  overrides: Partial<WorkCalendarDetailResponse> = {},
): WorkCalendarDetailResponse => ({
  workCalendar: calendar,
  editability: editableCode,
  applicationCount: 0,
  ...overrides,
});

type Plant = components['schemas']['Plant'];
type ProductionLine = components['schemas']['ProductionLine'];
type WorkCalendarApplication = components['schemas']['WorkCalendarApplication'];

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

export const plantsResponse = (items: Plant[] = plantItems) => ({
  items,
  page: pageOf(items),
});

/**
 * ⭐ **계약이 대응을 못박았다** — `EQUIPMENT_GROUP` 의 대상은 생산라인이다.
 * 화면의 말은 「설비 그룹」이지만 목록은 이 경로에서 온다.
 */
export const lineItems: ProductionLine[] = [
  {
    productionLineId: 21,
    plantId: 11,
    lineCode: 'LN-1',
    lineName: '프레스라인 A',
    lineTypeCode: 'LINE',
    isActive: true,
  },
  {
    productionLineId: 22,
    plantId: 11,
    lineCode: 'LN-2',
    lineName: '조립라인 B',
    lineTypeCode: 'LINE',
    isActive: true,
  },
];

export const linesResponse = (items: ProductionLine[] = lineItems) => ({
  items,
  page: pageOf(items),
});

export const makeApplication = (
  overrides: Partial<WorkCalendarApplication> = {},
): WorkCalendarApplication => ({
  targetTypeCode: 'PLANT',
  targetId: 11,
  targetName: '제1공장',
  workCalendarId: 5001,
  calendarCode: 'CAL-A',
  ...overrides,
});

export const applicationsResponse = (items: WorkCalendarApplication[] = []) => ({
  items,
  page: pageOf(items),
});
