import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { ISSUE_CODES, type Lot, type Printer } from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */
export const tagIssueKeys = {
  all: ['identification-tag-issue'] as const,
  lots: (workOrderId: number) => ['identification-tag-issue', 'lots', workOrderId] as const,
  lotDetail: (lotId: number) => ['identification-tag-issue', 'lot-detail', lotId] as const,
  /** 개체 건수 전체 — 발행 뒤 미발행 양품을 다시 셀 때 이 앞자리로 한 번에 무효화한다. */
  serialCounts: ['identification-tag-issue', 'serial-count'] as const,
  serialCount: (lotId: number) => ['identification-tag-issue', 'serial-count', lotId] as const,
  printers: ['identification-tag-issue', 'printers'] as const,
};

/**
 * 이 작업지시가 원천인 LOT 목록 — 좌단 《대상 LOT》.
 *
 * ⚠ **완료 여부로 좁히지 않는다.** 인식표는 생산 «중»에 양품 개체마다 붙는다(스펙 §2 · 프로세스
 * S7). 완료 축으로 좁히는 것은 LOT 라벨(`P-02-07`)의 사정이고 이 화면의 것이 아니다 — 여기서
 * 걸면 아직 완료되지 않은 LOT 이 목록에서 사라져 발행할 수 없다.
 *
 * ⛔ **양품 수를 이 조회로 채울 수 없다.** 목록 조회에는 생산 진척을 함께 받는 질의가 없고
 * 상세에만 있다(이 저장소 #143 이 같은 사유로 설계 회신을 기다리는 중이다). 그래서 목록은
 * 세우되 양품 열은 비우고 사유를 보인다 — 행마다 상세를 따로 부르는 것은 설계가 정한 방식이
 * 아니므로 화면이 임의로 만들지 않는다.
 */
export const useTargetLots = (workOrderId: number | null): UseQueryResult<Lot[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: tagIssueKeys.lots(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: async (): Promise<Lot[]> => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 대상 LOT 을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/trace/lots', { params: { query: { workOrderId } } }),
      );

      return data.items;
    },
  });
};

/**
 * 고른 LOT 의 생산 진척 — **양품 누계의 유일한 출처**.
 *
 * ⭐ **서버가 계산해 내린다**(공유계약 L-2 · 계약 `LotProgress`). 화면이 실적을 모아 더하면
 * 완료 화면과 이 화면의 값이 갈린다.
 *
 * `withProgress` 를 켜지 않으면 `progress` 가 비어 온다 — 그때는 **양품 수를 모르는 것**이지
 * 0 인 것이 아니다. 아래 판정이 그 둘을 가른다.
 */
export interface LotProgressLookup {
  lot: Lot;
  /** 양품 누계. 서버가 진척을 내리지 않았으면 `null` — 「모른다」와 「0」은 다르다 */
  goodQty: number | null;
}

export const useLotProgress = (lotId: number | null): UseQueryResult<LotProgressLookup> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: tagIssueKeys.lotDetail(lotId ?? 0),
    enabled: lotId !== null,
    queryFn: async (): Promise<LotProgressLookup> => {
      if (lotId === null) throw new Error('LOT 을 고르지 않으면 진척을 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/trace/lots/{lotId}', {
          params: { path: { lotId }, query: { withProgress: true } },
        }),
      );

      return { lot: data.lot, goodQty: data.lot.progress?.goodQty ?? null };
    },
  });
};

/**
 * 이 LOT 에 이미 발번된 개체 수 — **미발행 양품 계산의 다른 한 항**(스펙 §6).
 *
 * ⭐ **건수만 필요하므로 쪽 정보의 총계를 읽는다.** 개체 목록 전체를 받아 세면 480 건이 그대로
 * 화면으로 올라오는데, 여기서 쓰는 것은 숫자 하나다.
 */
export const useIssuedSerialCount = (lotId: number | null): UseQueryResult<number> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: tagIssueKeys.serialCount(lotId ?? 0),
    enabled: lotId !== null,
    queryFn: async (): Promise<number> => {
      if (lotId === null) throw new Error('LOT 을 고르지 않으면 개체를 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/trace/serial-numbers', { params: { query: { lotId, size: 1 } } }),
      );

      return data.page.total;
    },
  });
};

/**
 * 이 단말이 쓸 수 있는 프린터 — 화면 머리에 상시 보인다(스펙 §3 · K-3).
 *
 * ⚠ **단말을 주지 않는다** — 계약이 「주지 않으면 요청 단말 기준」이라 못박았고, 이 화면은
 * 단말 번호를 셸에서 받기 전이라도 프린터 상태를 보여야 한다.
 */
export const usePrinters = (): UseQueryResult<Printer[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: tagIssueKeys.printers,
    queryFn: async (): Promise<Printer[]> => {
      const data = await runRequest(() =>
        client.GET('/app/printers', {
          params: { query: { documentTypeCode: ISSUE_CODES.documentType } },
        }),
      );

      return data.items;
    },
  });
};
