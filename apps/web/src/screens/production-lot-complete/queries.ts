import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  VARIANCE_REASON_CODE_GROUP,
  type CodeValue,
  type Lot,
  type LotProgress,
  type ReasonOption,
} from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */
export const lotCompleteKeys = {
  all: ['production-lot-complete'] as const,
  /** 대상 LOT 목록 전체 — 완료 뒤 이 앞자리로 한 번에 무효화한다. */
  lotsAll: ['production-lot-complete', 'lots'] as const,
  lots: (workOrderId: number) => ['production-lot-complete', 'lots', workOrderId] as const,
  /** LOT 상세 전체 — 완료 뒤 이 앞자리로 한 번에 무효화한다. */
  lotDetails: ['production-lot-complete', 'lot-detail'] as const,
  lotDetail: (lotId: number) => ['production-lot-complete', 'lot-detail', lotId] as const,
  reasons: ['production-lot-complete', 'variance-reasons'] as const,
};

/** 좌단 목록이 받은 것 — 행과, 서버가 말한 «전체» 수. 안내 문구가 후자를 쓴다. */
export interface TargetLots {
  items: Lot[];
  /** 이 작업지시의 미완료 LOT 전체 수. 화면이 받은 행 수와 다를 수 있다. */
  total: number;
  /** 한 쪽에 다 담기지 않았는가. 화면이 그 사실을 말한다. */
  truncated: boolean;
}

/** 한 번에 받아 둘 사유 값의 상한. 사유 목록이 이보다 길 일은 없다. */
const REASON_PAGE_SIZE = 200;

/**
 * 한 쪽에 받아 둘 대상 LOT 수.
 *
 * ⛔ **쪽 크기를 서버 기본값에 맡기지 않는다** — 선발행 슬롯이 그보다 많은 W/O 에서 뒷 LOT 이
 * 조용히 사라지고, 슬롯 안내가 그 «잘린» 수를 남은 수로 단언한다(리뷰 실측).
 */
const LOT_PAGE_SIZE = 100;

/**
 * 좌단 《LOT 목록》 — 이 작업지시가 원천인 **아직 완료되지 않은** 생산LOT.
 *
 * ⭐ **완료 축은 `completed` 다.** 「이미 완료된 LOT 은 목록에서 제외」(스펙 §6)를 이 질의가
 * 집행한다. ⛔ `statusCode`(품질 판정 축)로는 완료를 고를 수 없고, 응답을 화면이 거르는 것으로도
 * 성립하지 않는다 — 목록이 쪽 단위다(공유계약 L-11).
 *
 * ⛔ **`lotTypeCode` 를 걸지 않는다.** `workOrderId` 가 이미 생산LOT 만 남기고, 값 목록이 확정되지
 * 않은 축을 얹으면 목록이 조용히 빈다(`omf-mes#269` 회신 · 이 저장소 #143).
 *
 * ⚠ **양품 수를 이 조회로 채울 수 없다.** 목록 조회에는 생산 진척을 함께 받는 질의가 없고
 * 상세에만 있다 — `omf-mes#269` 의 잔여이며 이 저장소 #143 이 같은 사유로 기다린다. 그래서
 * 목록은 세우되 양품 열은 비우고 사유를 보인다(검토 요청 `omf-mes#399` 3번).
 */
export const useTargetLots = (workOrderId: number | null): UseQueryResult<TargetLots> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotCompleteKeys.lots(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: async (): Promise<TargetLots> => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 대상 LOT 을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: {
            query: { workOrderId, completed: false, page: 1, size: LOT_PAGE_SIZE },
          },
        }),
      );

      return { items: data.items, total: data.page.total, truncated: data.page.total > data.items.length };
    },
  });
};

/**
 * 고른 LOT 의 상세와 진척 — **누적 양품·달성률·판정의 유일한 출처**.
 *
 * ⭐ **서버가 계산해 내린다**(계약 `LotProgress` — 「이 LOT 에 배분된 양품 합계」). 화면이 실적을
 * 모아 더하지 않는다.
 *
 * ⚠ **착수 통지는 누적 양품의 출처로 `GET /production/production-results` 를 지정했다.** 그
 * 응답에는 LOT 축이 없어 LOT별 값을 낼 수 없다 — 검토 요청 `omf-mes#399` 1번으로 올렸고, 회신이
 * 오기 전까지 계약이 그 자리에 둔 `LotProgress` 를 따른다.
 *
 * `withProgress` 를 켜지 않으면 `progress` 가 비어 온다 — 그때는 **양품 수를 모르는 것**이지
 * 0 인 것이 아니다.
 */
export interface LotDetailLookup {
  lot: Lot;
  /** 생산 진척. 서버가 내리지 않았으면 `null` — 「모른다」와 「0」은 다르다 */
  progress: LotProgress | null;
}

/**
 * 완료 쓰기가 잠글 대상의 경로. **조회와 쓰기가 같은 문자열을 봐야** 토큰이 맞는다 —
 * 보관소는 경로별이라 한 글자만 달라도 못 찾는다(`api-client/etag-store`).
 */
export const lotDetailPath = (lotId: number): string => `/trace/lots/${String(lotId)}`;

export const useLotDetail = (lotId: number | null): UseQueryResult<LotDetailLookup> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotCompleteKeys.lotDetail(lotId ?? 0),
    enabled: lotId !== null,
    queryFn: async (): Promise<LotDetailLookup> => {
      if (lotId === null) throw new Error('LOT 을 고르지 않으면 상세를 조회하지 않습니다.');

      /*
       * ⭐ **낙관적 잠금 토큰을 여기서 꺼내지 않는다.** 클라이언트가 GET 응답의 `ETag` 를
       * 경로별 보관소에 자동으로 담아 두고, 쓰기는 그 자리에서 꺼내 쓴다(A-4 — 표시하지 않되
       * 전달한다). 화면 상태로 들고 다니면 새로 고친 값과 어긋난 채 굳는다.
       */
      const data = await runRequest(() =>
        client.GET('/trace/lots/{lotId}', {
          params: { path: { lotId }, query: { withProgress: true } },
        }),
      );

      return { lot: data.lot, progress: data.lot.progress ?? null };
    },
  });
};

/**
 * 미달 사유 선택지.
 *
 * ⛔ **값이 없으면 미달 마감을 열지 않는다** — 사유는 필수이고(§5-3), 고를 것이 없는 필수 칸을
 * 열어 두면 사용자가 누르고 나서야 서버 거부를 본다.
 *
 * ⚠ 코드 그룹 이름은 계약이 밝히지 않아 W/O 마감과 같은 값을 쓴다(`types.ts` 주석 · `omf-mes#399`).
 */
export const useVarianceReasons = (): UseQueryResult<ReasonOption[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotCompleteKeys.reasons,
    queryFn: async (): Promise<ReasonOption[]> => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: VARIANCE_REASON_CODE_GROUP,
              page: 1,
              size: REASON_PAGE_SIZE,
            },
          },
        }),
      );

      return toReasonOptions(data.items);
    },
  });
};

/**
 * 쓸 수 있는 값만 서버의 표시 순서로 옮긴다.
 *
 * ⛔ **이름이 비었다고 그 줄을 버리지 않는다** — 코드는 유효하므로 코드를 그대로 보인다.
 * 버리면 고를 수 있어야 할 사유가 목록에서 사라진다.
 */
export const toReasonOptions = (values: readonly CodeValue[]): ReasonOption[] =>
  values
    .filter((value) => value.isActive)
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((value) => ({
      value: value.code,
      label: value.codeName.trim() === '' ? value.code : value.codeName,
    }));
