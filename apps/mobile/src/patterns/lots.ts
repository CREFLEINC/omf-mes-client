import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

type Client = ReturnType<typeof useApiClient>['client'];

export type Lot = components['schemas']['Lot'];

/** 스캔값이 가리키는 LOT. 찾지 못하면 null이며, 조회 실패와는 다른 결과다. */
export type ScannedLot = Lot | null;

export const lotKeys = {
  scanned: (code: string | null) => ['scanned-lot', code] as const,
};

const findLot = async (client: Client, code: string): Promise<ScannedLot> => {
  /*
   * 정확 일치로 묻는다. 부분 검색은 LOT 번호와 외부 식별자를 함께 훑어 여러 줄이 오고,
   * 그러면 찾는 줄이 첫 페이지 밖으로 밀릴 수 있다. 밀린 것은 없는 것과 구별되지 않는다.
   */
  const data = await runRequest(() =>
    client.GET('/trace/lots', { params: { query: { lotNo: code } } }),
  );

  /*
   * 돌아온 줄도 확인한다. 정확 일치가 지켜지지 않으면 첫 줄은 다른 LOT 이고, 그때 화면은
   * 남의 값을 이 LOT 의 것으로 보인다. 없다고 하는 편이 낫다.
   */
  return data.items.find((lot) => lot.lotNo === code) ?? null;
};

/**
 * 스캔값으로 LOT을 찾는다. 찾지 못한 것과 조회가 실패한 것을 훅이 갈라 준다 —
 * 전자는 데이터가 돌아온 정상 결과(null)이고 후자는 오류 상태다.
 */
export const useScannedLot = (code: string | null): UseQueryResult<ScannedLot> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotKeys.scanned(code),
    enabled: code !== null,
    queryFn: () => {
      if (code === null) {
        throw new Error('스캔하기 전에는 LOT을 조회하지 않습니다.');
      }

      return findLot(client, code);
    },
  });
};
