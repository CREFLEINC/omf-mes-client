import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';
import { REISSUE_REASON_GROUP_CODE } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 사람이 읽는 이름으로 푸는 자리 — 품목 · 단위 · LOT,
 * 그리고 재발행 사유의 선택지.
 *
 * ⭐ **출고 라인 응답은 번호만 준다**(계약 `GoodsIssueLine` 실측 — `itemId`·`lotId`·`uomId`).
 * 목록은 품목 코드와 LOT 번호를 보여야 하므로 이름을 여기서 따로 받는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const EMPTY_ENTRIES: LookupEntry[] = [];

/** 한 번에 받아 둘 최대 건수. 사유 값이 이보다 많을 일은 없다. */
const REASON_OPTION_SIZE = 100;

export const goodsIssueQrLookupKeys = {
  items: ['goods-issue-qr-lookups', 'items'] as const,
  uoms: ['goods-issue-qr-lookups', 'uoms'] as const,
  lot: (lotId: number) => ['goods-issue-qr-lookups', 'lot', lotId] as const,
  reissueReasons: ['goods-issue-qr-lookups', 'reissue-reasons'] as const,
};

/**
 * 품목 이름 — **미사용 품목까지 받는다.** 지난 전표가 참조하는 품목이 이름 없이 비어 보이면
 * 사용자는 무엇을 찍는지 모른 채 발행하게 된다.
 */
export const useItemNames = (): LookupSource => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: goodsIssueQrLookupKeys.items,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/items', { params: { query: { includeInactive: true } } })),
  });

  return {
    entries:
      query.data?.items.map((item) => ({
        value: String(item.itemId),
        label: `${item.itemCode} · ${item.itemName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/** 단위 이름 — 수량 옆에 붙는다. */
export const useUomNames = (): LookupSource => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: goodsIssueQrLookupKeys.uoms,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  return {
    entries:
      query.data?.items.map((item) => ({
        value: String(item.uomId),
        label: item.uomCode,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/**
 * LOT 번호 — **번호마다 따로 묻는다.**
 *
 * ⛔ 목록을 통째로 받아 거르지 않는다. LOT 은 공장 전체에서 계속 늘어나는 자원이라 한 쪽에
 * 담기지 않고, 담기지 않으면 **이름이 조용히 비어 보인다.** 한 전표의 라인 수는 사람이 한
 * 화면에서 고르는 만큼이라 건별 조회가 성립한다.
 */
export const useLotNames = (lotIds: readonly number[]): LookupSource => {
  const { client } = useApiClient();
  const unique = [...new Set(lotIds)].sort((left, right) => left - right);

  const results = useQueries({
    queries: unique.map((lotId) => ({
      queryKey: goodsIssueQrLookupKeys.lot(lotId),
      queryFn: () =>
        runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } })),
    })),
  });

  return {
    entries: results.flatMap((result) =>
      result.data === undefined
        ? []
        : [{ value: String(result.data.lot.lotId), label: result.data.lot.lotNo, isActive: true }],
    ),
    isError: results.some((result) => result.isError),
    isLoading: results.some((result) => result.isPending),
  };
};

/**
 * 재발행 사유의 값 목록 — **고객의 공통코드 마스터에서 받는다.**
 *
 * ⚠ **값 문면을 보지 않는다.** 이 슬라이스 어디에도 사유 코드 리터럴을 두지 않는다 — 거르지도,
 * 특정 값을 알아보지도, 마스터가 정한 차례를 바꾸지도 않는다.
 *
 * ⛔ **두 걸음으로 부르지 않는다.** 계약이 그룹 이름을 직접 받으므로 채번 식별자를 먼저 얻을
 * 필요가 없다 — 그 번호는 환경마다 달라 화면이 들 수 없는 값이다.
 */
export const useReissueReasonOptions = (): LookupSource => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: goodsIssueQrLookupKeys.reissueReasons,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: REISSUE_REASON_GROUP_CODE,
              /* 지금 고를 수 있는 사유만 낸다 — 쓰지 않게 된 사유를 새로 고르게 두지 않는다. */
              includeInactive: false,
              size: REASON_OPTION_SIZE,
            },
          },
        }),
      );

      return (
        [...data.items]
          /* 마스터가 정한 차례를 그대로 따른다 — 화면이 다시 줄 세우면 마스터와 어긋난다. */
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((item) => ({ value: item.code, label: item.codeName, isActive: item.isActive }))
      );
    },
  });

  return {
    entries: query.data ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: query.isPending,
  };
};
