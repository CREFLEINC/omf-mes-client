import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupSource } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';

/**
 * 이름 풀이 — 계약이 정수 식별자만 주는 자리를 사람이 읽는 값으로 바꾼다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const EMPTY_ENTRIES: readonly never[] = [];

/**
 * 공급사 — 입하 건 목록의 공급사 칸이 쓴다.
 *
 * 계약이 거래처를 공급사·고객으로 가르는 조건을 주지 않으므로 **전체 거래처를 받는다.**
 * 좁혀 받을 근거가 생기면 그때 쿼리를 더한다 — 지금 지어내면 이름이 안 풀리는 건이 생긴다.
 *
 * 지금 쓰지 않는 거래처도 함께 받는다(`includeInactive`) — 과거 입하가 그런 거래처를
 * 참조하고 있고, 빼면 그 건의 공급사 칸이 「모름」이 된다.
 */
export const useSupplierLookup = (): LookupSource => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['pop-material-lot-label', 'suppliers'],
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', { params: { query: { includeInactive: true } } }),
      ),
  });

  return {
    entries:
      query.data?.items.map((item) => ({
        value: String(item.partnerId),
        label: `${item.partnerCode} · ${item.partnerName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: query.isPending,
  };
};
