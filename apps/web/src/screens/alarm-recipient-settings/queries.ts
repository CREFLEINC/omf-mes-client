import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type {
  CandidatePage,
  Department,
  NotificationEvent,
  Setting,
  SettingReplace,
  SettingSummary,
} from './types';

/** 후보 표 한 쪽의 줄 수. */
export const CANDIDATE_PAGE_SIZE = 20;

/**
 * 한 행의 상세 경로. **경로형이다** — ETag 보관소가 경로(pathname)만 키로 쓰므로 부서·이벤트를
 * 질의 문자열에 두면 모든 행이 같은 ETag 칸을 나눠 쓴다. 상세 GET 과 저장 PUT 이 이 경로를 함께 쓴다.
 */
export const settingPath = (departmentId: number, eventCode: string): string =>
  `/app/notification-settings/${String(departmentId)}/${encodeURIComponent(eventCode)}`;

export const alarmRecipientKeys = {
  all: ['alarm-recipient-settings'] as const,
  events: ['alarm-recipient-settings', 'events'] as const,
  departments: ['alarm-recipient-settings', 'departments'] as const,
  summary: (departmentId: number | null) =>
    ['alarm-recipient-settings', 'summary', departmentId ?? 0] as const,
  detail: (departmentId: number | null, eventCode: string | null) =>
    ['alarm-recipient-settings', 'detail', departmentId ?? 0, eventCode ?? ''] as const,
  candidates: (keyword: string, page: number) =>
    ['alarm-recipient-settings', 'candidates', keyword, page] as const,
};

export const useEvents = (): UseQueryResult<NotificationEvent[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: alarmRecipientKeys.events,
    queryFn: async () => (await runRequest(() => client.GET('/app/notification-events'))).items,
  });
};

/**
 * 부서 선택지 — 사용 중인 부서만 받는다(설계 W-CO-11 표시 항목). 미사용 부서의 설정은
 * 고칠 일이 없고, 지금 보던 부서가 미사용이 되면 URL 값은 남지만 선택지에서 빠진다.
 */
export const useDepartments = (): UseQueryResult<Department[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: alarmRecipientKeys.departments,
    queryFn: async () =>
      (
        await runRequest(() =>
          client.GET('/mdm/departments', {
            params: { query: { includeInactive: false, size: 100 } },
          }),
        )
      ).items,
  });
};

export const useSettingSummary = (departmentId: number | null): UseQueryResult<SettingSummary> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: alarmRecipientKeys.summary(departmentId),
    enabled: departmentId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/notification-settings', {
          params: { query: { departmentId: departmentId ?? 0 } },
        }),
      ),
  });
};

export const useSettingDetail = (
  departmentId: number | null,
  eventCode: string | null,
): UseQueryResult<Setting> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: alarmRecipientKeys.detail(departmentId, eventCode),
    enabled: departmentId !== null && eventCode !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/notification-settings/{departmentId}/{eventCode}', {
          params: { path: { departmentId: departmentId ?? 0, eventCode: eventCode ?? '' } },
        }),
      ),
  });
};

/** 수신자 후보 — 활성 사용자 전체. 창이 열려 있을 때만 부른다. */
export const useRecipientCandidates = (
  keyword: string,
  page: number,
  enabled: boolean,
): UseQueryResult<CandidatePage> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: alarmRecipientKeys.candidates(keyword, page),
    enabled,
    /* 쪽을 넘길 때 표가 비었다 차는 깜박임을 막는다. */
    placeholderData: keepPreviousData,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/notification-settings/recipient-candidates', {
          params: {
            query: {
              ...(keyword === '' ? {} : { keyword }),
              page,
              size: CANDIDATE_PAGE_SIZE,
            },
          },
        }),
      ),
  });
};

export const useReplaceSetting = (
  departmentId: number | null,
  eventCode: string | null,
  onSuccess: (data: Setting) => void,
): MasterWriteResult<SettingReplace> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.PUT('/app/notification-settings/{departmentId}/{eventCode}', {
        params: {
          path: { departmentId: departmentId ?? 0, eventCode: eventCode ?? '' },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath:
      departmentId === null || eventCode === null ? null : settingPath(departmentId, eventCode),
    invalidateKeys: [alarmRecipientKeys.summary(departmentId)],
    knownFields: [],
    onSuccess,
  });
};
