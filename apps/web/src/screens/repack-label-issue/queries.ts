import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { terminalPrinters } from '../../patterns/pop-terminal-printers';
import { runRequest } from '../../patterns/request';
import {
  DOCUMENT_TYPE_CODE,
  HANDLING_UNIT_TYPE_GROUP_CODE,
  REISSUE_REASON_GROUP_CODE,
  TARGET_TYPE_CODE,
  type CodeValue,
  type DocumentIssue,
  type HandlingUnit,
  type HandlingUnitContent,
  type HandlingUnitRepackEvent,
  type IssueStanding,
  type PackingContentRow,
  type Printer,
  type RemainderCandidate,
} from './types';

/** 목록을 한 번에 너무 크게 받지 않으면서 전체 계약 건수를 이어 받는 서버 페이지 크기. */
const REASON_PAGE_SIZE = 100;
const HISTORY_PAGE_SIZE = 50;
const PENDING_PAGE_SIZE = 50;

interface PageResult<T> {
  items: T[];
  page: { total: number };
}

/** 페이지 UI가 없는 내부 스크롤 목록은 계약의 total까지 빠짐없이 이어 받는다. */
const readAllPages = async <T>(
  pageSize: number,
  read: (page: number, size: number) => Promise<PageResult<T>>,
): Promise<T[]> => {
  const rows: T[] = [];
  let page = 1;

  while (true) {
    const data = await read(page, pageSize);

    rows.push(...data.items);
    if (rows.length >= data.page.total) return rows;
    if (data.items.length === 0) {
      throw new Error('목록 전체 건수를 받기 전에 빈 페이지가 반환됐습니다.');
    }

    page += 1;
  }
};

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
  handlingUnitTypes: ['repack-label-issue', 'handling-unit-types'] as const,
  remainderCandidates: (handlingUnitId: number) =>
    ['repack-label-issue', 'remainder-candidates', handlingUnitId] as const,
  pendingRows: ['repack-label-issue', 'pending-rows'] as const,
};

export interface HandlingUnitView {
  handlingUnit: HandlingUnit;
  contents: HandlingUnitContent[];
}

/** 같은 식별자를 두 번 세지 않는다. */
const distinct = (values: readonly number[]): number[] => [...new Set(values)];

/**
 * 발행 대기 한 줄 — **재구성 «사건» 한 건이다**(스펙 §3 ① 도면).
 *
 * ⭐ 도면의 열은 「원 포장 · 유형 · 새 포장 · 잔량 · 확정 시각」이다. 새 포장의 «번호»는 이
 * 줄에 없다 — 번호는 아래 ② 발번 구획이 보인다. 이 목록이 답하는 물음은 「무엇을 어떻게
 * 재구성했고 그중 무엇이 아직 라벨을 못 받았는가」다.
 *
 * ⛔ **포장 목록이 아니다.** 한때 `labelIssued=false` 포장을 그대로 줄로 세웠는데, 그러면
 * 분할과 합병을 가를 수 없고(둘 다 「신규 포장」으로 보인다) 잔량이 어느 번호로 남았는지도
 * 알 수 없다 — 분할이면 원 번호가 잔량으로 남고 합병이면 남지 않는다.
 */
export interface PendingRepackRow {
  /** 라벨을 기다리는 신규 포장. 고르는 대상은 이것이다. */
  handlingUnitId: number;
  handlingUnitNo: string;
  /** 재구성 이전의 포장 번호들. 합병이면 여럿이다. `null` 이면 사건을 찾지 못했다. */
  sourceNos: string[];
  repackTypeCode: string | null;
  /** 이 사건이 새로 만든 포장 수. */
  newCount: number;
  /** 원 번호를 그대로 쓰는 잔량 포장. 남지 않으면 `null`. */
  remainderNo: string | null;
  occurredAt: string | null;
  /**
   * 이 포장을 만든 재구성 사건을 찾았는가.
   *
   * ⚠ **못 찾았다는 것이 「포장을 모른다」는 뜻은 아니다**(#1044). 번호는 목록 응답이 늘 싣는다
   * (계약 `HandlingUnit.handlingUnitNo` 필수) — 줄이 그 번호와 «왜 나머지가 비었는지»를
   * 말해야 작업자가 눌러 보기 전에 무엇인지 안다.
   */
  hasRepackEvent: boolean;
}

/**
 * 재구성 사건에서 이 포장이 「새로 생긴 쪽」인 줄을 찾는다.
 *
 * **새로 생긴 것은 `qtyBefore === 0` 인 줄이다** — 재구성 전에 아무것도 담고 있지 않았다는
 * 뜻이고, 그래서 라벨이 없다.
 *
 * ⚠ 여기서도 역할 코드를 보지 않는다(같은 파일의 잔량 판정과 같은 근거) — 한 파일 안에 같은
 *   물음을 두 규칙으로 답하면 다음에 읽는 사람이 어느 쪽이 참인지 고르게 된다.
 */
const newestEventFor = (
  events: readonly HandlingUnitRepackEvent[],
  handlingUnitId: number,
): HandlingUnitRepackEvent | undefined =>
  [...events]
    .filter((event) =>
      event.lines.some((line) => line.handlingUnitId === handlingUnitId && line.qtyBefore === 0),
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

/**
 * 발행 대기 목록 — 포장마다 그 포장을 만든 재구성 사건을 함께 읽는다.
 *
 * ⚠ **호출이 줄 수만큼 는다.** 계약에 「재구성 사건 목록」 경로가 없어 포장별 경로
 * (`…/repack-events`)로만 물을 수 있다. 발행 대기는 몇 건짜리 목록이라 감당한다 — 목록이
 * 커지면 설계에 사건 축 조회를 요청할 자리다.
 *
 * ⛔ **사건을 못 찾아도 줄을 버리지 않는다.** 라벨을 기다리는 포장이라는 사실은 그대로이고,
 * 감추면 작업자가 그 포장에 닿을 길이 사라진다 — 모르는 칸만 비운다. 후보를 좁히는 것은
 * **서버 몫이다**: 계약이 `labelIssued=false` 를 「발행 대기 목록(재구성 신규 라벨 발행 대상)」
 * 으로 정의한다(P-04-04 §5-1 · 2026-09-06 게이트 승인) — 화면이 다시 거르면 서버가 대상이라
 * 답한 포장을 감춘다.
 *
 * ⚠ **다만 모르는 줄이 아무 말도 안 하게 두지 않는다**(#1044). 사건을 못 찾았다는 사실을
 * 줄에 실어, 화면이 번호와 사유를 함께 적을 수 있게 한다.
 */
export const usePendingRepackRows = (): UseQueryResult<PendingRepackRow[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repackLabelKeys.pendingRows,
    queryFn: async (): Promise<PendingRepackRow[]> => {
      const units = await readAllPages<HandlingUnit>(PENDING_PAGE_SIZE, (page, size) =>
        runRequest(() =>
          client.GET('/inventory/handling-units', {
            params: { query: { labelIssued: false, page, size } },
          }),
        ),
      );

      /* 번호를 여러 줄이 함께 쓰므로 한 번 읽어 두고 나눠 쓴다. */
      const numbers = new Map<number, string>(
        units.map((unit) => [unit.handlingUnitId, unit.handlingUnitNo]),
      );

      const numberOf = async (handlingUnitId: number): Promise<string | null> => {
        const known = numbers.get(handlingUnitId);
        if (known !== undefined) return known;

        try {
          const detail = await runRequest(() =>
            client.GET('/inventory/handling-units/{handlingUnitId}', {
              params: { path: { handlingUnitId } },
            }),
          );
          const no = detail.handlingUnit.handlingUnitNo;
          numbers.set(handlingUnitId, no);

          return no;
        } catch {
          /* 번호 하나를 못 읽었다고 목록을 통째로 잃지 않는다 — 그 칸만 비운다. */
          return null;
        }
      };

      const rows: PendingRepackRow[] = [];

      for (const unit of units) {
        const events = await runRequest<{ items: HandlingUnitRepackEvent[] }>(() =>
          client.GET('/inventory/handling-units/{handlingUnitId}/repack-events', {
            params: { path: { handlingUnitId: unit.handlingUnitId } },
          }),
        );
        const event = newestEventFor(events.items, unit.handlingUnitId);

        if (event === undefined) {
          rows.push({
            handlingUnitId: unit.handlingUnitId,
            handlingUnitNo: unit.handlingUnitNo,
            sourceNos: [],
            repackTypeCode: null,
            newCount: 1,
            remainderNo: null,
            occurredAt: null,
            hasRepackEvent: false,
          });
          continue;
        }

        /*
         * ⭐ **역할 코드가 아니라 «수량»이 셋을 가른다.**
         *
         * | 무엇 | 판정 |
         * | --- | --- |
         * | 원 포장 | 재구성 «전»에 이미 담고 있었다 → `qtyBefore > 0` |
         * | 새 포장 | 전에는 비어 있었다 → `qtyBefore === 0` |
         * | 잔량 | 원 포장 중 «쓰고도 남은» 것 → `qtyBefore > 0 && qtyAfter > 0` |
         *
         * ⚠ `roleCode` 로 가르지 않는다 — 서버가 분할의 남는 쪽을 `SOURCE` 로도 `RESULT` 로도
         *   싣는다(씨앗과 감지기 자료가 서로 다르다). 수량은 어느 쪽이든 같은 뜻이다.
         *
         * 분할이면 원 포장에 물건이 남아 그 번호를 잔량으로 그대로 쓰고(도면의 `CTN-…-0091`),
         * 합병이면 원 포장들이 비어 남는 것이 없다(`—`).
         */
        const sourceIds = distinct(
          event.lines.filter((line) => line.qtyBefore > 0).map((line) => line.handlingUnitId),
        );
        const remainderId = event.lines.find(
          (line) => line.qtyBefore > 0 && line.qtyAfter > 0,
        )?.handlingUnitId;
        const newCount = distinct(
          event.lines.filter((line) => line.qtyBefore === 0).map((line) => line.handlingUnitId),
        ).length;

        const sourceNos: string[] = [];
        for (const id of sourceIds) {
          const no = await numberOf(id);
          if (no !== null) sourceNos.push(no);
        }

        rows.push({
          handlingUnitId: unit.handlingUnitId,
          handlingUnitNo: unit.handlingUnitNo,
          sourceNos,
          repackTypeCode: event.repackTypeCode,
          newCount: newCount === 0 ? 1 : newCount,
          remainderNo: remainderId === undefined ? null : await numberOf(remainderId),
          occurredAt: event.occurredAt,
          hasRepackEvent: true,
        });
      }

      return rows;
    },
  });
};

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

      /* 계약은 미발행 대상도 0으로 돌려준다. 행 누락은 최초 발행이 아니라 불완전 응답이다. */
      if (row === undefined) {
        throw new Error('발행 요약에 요청한 포장이 없습니다.');
      }

      return {
        issueCount: row.issueCount,
        lastIssuedAt: row.lastIssuedAt ?? null,
        lastPrintOutcome: row.lastPrintOutcome ?? null,
      };
    },
  });
};

const standingOf = (
  handlingUnitId: number,
  summaries: readonly {
    targetId: number;
    issueCount: number;
    lastIssuedAt?: string | null;
    lastPrintOutcome?: IssueStanding['lastPrintOutcome'];
  }[],
): IssueStanding => {
  const row = summaries.find((summary) => summary.targetId === handlingUnitId);

  return {
    issueCount: row?.issueCount ?? null,
    lastIssuedAt: row?.lastIssuedAt ?? null,
    lastPrintOutcome: row?.lastPrintOutcome ?? null,
  };
};

/**
 * 선택한 신규 포장과 같은 SPLIT 사건에서 **쓰고도 남은** 포장 중 이미 라벨이 있는 것.
 *
 * 그 포장이 바로 원 번호를 유지한 잔량이다. 합병·재구성 사건에는 잔량 선택을 만들지 않고,
 * 발행 이력이 없는 결과는 재출력 대상이 아니므로 제외한다.
 *
 * ⚠ **역할 코드로 가르지 않는다**(2026-09-11). 서버가 분할의 남는 쪽을 `SOURCE` 로도
 *   `RESULT` 로도 싣는다 — 수량이 뜻을 그대로 말한다(앞에 있었고 뒤에도 남았다). 목록 쪽
 *   (`usePendingRepackRows`)과 같은 규칙이다.
 *
 * ⛔ 포장 번호 형태나 상태값을 추측하지 않는다 — 판정에 쓰는 것은 수량과 발행 요약뿐이다.
 */
export const useRemainderCandidates = (
  handlingUnitId: number | null,
): UseQueryResult<RemainderCandidate[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repackLabelKeys.remainderCandidates(handlingUnitId ?? 0),
    enabled: handlingUnitId !== null,
    queryFn: async (): Promise<RemainderCandidate[]> => {
      if (handlingUnitId === null) return [];

      const repacks = await runRequest<{ items: HandlingUnitRepackEvent[] }>(() =>
        client.GET('/inventory/handling-units/{handlingUnitId}/repack-events', {
          params: { path: { handlingUnitId } },
        }),
      );
      /*
       * ⚠ **역할 코드로 가르지 않는다**(실측 2026-09-11). 서버가 분할의 남는 쪽을 `SOURCE` 로
       *   싣기도 하고 `RESULT` 로 싣기도 한다 — `RESULT` 만 보던 앞 판은 씨앗 자료에서 잔량을
       *   하나도 찾지 못해 ③ 구획의 「잔량 라벨 재출력」 줄이 통째로 사라졌다(설계 §3 ③ 도면).
       *
       * 수량이 뜻을 그대로 말한다 — 앞에 있었고(`qtyBefore > 0`) 뒤에도 남았으면(`qtyAfter > 0`)
       * 그것이 잔량이다. 목록 쪽(`usePendingRepackRows`)과 같은 규칙을 쓴다.
       */
      const split = [...repacks.items]
        .filter(
          (event) =>
            event.repackTypeCode === 'SPLIT' &&
            event.lines.some(
              (line) =>
                line.handlingUnitId === handlingUnitId && line.qtyBefore === 0 && line.qtyAfter > 0,
            ),
        )
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

      if (split === undefined) return [];

      const remainderIds = distinct(
        split.lines
          .filter(
            (line) =>
              line.handlingUnitId !== handlingUnitId && line.qtyBefore > 0 && line.qtyAfter > 0,
          )
          .map((line) => line.handlingUnitId),
      );

      if (remainderIds.length === 0) return [];

      const summary = await runRequest(() =>
        client.GET('/app/document-issues/summary', {
          params: {
            query: {
              targetTypeCode: TARGET_TYPE_CODE,
              targetIds: remainderIds,
              documentTypeCode: DOCUMENT_TYPE_CODE,
            },
          },
        }),
      );
      if (
        remainderIds.some(
          (candidateId) => !summary.items.some((item) => item.targetId === candidateId),
        )
      ) {
        throw new Error('잔량 포장의 발행 요약이 완전하지 않습니다.');
      }
      const issuedIds = remainderIds.filter(
        (candidateId) => (standingOf(candidateId, summary.items).issueCount ?? 0) > 0,
      );

      const details = await Promise.all(
        issuedIds.map(async (candidateId) => {
          const data = await runRequest(() =>
            client.GET('/inventory/handling-units/{handlingUnitId}', {
              params: { path: { handlingUnitId: candidateId } },
            }),
          );

          return {
            handlingUnit: data.handlingUnit,
            standing: standingOf(candidateId, summary.items),
          };
        }),
      );

      return details;
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

      return readAllPages(HISTORY_PAGE_SIZE, (page, size) =>
        runRequest(() =>
          client.GET('/app/document-issues', {
            params: {
              query: {
                targetTypeCode: TARGET_TYPE_CODE,
                targetId: handlingUnitId,
                documentTypeCode: DOCUMENT_TYPE_CODE,
                page,
                size,
              },
            },
          }),
        ),
      );
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

/**
 * 포장 유형의 표시명.
 *
 * ⚠ **판정에 쓰지 않는다** — 읽을 수 있게 하는 것까지다. 못 받아도 화면은 그대로 서고 발행도
 * 막지 않는다.
 *
 * ⭐ **미사용 값까지 받는다**(`includeInactive`). 계약의 기본은 «사용 중인 것만»이고(공유계약
 * G-8), 이것은 선택지를 만드는 조회가 아니라 **이름을 푸는 조회**다 — 좁히면 폐기된 유형이
 * 붙은 옛 포장의 칸이 「표시명 없음」으로 떨어진다
 * (전례 `material-input-scan/lot-status-labels.ts`).
 */
export const useHandlingUnitTypes = (): UseQueryResult<CodeValue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repackLabelKeys.handlingUnitTypes,
    queryFn: async (): Promise<CodeValue[]> => {
      return readAllPages(REASON_PAGE_SIZE, (page, size) =>
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: {
              query: {
                codeGroupCode: HANDLING_UNIT_TYPE_GROUP_CODE,
                includeInactive: true,
                page,
                size,
              },
            },
          }),
        ),
      );
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
      return readAllPages(REASON_PAGE_SIZE, (page, size) =>
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: {
              query: {
                codeGroupCode: REISSUE_REASON_GROUP_CODE,
                page,
                size,
              },
            },
          }),
        ),
      );
    },
  });
};
