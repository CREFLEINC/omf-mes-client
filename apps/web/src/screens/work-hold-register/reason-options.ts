import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { HOLD_REASON_GROUP_CODE } from './codes';
import { readHoldReasons, writeHoldReasons, type HoldReason as CachedReason } from './reason-cache';

/**
 * 중단 사유 목록 — **서버가 갖는다**(스펙 §5-4 · 2026-09-06 게이트 승인 · 공유계약 G-32).
 *
 * 앞선 판은 7값을 화면 상수로 들고 있었다. 그때는 「스펙 §3 목업의 7값이 확정 목록」으로 읽었는데,
 * 개정이 그것을 **초기 시드**로 정정했다 — 이 그룹은 `registry`(고객이 값을 늘린다)라 화면이
 * 들고 있으면 **고객이 늘린 사유가 영영 안 보인다.**
 *
 * ⛔ **채번 식별자(`codeGroupId`)를 쓰지 않는다.** 정수는 환경마다 달라 하드코딩할 수 없다 —
 * 계약이 그래서 `codeGroupCode` 를 열어 두었고(둘 중 «정확히 하나»를 준다), 화면은 이름으로
 * 가리킨다. 그룹을 먼저 찾아 번호를 얻는 두 걸음이 필요 없다.
 *
 * ⛔ **값 문면을 보지 않는다.** 거르지도, 차례를 바꾸지도, 특정 값을 알아보지도 않는다 —
 * 받은 것을 그대로 그린다. 차례가 뜻일 수 있다(자주 쓰는 것부터 등).
 *
 * ⛔ **꺼진 값을 받지 않는다**(`includeInactive` 를 켜지 않는다). 지난 기록의 이름을 푸는 자리가
 * 아니라 **지금 고르는 목록**이다 — 마스터에서 끈 사유가 여기 남으면 끈 일이 무의미해진다.
 * 이력 표의 사유 이름은 서버가 함께 내려 준다(`WorkSessionEvent.reasonName`).
 */

export interface HoldReason {
  code: string;
  name: string;
}

export const holdReasonKeys = {
  values: ['work-hold-register', 'reasons'] as const,
};

const EMPTY_REASONS: HoldReason[] = [];

/**
 * 한 번에 받을 쪽 크기.
 *
 * ⛔ **서버 기본값에 맡기지 않는다.** 이 그룹은 `registry`(고객이 늘린다)이고 목록 조회는 쪽을
 * 나눠 내려 준다 — 기본 크기를 넘긴 사유는 응답에 실리지 않고, 화면에는 **「없는 사유」와
 * 똑같이 보인다.** 고를 수 없는 것과 존재하지 않는 것이 같은 모양이 되면 현장이 「기타」로
 * 몰아 적고 그 기록은 정정 경로가 없다.
 *
 * ⚠ 그래도 넘칠 수 있으므로 넘친 사실을 화면이 말한다(`truncated`).
 */
const PAGE_SIZE = 200;

export interface HoldReasonsResult {
  reasons: HoldReason[];
  /** 받은 것이 전부가 아니다 — 화면이 그 사실을 말한다. */
  truncated: boolean;
  /**
   * 서버가 아니라 **받아 둔 것**으로 그렸는가(#1005).
   *
   * ⚠ 화면이 이 사실을 말해야 한다 — 마스터에서 사유가 늘거나 꺼졌어도 여기엔 안 비친다.
   */
  fromCache: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

interface ReasonPage {
  reasons: HoldReason[];
  truncated: boolean;
  fromCache: boolean;
}

/**
 * 사유 목록 조회.
 *
 * ⚠ **못 받은 것을 「없다」로 말하지 않는다.** 목록이 비어 보이면 작업자는 고를 것이 없다고
 * 읽는데, 실패와 0건은 할 일이 다르다 — 실패는 다시 받아 보는 것이고 0건은 마스터를 채우는
 * 것이다. 그래서 두 상태를 갈라 낸다.
 */
export const useHoldReasons = (): HoldReasonsResult => {
  const { client } = useApiClient();

  const query = useQuery<ReasonPage>({
    queryKey: holdReasonKeys.values,
    queryFn: async (): Promise<ReasonPage> => {
      try {
        const data = await runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupCode: HOLD_REASON_GROUP_CODE, size: PAGE_SIZE } },
          }),
        );

        const reasons = data.items.map((item) => ({ code: item.code, name: item.codeName }));

        /*
         * ⭐ **닿은 김에 받아 둔다**(#1005). 끊긴 뒤에 사유를 고를 근거는 이것뿐이다.
         *    받아 두기가 실패해도 지금 조회는 성공이다 — 순서를 뒤집지 않는다.
         */
        await writeHoldReasons(reasons, new Date().toISOString());

        /* 서버가 센 전체가 받은 것보다 많으면 잘린 것이다. */
        return { reasons, truncated: data.page.total > data.items.length, fromCache: false };
      } catch (error) {
        /*
         * ⛔ **끊겼다고 사유가 없는 것이 아니다**(#1005). 전에는 여기서 그대로 실패해
         *    라디오가 한 줄도 그려지지 않았고, **설비가 멈춘 순간에 중단을 기록할 수 없었다** —
         *    기록 자체는 outbox 에 담기게 돼 있는데 고를 것이 없어 담을 수조차 없었다.
         *
         * ⚠ 받아 둔 것이 없으면 그대로 실패한다. 「받지 못했다」를 「사유가 없다」로 바꾸지 않는다.
         */
        const cached: CachedReason[] | null = await readHoldReasons();

        if (cached === null) throw error;

        return { reasons: cached, truncated: false, fromCache: true };
      }
    },
  });

  const data = query.data;

  return {
    reasons: data?.reasons ?? EMPTY_REASONS,
    truncated: data?.truncated ?? false,
    fromCache: data?.fromCache ?? false,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
};
