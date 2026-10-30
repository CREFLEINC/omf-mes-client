import type { InspectionSheetTemplate } from '@omf-mes/api-client';
import { keepPreviousData, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { VersionAuditEvent } from '../inspection-standard/version-history';

/** 처음 쪽 크기. 모델별 기준이라 한 화면에 넉넉히 본다 — 건수 선택으로 바꿀 수 있다(사용자 지시 · #208). */
export const PAGE_SIZE = 50;

export type TemplateStatusFilter = InspectionSheetTemplate['statusCode'] | '';

export const templateKeys = {
  /** 무효화용 앞부분 — 저장·확정하면 목록과 상세가 함께 낡는다. */
  all: ['inspection-sheet-template'] as const,
  list: (status: TemplateStatusFilter, itemId: number | null) =>
    ['inspection-sheet-template', 'list', status, itemId] as const,
  detail: (id: number) => ['inspection-sheet-template', 'detail', id] as const,
  businessUnits: ['inspection-sheet-template', 'business-units'] as const,
};

/** 상세 GET 의 주소 — 응답 ETag 가 이 주소로 기억되고, 수정·확정의 If-Match 가 여기서 나온다. */
export const templateDetailPath = (id: number): string =>
  `/quality/inspection-sheet-templates/${id}`;

/**
 * 조건(상태 · 품목)에 맞는 기준을 **전부** 받는다(#208). 검사표 기준은 품목별 판이라 수가 많지 않다 —
 * 사용 여부 · 양식 · 재료 거르기, 사용 여부 건수, 확정 일시 정렬, 쪽 나누기를 화면이 빠짐없이 하려고 한 번에 받는다.
 */
export const useTemplates = (
  status: TemplateStatusFilter,
  itemId: number | null = null,
  enabled = true,
) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: templateKeys.list(status, itemId),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const items: InspectionSheetTemplate[] = [];
      for (let page = 1; ; page += 1) {
        const response = await runRequest(() =>
          client.GET('/quality/inspection-sheet-templates', {
            params: {
              query: {
                ...(status === '' ? {} : { statusCode: status }),
                ...(itemId === null ? {} : { itemId }),
                page,
                size: FETCH_SIZE,
              },
            },
          }),
        );
        items.push(...response.items);
        if (items.length >= response.page.total || response.items.length === 0) return items;
      }
    },
  });
};

/** 전부 받을 때 한 번에 받는 쪽 크기. */
const FETCH_SIZE = 100;

export const useTemplate = (id: number | null) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: templateKeys.detail(id ?? 0),
    enabled: id !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-sheet-templates/{inspectionSheetTemplateId}', {
          params: { path: { inspectionSheetTemplateId: id ?? 0 } },
        }),
      ),
  });
};

/** 사업부 이름 — 기준의 사업부는 로그인 계정의 데이터 범위 안에서 고른다. */
export const useBusinessUnitNames = () => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: templateKeys.businessUnits,
    staleTime: Infinity,
    queryFn: async () => {
      const page = await runRequest(() =>
        client.GET('/mdm/business-units', { params: { query: { includeInactive: true } } }),
      );
      return new Map(
        page.items.map((unit) => [
          unit.businessUnitId,
          `${unit.businessUnitName} (${unit.businessUnitCode})`,
        ]),
      );
    },
  });
};

/** 확정자 이름 — 사용자 상세로 푼다(#208). 못 받으면(권한 · 없는 사용자) 호출부가 번호로 낸다. */
export const useUserNames = (
  userIds: readonly (number | null)[],
): ((userId: number) => string | null) => {
  const { client } = useApiClient();
  const ids = [...new Set(userIds.filter((id): id is number => id !== null))];

  const results = useQueries({
    queries: ids.map((appUserId) => ({
      queryKey: ['inspection-sheet-template', 'user-name', appUserId] as const,
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/app/users/{appUserId}', { params: { path: { appUserId } } }),
        );
        return data.appUser.userName;
      },
      retry: false,
      staleTime: Infinity,
    })),
  });

  return (userId) => results[ids.indexOf(userId)]?.data ?? null;
};

/** 최근 1년 — 감사 이력 조회가 기간을 요구한다(검사 기준 탭과 같다). */
const HISTORY_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * 버전 변경 이력(omf-all-around#214) — 서버가 기준 쓰기(등록 · 수정 · 확정 · 폐기 · 작성 취소)마다 남긴 감사 이력.
 * 고를 때마다 새로 받는다(저장 뒤 바로 보이게). 한 버전의 이력은 소수라 첫 쪽(100건)만 받는다.
 */
export const useTemplateHistory = (
  inspectionSheetTemplateId: number | null,
): UseQueryResult<{ items: VersionAuditEvent[] }> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: [...templateKeys.all, 'history', inspectionSheetTemplateId ?? 0] as const,
    enabled: inspectionSheetTemplateId !== null,
    staleTime: 0,
    queryFn: async () => {
      const now = Date.now();
      const data = await runRequest(() =>
        client.GET('/audit/events', {
          params: {
            query: {
              targetTypeCode: 'INSPECTION_SHEET_TEMPLATE',
              targetId: inspectionSheetTemplateId ?? 0,
              occurredFrom: new Date(now - HISTORY_RANGE_MS).toISOString(),
              occurredTo: new Date(now + 60 * 1000).toISOString(),
              size: 100,
            },
          },
        }),
      );
      return {
        items: data.items.map((item) => ({
          auditEventId: item.auditEventId,
          occurredAt: item.occurredAt,
          eventTypeCode: item.eventTypeCode,
          beforeValue: (item.beforeValue ?? null) as Record<string, unknown> | null,
          afterValue: (item.afterValue ?? null) as Record<string, unknown> | null,
          performedBy: item.performedBy ?? null,
        })),
      };
    },
  });
};
