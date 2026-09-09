import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { terminalPrinters } from '../../patterns/pop-terminal-printers';
import { runRequest } from '../../patterns/request';
import {
  DOCUMENT_TYPE_CODE,
  type DocumentIssueSummary,
  type GoodsIssue,
  type GoodsIssueLine,
  type HandlingUnit,
  type HandlingUnitContent,
  type IssueTargetTypeCode,
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
  summary: (targetTypeCode: IssueTargetTypeCode, targetIds: readonly number[]) =>
    ['goods-issue-qr', 'summary', targetTypeCode, targetIds.join(',')] as const,
  handlingUnits: (lotId: number) => ['goods-issue-qr', 'handling-units', lotId] as const,
  handlingUnitContents: (handlingUnitId: number) =>
    ['goods-issue-qr', 'handling-unit-contents', handlingUnitId] as const,
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
  targetTypeCode: IssueTargetTypeCode,
  targetIds: readonly number[],
): UseQueryResult<DocumentIssueSummary[]> => {
  const { client } = useApiClient();
  const sorted = [...targetIds].sort((left, right) => left - right);

  return useQuery({
    queryKey: goodsIssueQrKeys.summary(targetTypeCode, sorted),
    enabled: sorted.length > 0,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/app/document-issues/summary', {
          params: {
            query: {
              targetTypeCode,
              targetIds: sorted,
              documentTypeCode: DOCUMENT_TYPE_CODE,
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
      /*
       * ⭐ **셸이 답할 수 있으면 단말에 실제로 붙은 프린터를 먼저 쓴다**(사용자 지시
       *    2026-09-08 · `patterns/pop-terminal-printers`). 서버 경로가 아직 구현되지 않아
       *    계약 예시 이름이 화면에 뜨고, 프린터가 없는 단말이 「대기 중」이라 말했다.
       *    브라우저에서는 통로가 없어 `null` 이 오고, 그때는 아래 서버 목록을 그대로 쓴다.
       */
      const local = await terminalPrinters();

      if (local !== null) return local;

      const data = await runRequest(() =>
        client.GET('/app/printers', {
          params: { query: { documentTypeCode: DOCUMENT_TYPE_CODE } },
        }),
      );

      return data.items;
    },
  });
};

/** 파렛트 대상 목록의 한 쪽. 한 라인의 LOT 이 실린 취급 단위가 이 수를 넘는 일은 없다. */
const HANDLING_UNIT_PAGE_SIZE = 100;

/**
 * 파렛트 목록 한 쪽과 **서버가 말한 총 건수.**
 *
 * ⛔ **총계를 버리지 않는다.** 한 쪽에 담기지 않으면 고르려던 파렛트가 목록에 없는데, 총계가
 * 없으면 화면은 그 사실조차 말할 수 없다 — 사용자는 「이 라인에는 파렛트가 이것뿐」이라고
 * 읽고 잘못 고른다. 발행은 되돌릴 수 없는 쓰기다.
 */
export interface HandlingUnitPage {
  items: HandlingUnit[];
  /** 서버가 말한 전체 건수. `items.length` 보다 크면 목록이 잘렸다. */
  total: number;
}

/**
 * 파렛트 단위의 대상 목록 — **이 출고 라인의 LOT 이 실린 취급 단위만**(스펙 §5-2 · 2026-09-06).
 *
 * ⛔ **창고 전체를 부르지 않는다.** 축 없이 부르면 이 출고와 상관없는 파렛트가 목록에 서고,
 * 발행은 되돌릴 수 없는 쓰기라 잘못 고른 것이 그대로 이력에 남는다.
 *
 * ⛔ **취급 단위를 이 화면이 만들지 않는다** — 만드는 것은 `M-01-08` 이고 여기는 조회만 한다.
 */
export const useLineHandlingUnits = (lotId: number | null): UseQueryResult<HandlingUnitPage> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: goodsIssueQrKeys.handlingUnits(lotId ?? 0),
    enabled: lotId !== null,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/inventory/handling-units', {
          params: { query: { lotId: lotId as number, size: HANDLING_UNIT_PAGE_SIZE } },
        }),
      );

      return { items: data.items, total: data.page.total };
    },
  });
};

/**
 * 고른 파렛트에 실제로 무엇이 담겼는가.
 *
 * ⭐ **고른 한 건만 묻는다.** 목록 줄마다 물으면 파렛트 수만큼 요청이 나가고, 화면이 보여야
 * 하는 것은 「지금 찍을 이 파렛트에 무엇이 들었나」 하나다(스펙 §3 — 「3라인 · 820 EA」).
 *
 * ⚠ **0건이면 찍을 것이 없다**(스펙 §6). 목록이 LOT 축으로 좁혀져 오므로 보통은 생기지 않지만,
 * 고른 뒤에 내용물이 빠질 수 있어 발행 직전에 다시 본다.
 */
export const useHandlingUnitContents = (
  handlingUnitId: number | null,
): UseQueryResult<HandlingUnitContent[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: goodsIssueQrKeys.handlingUnitContents(handlingUnitId ?? 0),
    enabled: handlingUnitId !== null,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/inventory/handling-units/{handlingUnitId}/contents', {
          params: { path: { handlingUnitId: handlingUnitId as number } },
        }),
      );

      return data.items;
    },
  });
};
