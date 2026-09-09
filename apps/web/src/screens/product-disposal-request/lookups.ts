import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';

/**
 * 참조 이름과 코드 선택지.
 *
 * ⚠ **뿌리 키를 화면 캐시와 «가른다»** — 같은 뿌리를 쓰면 폐기 요청 한 번마다 무효화가 접두로
 * 걸려 품목·단위 전량이 다시 나간다. 참조 이름은 폐기로 바뀌지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const EMPTY_ENTRIES: LookupEntry[] = [];

const nameOr = (value: string): string =>
  value.trim() === '' ? messages.common.reference.unknown : value;

const useLookup = (key: string, load: () => Promise<LookupEntry[]>): LookupSource => {
  const query = useQuery({ queryKey: ['product-disposal-lookups', key], queryFn: load });

  return {
    entries: query.data ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: query.isPending,
  };
};

export const useItemLookup = (): LookupSource => {
  const { client } = useApiClient();

  return useLookup('items', async () => {
    const data = await runRequest(() =>
      client.GET('/mdm/items', { params: { query: { includeInactive: true } } }),
    );

    return data.items.map((item) => ({
      value: String(item.itemId),
      label: `${item.itemCode} · ${nameOr(item.itemName)}`,
      isActive: item.isActive,
    }));
  });
};

export const useUomLookup = (): LookupSource => {
  const { client } = useApiClient();

  return useLookup('uoms', async () => {
    const data = await runRequest(() =>
      client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
    );

    return data.items.map((uom) => ({
      value: String(uom.uomId),
      label: nameOr(uom.uomCode),
      isActive: uom.isActive,
    }));
  });
};

/**
 * 공통코드 값 목록.
 *
 * ⭐ **그룹을 «이름»으로 가리킨다**(`codeGroupCode`) — 채번 식별자는 환경마다 달라 하드코딩할
 * 수 없다(계약 명시 · omf-mes#179). 계약이 이 두 그룹의 이름을 못박아 두어(G-32) 출고 유형과
 * 출고 사유는 **자리표시를 기다리지 않고 조회로 채운다.**
 */
const useCodeValues = (codeGroupCode: string): LookupSource => {
  const { client } = useApiClient();

  return useLookup(`code-values:${codeGroupCode}`, async () => {
    const data = await runRequest(() =>
      client.GET('/mdm/code-values', { params: { query: { codeGroupCode } } }),
    );

    return data.items.map((value) => ({
      value: value.code,
      label: nameOr(value.codeName),
      /* 코드값에는 사용 여부가 없다 — 조회가 이미 쓸 수 있는 것만 낸다. */
      isActive: true,
    }));
  });
};

export const useIssueTypeCodes = (): LookupSource => useCodeValues('ISSUE_TYPE');
export const useIssueReasonCodes = (): LookupSource => useCodeValues('GOODS_ISSUE_REASON');
