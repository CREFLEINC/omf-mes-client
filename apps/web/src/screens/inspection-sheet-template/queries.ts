import type { InspectionSheetTemplate } from '@omf-mes/api-client';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/** 처음 쪽 크기. 모델별 기준이라 한 화면에 넉넉히 본다 — 건수 선택으로 바꿀 수 있다(사용자 지시 · #208). */
export const PAGE_SIZE = 50;

export type TemplateStatusFilter = InspectionSheetTemplate['statusCode'] | '';

export const templateKeys = {
  /** 무효화용 앞부분 — 저장·확정하면 목록과 상세가 함께 낡는다. */
  all: ['inspection-sheet-template'] as const,
  list: (status: TemplateStatusFilter, itemId: number | null, page: number, size: number) =>
    ['inspection-sheet-template', 'list', status, itemId, page, size] as const,
  detail: (id: number) => ['inspection-sheet-template', 'detail', id] as const,
  businessUnits: ['inspection-sheet-template', 'business-units'] as const,
};

/** 상세 GET 의 주소 — 응답 ETag 가 이 주소로 기억되고, 수정·확정의 If-Match 가 여기서 나온다. */
export const templateDetailPath = (id: number): string =>
  `/quality/inspection-sheet-templates/${id}`;

export const useTemplates = (
  status: TemplateStatusFilter,
  page: number,
  size: number = PAGE_SIZE,
  /** 모델 조건(#208) — 목록 조회가 품목 번호로 거른다. */
  itemId: number | null = null,
) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: templateKeys.list(status, itemId, page, size),
    placeholderData: keepPreviousData,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-sheet-templates', {
          params: {
            query: {
              ...(status === '' ? {} : { statusCode: status }),
              ...(itemId === null ? {} : { itemId }),
              page,
              size,
            },
          },
        }),
      ),
  });
};

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
