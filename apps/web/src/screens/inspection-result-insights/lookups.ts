import type { ApiClient, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';

export const INSPECTION_TYPE_GROUP = 'QUALITY_INSPECTION_TYPE';
export const OVERALL_JUDGMENT_GROUP = 'INSPECTION_RESULT_OVERALL_JUDGMENT';
type Client = ApiClient['client'];
type PageMeta = components['schemas']['PageMeta'];

export interface InspectionLookup extends LookupSource {
  entries: LookupEntry[];
  truncated: boolean;
  refetch: () => void;
}

const EMPTY_ENTRIES: LookupEntry[] = [];
const toLookup = (
  data: { entries: LookupEntry[]; page: PageMeta } | undefined,
  isError: boolean,
  isLoading: boolean,
  refetch: () => unknown,
): InspectionLookup => ({
  entries: data?.entries ?? EMPTY_ENTRIES,
  truncated: data !== undefined && data.page.total > data.entries.length,
  isError,
  isLoading,
  refetch: () => void refetch(),
});

const fetchCodes = async (client: Client, codeGroupCode: string) => {
  const data = await runRequest(() =>
    client.GET('/mdm/code-values', {
      params: { query: { codeGroupCode, includeInactive: true } },
    }),
  );
  return {
    entries: data.items
      .slice()
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((value) => ({
        value: value.code,
        label: value.codeName.trim() === '' ? messages.common.reference.unknown : value.codeName,
        isActive: value.isActive,
      })),
    page: data.page,
  };
};

const useCodeLookup = (codeGroupCode: string): InspectionLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['inspection-result-insights', 'lookups', 'codes', codeGroupCode],
    queryFn: () => fetchCodes(client, codeGroupCode),
  });
  return toLookup(query.data, query.isError, query.isPending, query.refetch);
};

export const useInspectionTypeLookup = (): InspectionLookup => useCodeLookup(INSPECTION_TYPE_GROUP);

export const useOverallJudgmentLookup = (): InspectionLookup =>
  useCodeLookup(OVERALL_JUDGMENT_GROUP);

export const useInspectionItemLookup = (): InspectionLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['inspection-result-insights', 'lookups', 'items'],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/items', { params: { query: { includeInactive: true } } }),
      );
      return {
        entries: data.items.map((item) => ({
          value: String(item.itemId),
          label: `${item.itemCode} · ${item.itemName}`,
          isActive: item.isActive,
        })),
        page: data.page,
      };
    },
  });
  return toLookup(query.data, query.isError, query.isPending, query.refetch);
};

export const useInspectionProcessLookup = (): InspectionLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['inspection-result-insights', 'lookups', 'processes'],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/processes', { params: { query: { includeInactive: true } } }),
      );
      return {
        entries: data.items.map((process) => ({
          value: String(process.processId),
          label: `${process.processCode} · ${process.processName}`,
          isActive: process.isActive,
        })),
        page: data.page,
      };
    },
  });
  return toLookup(query.data, query.isError, query.isPending, query.refetch);
};
