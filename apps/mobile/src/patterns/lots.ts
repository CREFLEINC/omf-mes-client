import type { LotForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

type Client = ReturnType<typeof useApiClient>['client'];

/** 005 — 입하 LOT · 패키징 칸이 실린 LOT(계약 §1 · 생성 타입). */
export type Lot = LotForward;

/**
 * 아직 쓸 수 없는 자재 관리 LOT 의 생애 — 미리 만들어 라벨만 붙은 대기(`WAITING`)와 폐기(`VOIDED`).
 * 입하(`ACTIVE`)·생애 없음(이전 LOT · 제품 LOT)은 지금 그대로 둔다(US1-6).
 */
export type LotLifecycleBlock = 'WAITING' | 'VOIDED';

/** 스캔한 LOT 이 대기 · 폐기 LOT 인가. 아니면 null — 그 밖의 판정은 화면 · 서버 몫이다. */
export const lifecycleBlockOf = (
  lot: Pick<Lot, 'lifecycleStatusCode'> | null | undefined,
): LotLifecycleBlock | null => {
  const code = lot?.lifecycleStatusCode;

  return code === 'WAITING' || code === 'VOIDED' ? code : null;
};

/**
 * 대기 · 폐기 LOT 을 사람의 말로 — 「아직 입하되지 않은 LOT」 · 「폐기된 LOT」(US1-6).
 * 서버 거절 문구를 그대로 쓰는 화면은 이 말을 쓰지 않는다.
 */
export const lifecycleBlockText = (block: LotLifecycleBlock): string =>
  block === 'WAITING' ? messages.materialPicking.lot.waiting : messages.materialPicking.lot.voided;

/** 스캔한 LOT 이 대기 · 폐기면 그 안내, 아니면 null. */
export const lifecycleNoticeOf = (
  lot: Pick<Lot, 'lifecycleStatusCode'> | null | undefined,
): string | null => {
  const block = lifecycleBlockOf(lot);

  return block === null ? null : lifecycleBlockText(block);
};

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
export const useScannedLot = (
  code: string | null,
  /**
   * 댈 때마다 서버에 다시 묻는다. 「이미 있는가」를 가르는 확인은 앞서 받은 「없음」을 믿으면
   * 안 된다 — 그 사이 이 단말의 입하가 그 LOT 을 만들었을 수 있다(omf-all-around#28).
   */
  options: { alwaysFresh?: boolean } = {},
): UseQueryResult<ScannedLot> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotKeys.scanned(code),
    enabled: code !== null,
    ...(options.alwaysFresh === true ? { staleTime: 0 } : {}),
    queryFn: () => {
      if (code === null) {
        throw new Error('스캔하기 전에는 LOT을 조회하지 않습니다.');
      }

      return findLot(client, code);
    },
  });
};
