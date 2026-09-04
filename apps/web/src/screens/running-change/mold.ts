import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 지금 물린 금형 — **읽기 전용이다**(스펙 §4-B).
 *
 * ⛔ **교체 등록 본문에 담지 않는다.** `material_consumption` 은 자재 축이고 금형은 그 축에
 * 자리가 없다(요구서 §3-19). 여기서 하는 일은 작업자가 「지금 무엇이 물려 있는지」를 보는
 * 것뿐이다.
 *
 * ⚠ **타발수가 넘어도 막지 않는다**(§6 — 경고). 차단 여부를 설계가 정한 적이 없고, 여기서
 * 차단을 만들면 승인된 적 없는 규칙이 현장에 굳는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 */

type Client = ApiClient['client'];

export const moldKeys = {
  detail: (moldId: number) => ['running-change', 'mold', moldId] as const,
};

export interface CurrentMold {
  moldId: number;
  moldCode: string;
  moldName: string;
  currentShotCount: number;
  /** 서버가 계산한 남은 타수. 적정 타수가 없으면 `null`이고 화면은 「산출 불가」로 그린다. */
  availableShotCount: number | null;
}

const fetchMold = async (client: Client, moldId: number): Promise<CurrentMold> => {
  const data = await runRequest(() =>
    client.GET('/mdm/molds/{moldId}', { params: { path: { moldId } } }),
  );

  return {
    moldId: data.mold.moldId,
    moldCode: data.mold.moldCode,
    moldName: data.mold.moldName,
    currentShotCount: data.mold.currentShotCount,
    availableShotCount: data.mold.availableShotCount ?? null,
  };
};

/**
 * 적정 타수를 넘었는가.
 *
 * 적정 타수가 없으면 **넘었는지 알 수 없다** — `false`가 아니라 판정 자체가 서지 않으므로
 * 화면은 「산출 불가」로 말한다(`availableShotCount`가 `null`인 것이 그 표현이다).
 */
export const isShotCountExceeded = (mold: CurrentMold): boolean =>
  mold.availableShotCount !== null && mold.availableShotCount <= 0;

export interface CurrentMoldResult {
  mold: CurrentMold | null;
  /** 세션에 금형이 없는 것과 조회가 실패한 것을 화면이 다르게 말하게 한다. */
  isError: boolean;
}

/**
 * 세션이 알려 준 금형 하나를 읽는다. 번호가 없으면 조회하지 않는다.
 *
 * ⛔ **실패를 「금형 없음」으로 접지 않는다.** 물려 있는데 못 읽은 것과 애초에 없는 것은
 * 작업자가 할 일이 다르다.
 */
export const useCurrentMold = (moldId: number | null): CurrentMoldResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: moldKeys.detail(moldId ?? 0),
    enabled: moldId !== null,
    queryFn: () => {
      if (moldId === null) {
        throw new Error('금형 번호를 모르면 조회하지 않습니다.');
      }

      return fetchMold(client, moldId);
    },
  });

  return { mold: query.data ?? null, isError: query.isError };
};
