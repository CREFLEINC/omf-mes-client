import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  PLACEHOLDER_DOCUMENT_TYPE_CODE,
  PLACEHOLDER_LINE_TARGET_TYPE_CODE,
  type DocumentIssueSummary,
  type GoodsIssue,
  type GoodsIssueLine,
  type Printer,
} from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */
export const goodsIssueQrKeys = {
  all: ['goods-issue-qr'] as const,
  issue: (goodsIssueId: number) => ['goods-issue-qr', 'issue', goodsIssueId] as const,
  lines: (goodsIssueId: number) => ['goods-issue-qr', 'lines', goodsIssueId] as const,
  /** 발행 요약 전체 — 발행 뒤 이 앞자리로 한 번에 무효화한다. */
  summaries: ['goods-issue-qr', 'summary'] as const,
  summary: (targetIds: readonly number[]) =>
    ['goods-issue-qr', 'summary', targetIds.join(',')] as const,
  printers: ['goods-issue-qr', 'printers'] as const,
};

/**
 * 출고 전표 머리 — 화면 헤더가 전표 번호를 보인다.
 *
 * ⚠ **상세 응답에 라인도 함께 들어 있지만 그것을 쓰지 않는다.** 라인의 출처는 아래 전용
 * 경로다(요구서가 「라인 선택·전체 선택」에 그 경로를 지정했다) — 같은 값을 두 곳에서 읽으면
 * 나중에 한쪽만 바뀌었을 때 화면이 어느 쪽을 믿는지 알 수 없게 된다.
 */
export const useGoodsIssue = (goodsIssueId: number | null): UseQueryResult<GoodsIssue> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: goodsIssueQrKeys.issue(goodsIssueId ?? 0),
    enabled: goodsIssueId !== null,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/goods-issues/{goodsIssueId}', {
          params: { path: { goodsIssueId: goodsIssueId as number } },
        }),
      );

      return data.goodsIssue;
    },
  });
};

/**
 * 출고 라인 목록.
 *
 * ⚠ **페이지 축이 없다** — 계약이 이 경로에 `page`·`size` 를 두지 않았다(전표 한 장의 라인
 * 전건을 돌려준다). 그래서 이 화면에는 목록 페이지 이동 컨트롤이 서지 않는다.
 */
export const useGoodsIssueLines = (
  goodsIssueId: number | null,
): UseQueryResult<GoodsIssueLine[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: goodsIssueQrKeys.lines(goodsIssueId ?? 0),
    enabled: goodsIssueId !== null,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/goods-issues/{goodsIssueId}/lines', {
          params: { path: { goodsIssueId: goodsIssueId as number } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 대상별 발행 요약 — 행마다 「미발행 / 발행됨 N회」를 판정하는 입력이다.
 *
 * ⭐ **한 번에 묻는다.** 계약이 이 배치 경로를 둔 이유가 그것이다 — 라인마다 이력을 따로
 * 물으면 목록을 그리기 전에 라인 수만큼 요청이 나간다.
 *
 * ⚠ **발행한 적 없는 대상도 `issueCount: 0` 으로 돌아온다.** 그래서 응답에 없는 라인은
 * 「발행 안 함」이 아니라 **「모른다」**이고, 화면은 둘을 다르게 말한다.
 */
export const useDocumentIssueSummary = (
  targetIds: readonly number[],
): UseQueryResult<DocumentIssueSummary[]> => {
  const { client } = useApiClient();
  const sorted = [...targetIds].sort((left, right) => left - right);

  return useQuery({
    queryKey: goodsIssueQrKeys.summary(sorted),
    enabled: sorted.length > 0,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/app/document-issues/summary', {
          params: {
            query: {
              targetTypeCode: PLACEHOLDER_LINE_TARGET_TYPE_CODE,
              targetIds: sorted,
              documentTypeCode: PLACEHOLDER_DOCUMENT_TYPE_CODE,
            },
          },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 이 단말이 쓸 수 있는 프린터와 그 상태. **화면 머리에 상시 보인다** — 인쇄가 안 될 때
 * 사용자가 가장 먼저 보는 자리다(스펙 §5-5).
 *
 * ⚠ **0건도 정상 응답이다.** 그때는 「등록된 프린터가 없습니다」를 보이고 발행은 막지 않는다 —
 * 발행 기록과 물리 인쇄는 다른 걸음이고, 기록은 프린터가 없어도 남는다.
 */
export const usePrinters = (): UseQueryResult<Printer[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: goodsIssueQrKeys.printers,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/app/printers', {
          params: { query: { documentTypeCode: PLACEHOLDER_DOCUMENT_TYPE_CODE } },
        }),
      );

      return data.items;
    },
  });
};
