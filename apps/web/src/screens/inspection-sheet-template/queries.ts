import type { InspectionSheetTemplate } from '@omf-mes/api-client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/** 한 쪽 크기. 모델별 기준이라 한 화면에 넉넉히 본다. */
export const PAGE_SIZE = 50;

export type TemplateStatusFilter = InspectionSheetTemplate['statusCode'] | '';

export const templateKeys = {
  /** 무효화용 앞부분 — 저장·확정하면 목록과 상세가 함께 낡는다. */
  all: ['inspection-sheet-template'] as const,
  list: (status: TemplateStatusFilter, page: number) =>
    ['inspection-sheet-template', 'list', status, page] as const,
  detail: (id: number) => ['inspection-sheet-template', 'detail', id] as const,
  businessUnits: ['inspection-sheet-template', 'business-units'] as const,
};

/** 상세 GET 의 주소 — 응답 ETag 가 이 주소로 기억되고, 수정·확정의 If-Match 가 여기서 나온다. */
export const templateDetailPath = (id: number): string =>
  `/quality/inspection-sheet-templates/${id}`;

export const useTemplates = (status: TemplateStatusFilter, page: number) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: templateKeys.list(status, page),
    placeholderData: keepPreviousData,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-sheet-templates', {
          params: {
            query: { ...(status === '' ? {} : { statusCode: status }), page, size: PAGE_SIZE },
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
          `${unit.businessUnitCode} · ${unit.businessUnitName}`,
        ]),
      );
    },
  });
};
