import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

export type Lot = components['schemas']['Lot'];
export type ApprovalRequest = components['schemas']['ApprovalRequest'];

/**
 * 검사 대기 상태의 코드 문자열.
 *
 * 계약이 품질 판정 축의 값 넷을 이름으로 적어 두었고 그중 하나다. 값 목록 자체는 공통코드가
 * 내려주지만, 이 화면은 그중 한 값인지만 물으므로 목록을 받아 올 자리가 없다.
 */
export const INSPECTION_PENDING = 'INSPECTION_PENDING';

/**
 * 승인 요청이 가리키는 대상의 유형.
 *
 * 다형 참조라 같은 번호가 다른 표를 가리킬 수 있다. 유형 없이 번호만으로 물으면 남의 표의
 * 요청을 이 LOT 의 것으로 읽는다.
 */
export const INBOUND_LOT = 'INBOUND_LOT';

export const iqcSkipKeys = {
  lot: (code: string | null) => ['iqc-skip-lot', code] as const,
  item: (itemId: number | null) => ['iqc-skip-item', itemId] as const,
  uoms: () => ['iqc-skip-uoms'] as const,
  pending: (lotId: number | null) => ['iqc-skip-pending', lotId] as const,
  mine: () => ['iqc-skip-mine'] as const,
};

/** 스캔값이 가리키는 LOT. 찾지 못하면 null이며, 조회 실패와는 다른 결과다. */
export type ScannedLot = Lot | null;

const findLot = async (client: Client, code: string): Promise<ScannedLot> => {
  /*
   * 정확 일치로 묻는다. 부분 검색은 LOT 번호와 외부 식별자를 함께 훑어 여러 줄이 오고,
   * 찾는 줄이 첫 페이지 밖으로 밀리면 없는 것과 구별되지 않는다.
   */
  const data = await runRequest(() =>
    client.GET('/trace/lots', { params: { query: { lotNo: code } } }),
  );

  return data.items.find((lot) => lot.lotNo === code) ?? null;
};

export const useScannedLot = (code: string | null): UseQueryResult<ScannedLot> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcSkipKeys.lot(code),
    enabled: code !== null,
    queryFn: () => {
      if (code === null) {
        throw new Error('스캔하기 전에는 LOT을 조회하지 않습니다.');
      }

      return findLot(client, code);
    },
  });
};

export interface ItemName {
  itemCode: string;
  itemName: string;
}

/** 계약의 LOT 응답에 품목 이름이 없어 되짚어 부른다. 스캔한 것이 맞는지 사람이 볼 값이다. */
export const useItemName = (itemId: number | null): UseQueryResult<ItemName> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcSkipKeys.item(itemId),
    enabled: itemId !== null,
    queryFn: async () => {
      if (itemId === null) {
        throw new Error('LOT을 찾기 전에는 품목을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
      );

      return { itemCode: data.item.itemCode, itemName: data.item.itemName };
    },
  });
};

/** 단위는 단건 조회가 없어 목록으로 받는다. 미사용 단위를 쓰는 과거 LOT 도 이름이 나오게 한다. */
export const useUomCodes = (enabled: boolean): UseQueryResult<Map<number, string>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcSkipKeys.uoms(),
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );

      return new Map(data.items.map((uom) => [uom.uomId, uom.uomCode]));
    },
  });
};

/**
 * 이 LOT 에 아직 끝나지 않은 요청이 있는가.
 *
 * 막지 않는다. 취소가 없는 화면이라 다시 올리는 것이 유일한 정정 경로이고, 막으면 그 길까지
 * 닫힌다.
 */
export const usePendingRequest = (lotId: number | null): UseQueryResult<ApprovalRequest | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcSkipKeys.pending(lotId),
    enabled: lotId !== null,
    queryFn: async () => {
      if (lotId === null) {
        throw new Error('LOT을 찾기 전에는 요청을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/app/approval-requests', {
          params: {
            query: { targetTypeCode: INBOUND_LOT, targetId: lotId, pendingOnly: true, size: 1 },
          },
        }),
      );

      return data.items[0] ?? null;
    },
  });
};

/**
 * 내가 올린 요청.
 *
 * 승인 유형으로 거르지 않는다. 그 코드 문자열은 아직 확정 전이라, 지어내 실으면 값이 달라지는
 * 순간 목록이 조용히 빈다 - 비어 있는 것과 없는 것이 화면에서 같아 보인다.
 */
export const useMyRequests = (): UseQueryResult<ApprovalRequest[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcSkipKeys.mine(),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/app/approval-requests', {
          params: { query: { requestedByMe: true, size: 20 } },
        }),
      );

      return data.items;
    },
  });
};
