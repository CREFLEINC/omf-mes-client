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
