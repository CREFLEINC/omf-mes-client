import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  DOCUMENT_TYPE_CODES,
  MAX_TARGETS,
  REISSUE_REASON_GROUP_CODE,
  TARGET_TYPE_CODES,
  type HandlingUnit,
  type HandlingUnitContent,
} from './types';
import type { CodeValue, DocumentIssueSummary, PackingContentRow, Printer } from './types';

/** 사유 선택지는 한 화면에 다 보여야 한다 — 쪽을 넘기게 두지 않는다. */
const REASON_PAGE_SIZE = 100;

/**
 * 이 화면이 쓰는 조회와 캐시 키. 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을
 * 참조하지 않는다.
 */
export const reprintKeys = {
  all: ['packing-label-reprint'] as const,
  handlingUnit: (handlingUnitId: number) =>
    ['packing-label-reprint', 'handling-unit', handlingUnitId] as const,
  lot: (lotId: number) => ['packing-label-reprint', 'lot', lotId] as const,
  item: (itemId: number) => ['packing-label-reprint', 'item', itemId] as const,
  uoms: ['packing-label-reprint', 'uoms'] as const,
  printers: ['packing-label-reprint', 'printers'] as const,
  /** 대상 집합이 곧 열쇠다 — 줄이 늘거나 줄면 회차를 다시 받아야 한다 */
  summary: (targetIds: readonly number[]) =>
    ['packing-label-reprint', 'issue-summary', targetIds.join(',')] as const,
  reissueReasons: ['packing-label-reprint', 'reissue-reasons'] as const,
};

export interface HandlingUnitView {
  handlingUnit: HandlingUnit;
  contents: HandlingUnitContent[];
}

/**
 * 진입한 포장 단위와 그 내용물 — 좌단 《포장 단위》의 전부.
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
    queryKey: reprintKeys.handlingUnit(handlingUnitId ?? 0),
    enabled: handlingUnitId !== null,
    queryFn: async (): Promise<HandlingUnitView> => {
      if (handlingUnitId === null) {
        throw new Error('포장 단위를 모르면 조회하지 않습니다.');
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

/**
 * 내용물 줄에 붙일 이름들 — LOT 번호 · 품목 코드 · 단위.
 *
 * ⚠ **내용물은 내부 번호만 나른다**(`lotId`·`itemId`·`uomId` — 계약 실측). 포장 작업자에게
 * 「90101 · 2001 · 100」은 아무 뜻도 아니라, 이름을 풀지 않으면 좌단이 성립하지 않는다.
 *
 * ⚠ **줄마다 부르는 것을 여기서는 감수한다.** 다른 라벨 화면이 줄별 상세 조회를 물린 것은
 * 대상이 수백 건(개체)이기 때문이고, 포장 하나의 «품목·LOT 조합»은 계약이 유일 제약으로
 * 묶어 둔 소수다(`HandlingUnitContent` 주석). 그래도 목록 축이 생기면 이 훅 하나가 바뀐다.
 *
 * ⛔ **이름을 못 받았을 때 번호를 대신 찍지 않는다.** 「LOT 90101」은 현장에 없는 번호라
 * 사용자가 그것을 LOT 번호로 읽는다 — 모르면 모른다고 둔다(`null`).
 */
export interface ContentRowsResult {
  rows: PackingContentRow[];
  /** 이름 조회 중 하나라도 실패했다. 값이 비는 사유를 화면이 말해야 한다 */
  isNameError: boolean;
  isNameLoading: boolean;
}

export const useContentRows = (contents: readonly HandlingUnitContent[]): ContentRowsResult => {
  const { client } = useApiClient();

  const lotIds = distinct(contents.map((content) => content.lotId));
  const itemIds = distinct(contents.map((content) => content.itemId));

  const lots = useQueries({
    queries: lotIds.map((lotId) => ({
      queryKey: reprintKeys.lot(lotId),
      queryFn: () =>
        runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } })),
    })),
  });

  const items = useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: reprintKeys.item(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });

  /*
   * 단위는 **한 번에 받는다** — 기준정보이고 줄마다 다르지 않다. 미사용 단위를 참조하는
   * 과거 포장이 와도 이름이 비지 않도록 사용 여부로 좁히지 않는다(전례 `disposal-issue`).
   */
  const uoms = useQuery({
    queryKey: reprintKeys.uoms,
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
    isNameLoading:
      lots.some((result) => result.isPending) ||
      items.some((result) => result.isPending) ||
      (contents.length > 0 && uoms.isPending),
  };
};

/**
 * 이 단말이 쓸 수 있는 프린터 — 화면 머리에 상시 보인다(스펙 §3).
 *
 * ⚠ **단말을 주지 않는다** — 계약이 「주지 않으면 요청 단말 기준」이라 못박았다.
 * 거르는 축은 포장 라벨이다 — 이 화면의 두 출력물이 같은 프린터에서 나온다.
 */
export const usePrinters = (): UseQueryResult<Printer[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: reprintKeys.printers,
    queryFn: async (): Promise<Printer[]> => {
      const data = await runRequest(() =>
        client.GET('/app/printers', {
          params: { query: { documentTypeCode: DOCUMENT_TYPE_CODES.packingLabel } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 대상별 발행 회차 — **한 번에 받는다**(스펙 §6 · 계약).
 *
 * ⛔ **줄마다 부르지 않는다.** 계약이 이 경로를 「목록 화면이 행마다 이미 발행됐는가를 판정하는
 * 입력」으로 두었고, 건별 조회로는 목록을 그릴 수 없다고 못박았다.
 *
 * ⚠ **한 번에 한 유형만 묻는다** — 유형이 섞이면 `targetId` 의 뜻이 갈린다(계약). 이 화면에서
 * 고를 수 있는 것은 LOT 줄뿐이라 그 축으로만 부른다. 인식표 줄의 회차는 받지 않고 「모른다」로
 * 둔다 — 대상 id 자체가 없어 물을 수가 없다.
 */
export const useIssueSummary = (
  targetIds: readonly number[],
): UseQueryResult<DocumentIssueSummary[]> => {
  const { client } = useApiClient();

  const ids = [...new Set(targetIds)].sort((a, b) => a - b);

  return useQuery({
    queryKey: reprintKeys.summary(ids),
    enabled: ids.length > 0 && ids.length <= MAX_TARGETS,
    queryFn: async (): Promise<DocumentIssueSummary[]> => {
      const data = await runRequest(() =>
        client.GET('/app/document-issues/summary', {
          params: {
            query: {
              targetTypeCode: TARGET_TYPE_CODES.lot,
              targetIds: ids,
              documentTypeCode: DOCUMENT_TYPE_CODES.packingLabel,
            },
          },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 재발행 사유 선택지.
 *
 * ⛔ **채번 식별자(`codeGroupId`)를 박지 않는다** — 환경마다 다르다(계약 명시). 이름으로 가리키는
 * 것이 화면이 그룹을 안정적으로 지목할 수 있는 유일한 수단이다.
 *
 * ⛔ **목록이 비어도 칸을 감추지 않는다**(공유계약 G-2). 비었으면 비활성 + 사유로 둔다 — 감추면
 * 재출력이 왜 안 되는지 알 수 없다.
 */
export const useReissueReasons = (): UseQueryResult<CodeValue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: reprintKeys.reissueReasons,
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
