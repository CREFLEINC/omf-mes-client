import type { ApiClient } from '@omf-mes/api-client';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  hasMaterial,
  toScannedMaterial,
  toScannedMold,
  type ScanDraft,
  type ScanOutcome,
} from './scan';

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
 * 자재LOT을 먼저 찾고, 없으면 금형을 찾는다.
 *
 * **순서가 뜻을 정한다.** 칸이 하나라 무엇을 읽었는지 화면이 모르는데, 둘을 동시에 물으면
 * 양쪽에서 찾혔을 때 무엇으로 담을지 정할 근거가 없다. 자재가 먼저인 이유는 이 화면의 주
 * 업무가 자재 투입이어서다 — 금형은 한 번 물리고 자재는 계속 읽는다.
 */
const lookupScan = async (client: Client, draft: ScanDraft, code: string): Promise<ScanOutcome> => {
  const lots = await runRequest(() =>
    client.GET('/trace/lots', { params: { query: { q: code } } }),
  );

  if (lots.items.length > 1) return { kind: 'ambiguous', count: lots.items.length };

  const lot = lots.items[0];
  if (lot !== undefined) {
    return hasMaterial(draft, lot.lotId)
      ? { kind: 'duplicate', code, lotNo: lot.lotNo }
      : { kind: 'material', code, material: toScannedMaterial(lot) };
  }

  const molds = await runRequest(() =>
    client.GET('/mdm/molds', { params: { query: { q: code } } }),
  );

  if (molds.items.length > 1) return { kind: 'ambiguous', count: molds.items.length };

  const mold = molds.items[0];

  return mold === undefined
    ? { kind: 'not-found', code }
    : { kind: 'mold', code, mold: toScannedMold(mold) };
};

export interface ScanLookupVariables {
  draft: ScanDraft;
  code: string;
}

export type ScanLookupResult = UseMutationResult<ScanOutcome, Error, ScanLookupVariables>;

/**
 * 스캔 조회 훅.
 *
 * **후보 목록을 인자로 받는다.** 중복 판정에 필요한데, 훅이 그것을 들고 있으면 화면의 상태와
 * 훅의 상태가 둘로 갈려 어느 쪽이 정본인지 알 수 없게 된다.
 */
export const useScanLookup = (): ScanLookupResult => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: ({ draft, code }: ScanLookupVariables) => lookupScan(client, draft, code),
  });
};
