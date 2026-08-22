import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { CalendarFilters, WorkCalendar } from './types';

type PageMeta = components['schemas']['PageMeta'];
type WorkCalendarDetailResponse = components['schemas']['WorkCalendarDetailResponse'];
type WorkCalendarDayList = components['schemas']['WorkCalendarDayList'];

export interface CalendarListResponse {
  items: WorkCalendar[];
  page: PageMeta;
}

export const calendarKeys = {
  all: ['work-calendars'] as const,
  list: (filters: CalendarFilters) => ['work-calendars', 'list', filters] as const,
  detail: (workCalendarId: number) => ['work-calendars', 'detail', workCalendarId] as const,
};

/** 상세 경로. **잠금 토큰이 이 경로에 보관된다** — 쓰기 경로로 꺼내면 늘 비어 있다. */
export const calendarDetailPath = (workCalendarId: number): string =>
  `/mdm/work-calendars/${String(workCalendarId)}`;

/**
 * 캘린더 목록.
 *
 * ⛔ **거짓인 참·거짓 조건을 싣지 않는다** — 끄면 조건 자체를 빼야 서버 기본값과 다투지 않는다.
 */
export const useCalendarList = (filters: CalendarFilters): UseQueryResult<CalendarListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: calendarKeys.list(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/work-calendars', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              includeInactive: filters.includeInactive,
            },
          },
        }),
      ),
  });
};

export const calendarDayKeys = {
  /** 일자 캐시 전부. 하루를 고쳐도 그 달의 다른 조회가 낡으므로 통째로 거둔다. */
  all: ['work-calendar-days'] as const,
  ofCalendar: (workCalendarId: number, from: string, to: string) =>
    ['work-calendar-days', workCalendarId, from, to] as const,
};

/**
 * 캘린더 일자 — **기간을 반드시 지정해 부른다.**
 *
 * ⛔ 계약이 그렇게 못박았다(한 해가 365행이라 전량을 내리지 않는다 · 공유계약 L-3).
 * ⭐ **화면에 보이는 달만 받는다** — 앞뒤 빈칸에 걸친 이웃 달의 날은 칠하지 않으므로 받을
 * 이유가 없고, 받아 두면 「보이지 않는 날의 설정」을 들고 있게 된다.
 */
export const useCalendarDays = (
  workCalendarId: number | null,
  range: { from: string; to: string },
): UseQueryResult<WorkCalendarDayList> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: calendarDayKeys.ofCalendar(workCalendarId ?? 0, range.from, range.to),
    enabled: workCalendarId !== null,
    queryFn: () => {
      if (workCalendarId === null) {
        throw new Error('캘린더를 고르기 전에는 일자를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/work-calendars/{workCalendarId}/days', {
          params: { path: { workCalendarId }, query: { from: range.from, to: range.to } },
        }),
      );
    },
  });
};

/** 받은 건수가 전체보다 적으면 목록이 잘린 것이다. */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 캘린더 상세. **잠금 토큰·코드 편집 가부·따르는 대상 수가 이 응답으로 온다** —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useCalendarDetail = (
  workCalendarId: number | null,
): UseQueryResult<WorkCalendarDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: calendarKeys.detail(workCalendarId ?? 0),
    enabled: workCalendarId !== null,
    queryFn: () => {
      if (workCalendarId === null) {
        throw new Error('캘린더를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/work-calendars/{workCalendarId}', {
          params: { path: { workCalendarId } },
        }),
      );
    },
  });
};

type WorkCalendarApplication = components['schemas']['WorkCalendarApplication'];

export const applicationKeys = {
  all: ['work-calendar-applications'] as const,
  ofCalendar: (workCalendarId: number) =>
    ['work-calendar-applications', 'calendar', workCalendarId] as const,
  ofType: (targetTypeCode: string) =>
    ['work-calendar-applications', 'type', targetTypeCode] as const,
};

export interface ApplicationListResponse {
  items: WorkCalendarApplication[];
  page: PageMeta;
}

/** 이 캘린더를 따르는 대상. 캘린더를 고르기 전에는 부르지 않는다. */
export const useCalendarApplications = (
  workCalendarId: number | null,
): UseQueryResult<ApplicationListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: applicationKeys.ofCalendar(workCalendarId ?? 0),
    enabled: workCalendarId !== null,
    queryFn: () => {
      if (workCalendarId === null) {
        throw new Error('캘린더를 고르기 전에는 적용 대상을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/work-calendar-applications', { params: { query: { workCalendarId } } }),
      );
    },
  });
};

/**
 * 공장 적용 전부 — **어느 캘린더를 따르든** 모아 본다.
 *
 * ⭐ 「기본 캘린더가 지정되지 않은 공장」을 세려면 **이 캘린더의 것이 아니라 전체**가 필요하다.
 * 다른 캘린더를 따르는 공장은 미지정이 아니기 때문이다.
 */
export const usePlantApplications = (): UseQueryResult<ApplicationListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: applicationKeys.ofType('PLANT'),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/work-calendar-applications', {
          params: { query: { targetTypeCode: 'PLANT' } },
        }),
      ),
  });
};

export interface TargetOption {
  value: string;
  label: string;
}

const NO_TARGETS: TargetOption[] = [];

/** 공장 선택 목록. 이름을 풀 수 있어야 하므로 문 닫은 것까지 받는다. */
export const usePlantTargets = (): TargetOption[] => {
  const { client } = useApiClient();

  const plants = useQuery({
    queryKey: ['lookups', 'plants'] as const,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });

  return (
    plants.data?.items.map((item) => ({
      value: String(item.plantId),
      label: item.plantName,
    })) ?? NO_TARGETS
  );
};

/**
 * 설비 그룹 선택 목록.
 *
 * ⭐ **계약이 대응을 못박았다** — `EQUIPMENT_GROUP` 의 대상은 생산라인이다. 화면의 말은
 * 「설비 그룹」이지만 목록은 생산라인 경로에서 온다. 한 칸이 상황에 따라 다른 표를 가리키므로
 * 화면이 짐작하지 않고 계약이 정한 대응을 따른다.
 */
export const useEquipmentGroupTargets = (enabled: boolean): TargetOption[] => {
  const { client } = useApiClient();

  const lines = useQuery({
    queryKey: ['lookups', 'production-lines'] as const,
    /*
     * ⭐ **고를 자리가 열렸을 때만 받는다.** 공장은 「미지정 공장」을 세느라 늘 필요하지만
     * 설비 그룹은 지정 창에서만 쓴다 — 화면을 열 때마다 받으면 아무도 안 보는 목록을 나른다.
     */
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/production-lines', { params: { query: { includeInactive: true } } }),
      ),
  });

  return (
    lines.data?.items.map((item) => ({
      value: String(item.productionLineId),
      label: item.lineName,
    })) ?? NO_TARGETS
  );
};
