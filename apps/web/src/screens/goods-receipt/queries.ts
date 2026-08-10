import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { IrFilterQuery } from './filters';
import { toIrLineView, toIrView, type IrLineView, type IrListResult } from './types';

/**
 * 이 화면의 읽기 — **PR ①에서는 오퍼레이션이 둘이다.**
 *
 * 계약에는 입하 상세(`GET /logistics/inbound-receipts/{id}`)도 있으나 **부르지 않는다.**
 * 상세가 주는 `{inboundReceipt, lines}` 중 헤더는 목록 응답의 행에 이미 들어 있어,
 * 상세를 부르면 같은 값을 한 번 더 받는다. 한 건을 고르면 라인 경로만 부른다 — 요청 1회다.
 *
 * **쓰기가 하나도 없다.** 이 PR이 만드는 것은 대상을 고르는 데까지이고,
 * `POST /logistics/goods-receipts`는 PR ②에서 붙는다. 되돌릴 수 없는 쓰기라
 * 결과를 보여 줄 구획과 함께 나가야 한다(계획 §5.0).
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다** —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 */
export type IrListQuery = IrFilterQuery & {
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
};

/**
 * 캐시 키.
 *
 * **목록과 라인의 앞머리를 갈라 둔다** — 하나로 묶으면 목록만 다시 부르려 해도 라인까지
 * 함께 무효화되고, 그때 라인 응답이 새 참조로 오면서 **치던 값이 사라진다**(#43의 형태).
 * 그 위험은 초안이 생기는 PR ②에서 실제 피해가 되지만, 갈라 두는 것은 지금 한다.
 */
const IR_LIST_KEY = ['inbound-receipts', 'list'] as const;

export const irKeys = {
  lists: IR_LIST_KEY,
  list: (query: IrListQuery) => [...IR_LIST_KEY, query] as const,
  lines: (inboundReceiptId: number | null) =>
    ['inbound-receipts', 'lines', inboundReceiptId] as const,
};

const fetchInboundReceipts = async (
  client: Client,
  query: IrListQuery,
): Promise<IrListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-receipts', { params: { query } }),
  );

  return { items: data.items.map(toIrView), page: data.page };
};

/**
 * 대상 입하 전표 목록.
 *
 * **조건이 하나도 없어도 조회한다.** 화면에 들어오면 곧바로 받아들일 수 있는 입하가 보여야
 * 사용자가 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
 *
 * **기본 기간을 심지 않는다**(계획 결정 6). 첫 요청에 날짜가 실리지 않는다.
 */
export const useInboundReceipts = (query: IrListQuery): UseQueryResult<IrListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: irKeys.list(query),
    queryFn: () => fetchInboundReceipts(client, query),
  });
};

const fetchInboundReceiptLines = async (
  client: Client,
  inboundReceiptId: number,
): Promise<IrLineView[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-receipts/{inboundReceiptId}/lines', {
      params: { path: { inboundReceiptId } },
    }),
  );

  return data.items.map(toIrLineView);
};

/**
 * 고른 전표의 라인.
 *
 * **고르기 전에는 부르지 않는다.** 캐시 키가 고른 번호를 담으므로 같은 전표를 다시 그려도
 * 요청이 한 번을 넘지 않는다.
 *
 * 이 응답의 참조(`data`)가 바뀌는 것이 **고른 라인을 다시 판정하는 신호**다 —
 * PR ②에서는 초안을 새로 만드는 신호이기도 하다(계획 결정 6의 수명 표 9행).
 */
export const useInboundReceiptLines = (
  inboundReceiptId: number | null,
): UseQueryResult<IrLineView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: irKeys.lines(inboundReceiptId),
    enabled: inboundReceiptId !== null,
    queryFn: () => {
      if (inboundReceiptId === null) {
        throw new Error('입하 전표를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      return fetchInboundReceiptLines(client, inboundReceiptId);
    },
  });
};
