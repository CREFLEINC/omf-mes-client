import type { ApiClient } from '@omf-mes/api-client';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toScannedPart, type ScanOutcome } from './scan';

/**
 * 스캔 한 번의 조회.
 *
 * **조회가 아니라 액션이다** — 작업자가 읽힌 순간에만 일어나고, 같은 코드를 다시 읽으면 다시
 * 나가야 한다. 그래서 `useQuery`가 아니라 `useMutation`이다. 캐시에 앉히면 두 번째 스캔이
 * 조용히 지난 결과를 되돌려 준다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 */

type Client = ApiClient['client'];

/**
 * 스캔값 하나로 무엇을 읽었는지 정한다 — **두 단계이고 순서가 뜻을 정한다**(omf-mes#254 회신).
 *
 * | 순서 | 질의 | 결과 |
 * | :-: | --- | --- |
 * | 1 | `/trace/lots?lotNo=` | **0건 또는 1건.** LOT 번호 정확 일치이고 공장 안에서 유일하다 |
 * | 2 | `/trace/lots?q=` | 외부 식별자를 훑는다. **여러 건이 올 수 있다** |
 *
 * ⭐ **1단계를 앞에 세우는 것이 이 화면의 가장 조용한 위험을 닫는다.** 부분 검색만으로 집으면
 * 여러 건 중 하나를 화면이 임의로 고르게 되고, 다른 범위의 LOT 을 잘못 가리켜도 아무 오류가
 * 나지 않는다. 교체 기록은 지우지 않고 잇는 것이라(§5-2) 그 잘못이 그대로 계보에 남는다.
 *
 * ⛔ **스캔값을 건드리지 않는다.** 대소문자 규칙이 계약에 아직 없다(omf-mes#254 — 미결).
 * 화면이 올리거나 내리면 **화면이 서버 규칙을 정한 것**이 되고, 서버가 나중에 반대로 정하면
 * 조용히 어긋난다. 앞뒤 공백만 털어 그대로 보낸다.
 *
 * ⛔ **금형을 훑지 않는다.** `P-02-03`의 3단계가 여기 없는 것은 누락이 아니다 — 교체 등록
 * 본문에 금형 자리가 없다(요구서 §3-19).
 */
const lookupScan = async (client: Client, code: string): Promise<ScanOutcome> => {
  /* 1 — 정확 일치. 걸리면 그것이 그 LOT 이므로 더 묻지 않는다. */
  const exact = await runRequest(() =>
    client.GET('/trace/lots', { params: { query: { lotNo: code } } }),
  );

  /*
   * ⛔ **여기서도 고르지 않는다.** 계약이 LOT 번호를 공장 안에서 유일하다고 두었으므로 2건이
   * 올 일은 없지만, 온다면 그것은 「유일하다」가 깨진 것이라 화면이 첫 건을 집을 근거가 더욱
   * 없다. 두 갈래의 규율을 같게 둔다.
   */
  if (exact.items.length > 1) return { kind: 'ambiguous', count: exact.items.length };

  const exactLot = exact.items[0];
  if (exactLot !== undefined) return { kind: 'part', code, part: toScannedPart(exactLot) };

  /* 2 — 외부 식별자. 여기서만 여러 건이 나올 수 있다. */
  const lots = await runRequest(() =>
    client.GET('/trace/lots', { params: { query: { q: code } } }),
  );

  if (lots.items.length > 1) return { kind: 'ambiguous', count: lots.items.length };

  const lot = lots.items[0];

  return lot === undefined
    ? { kind: 'not-found', code }
    : { kind: 'part', code, part: toScannedPart(lot) };
};

export type ScanLookupResult = UseMutationResult<ScanOutcome, Error, string>;

/** 스캔 조회 훅. 읽은 코드 하나만 받는다 — 담기는 것이 하나라 후보 목록이 필요 없다. */
export const useScanLookup = (): ScanLookupResult => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: (code: string) => lookupScan(client, code),
  });
};
