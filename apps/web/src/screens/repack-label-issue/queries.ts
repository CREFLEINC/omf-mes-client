import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  DOCUMENT_TYPE_CODE,
  REISSUE_REASON_GROUP_CODE,
  TARGET_TYPE_CODE,
  type CodeValue,
  type DocumentIssue,
  type HandlingUnit,
  type HandlingUnitContent,
  type IssueStanding,
  type PackingContentRow,
  type Printer,
} from './types';

/** 사유 선택지는 한 화면에 다 보여야 한다 — 쪽을 넘기게 두지 않는다. */
const REASON_PAGE_SIZE = 100;

/** 발행 이력은 회차가 쌓인 그대로 받는다. 한 포장의 회차가 이 수를 넘는 일은 없다. */
const HISTORY_PAGE_SIZE = 50;

/**
 * 이 화면이 쓰는 조회와 캐시 키. 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을
 * 참조하지 않는다.
 */
export const repackLabelKeys = {
  all: ['repack-label-issue'] as const,
  handlingUnit: (handlingUnitId: number) =>
    ['repack-label-issue', 'handling-unit', handlingUnitId] as const,
  lot: (lotId: number) => ['repack-label-issue', 'lot', lotId] as const,
  item: (itemId: number) => ['repack-label-issue', 'item', itemId] as const,
  uoms: ['repack-label-issue', 'uoms'] as const,
  printers: ['repack-label-issue', 'printers'] as const,
  standing: (handlingUnitId: number) =>
    ['repack-label-issue', 'issue-standing', handlingUnitId] as const,
  history: (handlingUnitId: number) =>
    ['repack-label-issue', 'issue-history', handlingUnitId] as const,
  reissueReasons: ['repack-label-issue', 'reissue-reasons'] as const,
};

export interface HandlingUnitView {
  handlingUnit: HandlingUnit;
  contents: HandlingUnitContent[];
}

/**
 * 대상 포장과 그 내용물.
 *
 * ⭐ **상세 한 번이 둘을 함께 내린다**(`HandlingUnitDetailResponse`). 내용물 전용 경로
 * (`…/contents`)를 따로 부르지 않는다 — 같은 값을 두 번 받게 되고, 두 응답 사이에 포장이
 * 바뀌면 머리와 몸이 어긋난 화면이 선다.
 */
export const useHandlingUnit = (
  handlingUnitId: number | null,
): UseQueryResult<HandlingUnitView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repackLabelKeys.handlingUnit(handlingUnitId ?? 0),
    enabled: handlingUnitId !== null,
    queryFn: async (): Promise<HandlingUnitView> => {
      if (handlingUnitId === null) {
        throw new Error('대상 포장을 모르면 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/inventory/handling-units/{handlingUnitId}', {
          params: { path: { handlingUnitId } },
        }),
      );

      return { handlingUnit: data.handlingUnit, contents: data.contents };
    },
  });
};

const distinct = (values: readonly number[]): number[] => [...new Set(values)];

export interface ContentRowsResult {
  rows: PackingContentRow[];
  /** 이름 조회 중 하나라도 실패했다. 값이 비는 사유를 화면이 말해야 한다 */
  isNameError: boolean;
}

/**
 * 내용물 줄에 붙일 이름들 — LOT 번호 · 품목 코드 · 단위.
 *
 * ⚠ **내용물은 내부 번호만 나른다**(`lotId`·`itemId`·`uomId`). 작업자에게 「90101 · 2001」은
 * 아무 뜻도 아니라, 이름을 풀지 않으면 대상 구획이 성립하지 않는다.
 *
 * ⛔ **이름을 못 받았을 때 번호를 대신 찍지 않는다.** 「LOT 90101」은 현장에 없는 번호라
 * 사용자가 그것을 LOT 번호로 읽는다 — 모르면 모른다고 둔다(`null`).
 */
export const useContentRows = (contents: readonly HandlingUnitContent[]): ContentRowsResult => {
  const { client } = useApiClient();

  const lotIds = distinct(contents.map((content) => content.lotId));
  const itemIds = distinct(contents.map((content) => content.itemId));

  const lots = useQueries({
    queries: lotIds.map((lotId) => ({
      queryKey: repackLabelKeys.lot(lotId),
      queryFn: () =>
        runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } })),
    })),
  });

  const items = useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: repackLabelKeys.item(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });

  /* 단위는 **한 번에 받는다** — 기준정보이고 줄마다 다르지 않다. */
  const uoms = useQuery({
    queryKey: repackLabelKeys.uoms,
    enabled: contents.length > 0,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  const lotNoOf = new Map(
    lots.flatMap((result) =>
      result.data === undefined ? [] : [[result.data.lot.lotId, result.data.lot.lotNo] as const],
    ),
  );
  const itemCodeOf = new Map(
    items.flatMap((result) =>
      result.data === undefined
        ? []
        : [[result.data.item.itemId, result.data.item.itemCode] as const],
    ),
  );
  const uomCodeOf = new Map(
    (uoms.data?.items ?? []).map((uom) => [uom.uomId, uom.uomCode] as const),
  );

  return {
    rows: contents.map((content) => ({
      handlingUnitContentId: content.handlingUnitContentId,
      lotId: content.lotId,
      itemId: content.itemId,
      qty: content.qty,
      lotNo: lotNoOf.get(content.lotId) ?? null,
      itemCode: itemCodeOf.get(content.itemId) ?? null,
      uomCode: uomCodeOf.get(content.uomId) ?? null,
    })),
    isNameError:
      lots.some((result) => result.isError) ||
      items.some((result) => result.isError) ||
      uoms.isError,
  };
};

/**
 * 이 포장의 발행 현황 — **사유 칸을 요구할 것인가**를 정하는 유일한 입력.
 *
 * ⛔ **회차를 화면이 세지 않는다**(계약 「서버가 매긴다」). 여기서 받는 것은 「지금까지 몇 번
 * 발행됐는가」이고, 이번이 몇 회차가 될지는 서버가 정한다.
 *
 * ⚠ **대상 유형은 포장 단위 하나뿐이다** — 계약이 「한 번에 한 유형만 묻는다」로 못박았고,
 * 이 화면의 대상은 언제나 포장이다(스펙 §4-B).
 */
export const useIssueStanding = (handlingUnitId: number | null): UseQueryResult<IssueStanding> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repackLabelKeys.standing(handlingUnitId ?? 0),
    enabled: handlingUnitId !== null,
    queryFn: async (): Promise<IssueStanding> => {
      if (handlingUnitId === null) {
        throw new Error('대상 포장을 모르면 발행 현황을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/app/document-issues/summary', {
          params: {
            query: {
              targetTypeCode: TARGET_TYPE_CODE,
              targetIds: [handlingUnitId],
              documentTypeCode: DOCUMENT_TYPE_CODE,
            },
          },
        }),
      );

      const row = data.items.find((item) => item.targetId === handlingUnitId);

      /*
       * ⭐ **행이 없으면 「발행한 적 없음」이다.** 계약이 「발행한 적 없는 대상도 issueCount: 0
       * 으로 함께 돌려준다」고 적었으므로 빠진 행은 0 으로 읽는다 — 「모른다」로 두면 조회가
       * 성공했는데도 사유 판정을 못 한다.
       */
      return {
        issueCount: row?.issueCount ?? 0,
        lastIssuedAt: row?.lastIssuedAt ?? null,
        lastPrintOutcome: row?.lastPrintOutcome ?? null,
      };
    },
  });
};

/**
 * 발행 이력 — 회차별로 쌓인 그대로(K-1 · 스펙 §5-6 「발행 이력 보기」).
 *
 * ⚠ **`targetTypeCode` 와 `targetId` 를 함께 준다** — 하나만 주면 400 이다(계약).
 */
export const useIssueHistory = (handlingUnitId: number | null): UseQueryResult<DocumentIssue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repackLabelKeys.history(handlingUnitId ?? 0),
    enabled: handlingUnitId !== null,
    queryFn: async (): Promise<DocumentIssue[]> => {
      if (handlingUnitId === null) {
        throw new Error('대상 포장을 모르면 발행 이력을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/app/document-issues', {
          params: {
            query: {
              targetTypeCode: TARGET_TYPE_CODE,
              targetId: handlingUnitId,
              documentTypeCode: DOCUMENT_TYPE_CODE,
              page: 1,
              size: HISTORY_PAGE_SIZE,
            },
          },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 이 단말이 쓸 수 있는 프린터.
 *
 * ⚠ **단말을 주지 않는다** — 계약이 「주지 않으면 요청 단말 기준」이라 못박았다.
 *
 * ⚠ **비어 올 수 있다**(착수 이슈 §6 — 단말 마스터에 프린터 축이 아직 없다). 빈 상태를 그리고
 * 감추지 않는다.
 */
export const usePrinters = (): UseQueryResult<Printer[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repackLabelKeys.printers,
    queryFn: async (): Promise<Printer[]> => {
      const data = await runRequest(() =>
        client.GET('/app/printers', {
          params: { query: { documentTypeCode: DOCUMENT_TYPE_CODE } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 재발행 사유 선택지.
 *
 * ⛔ **채번 식별자(`codeGroupId`)를 박지 않는다** — 환경마다 다르다(계약 명시).
 *
 * ⛔ **목록이 비어도 칸을 감추지 않는다**(공유계약 G-2). 비었으면 비활성 + 사유로 둔다.
 */
export const useReissueReasons = (): UseQueryResult<CodeValue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repackLabelKeys.reissueReasons,
    queryFn: async (): Promise<CodeValue[]> => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: REISSUE_REASON_GROUP_CODE,
              page: 1,
              size: REASON_PAGE_SIZE,
            },
          },
        }),
      );

      return data.items;
    },
  });
};
