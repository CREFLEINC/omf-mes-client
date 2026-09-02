import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';

/**
 * 수량 옆에 붙는 단위 이름.
 *
 * ⚠ **뿌리 키를 화면 캐시와 «가른다»** — 같은 뿌리를 쓰면 확인 처리 한 번마다 무효화가 접두로
 * 걸려 단위 전량이 다시 나간다. 단위 이름은 P/O 판정으로 바뀌지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const EMPTY_ENTRIES: LookupEntry[] = [];

export const useUomLookup = (): LookupSource => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['po-change-review-lookups', 'uoms'],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );

      return data.items.map((uom) => ({
        value: String(uom.uomId),
        label: uom.uomCode.trim() === '' ? messages.common.reference.unknown : uom.uomCode,
        isActive: uom.isActive,
      }));
    },
  });

  return {
    entries: query.data ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: query.isPending,
  };
};
