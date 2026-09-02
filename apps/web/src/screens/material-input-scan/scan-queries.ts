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
type LotItem = Parameters<typeof toScannedMaterial>[0];

/** 찾은 LOT을 결과로 옮긴다. 이미 담긴 것이면 중복으로 말한다. */
const toLotOutcome = (draft: ScanDraft, code: string, lot: LotItem): ScanOutcome =>
  hasMaterial(draft, lot.lotId)
    ? { kind: 'duplicate', code, lotNo: lot.lotNo }
    : { kind: 'material', code, material: toScannedMaterial(lot) };

/**
 * 스캔값 하나로 무엇을 읽었는지 정한다 — **세 단계이고 순서가 뜻을 정한다**(omf-mes#254 회신).
 *
 * | 순서 | 질의 | 결과 |
 * | :-: | --- | --- |
 * | 1 | `/trace/lots?lotNo=` | **0건 또는 1건.** LOT 번호 정확 일치이고 공장 안에서 유일하다 |
 * | 2 | `/trace/lots?q=` | 외부 식별자를 훑는다. **여러 건이 올 수 있다** |
 * | 3 | `/mdm/molds?q=` | 금형·지그 |
 *
 * ⭐ **1단계를 앞에 세우는 것이 이 화면의 가장 조용한 위험을 닫는다.** 부분 검색만으로 집으면
 * 여러 건 중 하나를 화면이 임의로 고르게 되고, 다른 범위의 LOT을 잘못 가리켜도 아무 오류가
 * 나지 않는다. 투입 기록은 정정이 아니라 새 기록으로만 고칠 수 있어(이력 불변 B-3) 그 잘못이
 * 그대로 계보에 남는다. 같은 사고가 이미 한 번 있었다(설계 회신 인용 — `omf-mes#176`).
 *
 * ⛔ **스캔값을 건드리지 않는다.** 대소문자 규칙이 계약에 아직 없다(#254 물음 ② — 미결).
 * 화면이 올리거나 내리면 **화면이 서버 규칙을 정한 것**이 되고, 서버가 나중에 반대로 정하면
 * 조용히 어긋난다. 앞뒤 공백만 털어 그대로 보낸다.
 *
 * ⛔ **금형을 `toolTypeCode`로 좁히지 않는다.** 값 목록이 아직 정해지지 않았고(#254 덧붙임),
 * 계약의 `example`은 값 목록이 아니다. 지어낸 값으로 좁히면 지그를 쓰는 공정에서 스캔이
 * **오류 없이 조용히** 실패한다.
 */
const lookupScan = async (client: Client, draft: ScanDraft, code: string): Promise<ScanOutcome> => {
  /* 1 — 정확 일치. 걸리면 그것이 그 LOT이므로 더 묻지 않는다. */
  const exact = await runRequest(() =>
    client.GET('/trace/lots', { params: { query: { lotNo: code } } }),
  );

  const exactLot = exact.items[0];
  if (exactLot !== undefined) return toLotOutcome(draft, code, exactLot);

  /* 2 — 외부 식별자. 여기서만 여러 건이 나올 수 있다. */
  const lots = await runRequest(() =>
    client.GET('/trace/lots', { params: { query: { q: code } } }),
  );

  if (lots.items.length > 1) return { kind: 'ambiguous', count: lots.items.length };

  const lot = lots.items[0];
  if (lot !== undefined) return toLotOutcome(draft, code, lot);

  /* 3 — 금형. */
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
