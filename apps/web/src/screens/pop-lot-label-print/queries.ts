import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  DOCUMENT_TARGET_TYPE_CODE,
  DOCUMENT_TYPE_CODE,
  LOT_TYPE_CODE,
  REISSUE_REASON_CODE_GROUP,
} from './codes';
import {
  MAX_SUMMARY_TARGETS,
  toIssueCountByLotId,
  type DocumentIssueSummary,
  type Item,
  type Lot,
  type Printer,
} from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * **이 화면이 소유한다** — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 */
export const lotLabelKeys = {
  all: ['pop-lot-label-print'] as const,
  lots: (workOrderId: number) => ['pop-lot-label-print', 'lots', workOrderId] as const,
  /** 발행 현황은 발행 뒤 다시 세야 한다 — 앞자리를 갈라 두어 목록과 따로 무효화한다. */
  summaries: (lotIds: readonly number[]) =>
    ['pop-lot-label-print', 'issue-summary', lotIds] as const,
  printers: ['pop-lot-label-print', 'printers'] as const,
  lotDetail: (lotId: number) => ['pop-lot-label-print', 'lot-detail', lotId] as const,
  item: (itemId: number) => ['pop-lot-label-print', 'item', itemId] as const,
  reissueReasons: ['pop-lot-label-print', 'reissue-reasons'] as const,
};

/**
 * 좌단 《완료 LOT》 — 이 작업지시가 원천인 **완료된 생산 LOT**.
 *
 * ⭐ **완료 여부를 `completed` 질의로 좁힌다.** 계약이 이 축을 세우면서 「LOT 라벨 출력
 * (`P-02-07` §4-B)의 완료 LOT 목록이 이 축으로 선다」고 근거에 적어 두었다. 상태 코드 문자열을
 * 몰라도 판정된다 — 완료 시각이 있고 없고로 갈리기 때문이다.
 *
 * ⛔ **`statusCode`(품질 판정 축)로 완료를 고르지 않는다.** 계약이 「이 축으로는 완료·폐번을
 * 고를 수 없다」고 못박았다.
 *
 * ⛔ **응답을 화면이 걸러 만들지 않는다.** 목록이 쪽 단위라(공유계약 L-11) 받아서 거르면 한
 * 쪽에 보이는 줄 수가 쪽 크기와 어긋난다. 거르는 자리는 서버다.
 *
 * ⚠ **미달 마감 LOT 도 함께 온다 — 그것이 맞다.** 미달도 실물이 있으므로 라벨이 필요하다
 * (스펙 §5-4). 목록에서 미달을 «구분해 표시»하는 것만 아직 못 한다(`types.ts` 의 `LotRow`).
 */
export const useCompletedLots = (workOrderId: number | null): UseQueryResult<Lot[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotLabelKeys.lots(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: async (): Promise<Lot[]> => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 완료 LOT 을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: {
            query: { workOrderId, lotTypeCode: LOT_TYPE_CODE, completed: true },
          },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 목록의 발행 이력 회차 — **대상 다건을 한 번에 묻는다.**
 *
 * 「어느 LOT 이 아직 안 찍혔는지, 몇 번 찍혔는지」가 현장의 관심사라 목록에 보여야 하는데
 * (스펙 §3), 행마다 발행 기록을 조회하면 줄 수만큼 요청이 늘어난다. 계약이 그 자리를 위해
 * 이 경로를 두었다 — 발행한 적 없는 대상도 `issueCount: 0` 으로 함께 돌려준다.
 *
 * ⭐ **`documentTypeCode` 를 준다.** 한 LOT 에 라벨과 성적서가 따로 붙을 수 있어, 주지 않으면
 * 다른 출력물의 회차까지 함께 세어진다. 이 값은 확정된 enum 이라(`codes.ts`) 서버가 모르는
 * 코드로 걸러 빈 응답이 오는 위험이 없다.
 *
 * ⚠ **상한이 있다.** 대상이 `MAX_SUMMARY_TARGETS` 를 넘으면 서버가 400 이므로 잘라 보낸다 —
 * 잘린 뒤 줄의 회차는 「모른다」로 남고, 화면은 그것을 미출력으로 그리지 않는다.
 */
export const useIssueSummaries = (
  lotIds: readonly number[],
): UseQueryResult<DocumentIssueSummary[]> => {
  const { client } = useApiClient();
  const targetIds = lotIds.slice(0, MAX_SUMMARY_TARGETS);

  return useQuery({
    queryKey: lotLabelKeys.summaries(targetIds),
    enabled: targetIds.length > 0,
    queryFn: async (): Promise<DocumentIssueSummary[]> => {
      const data = await runRequest(() =>
        client.GET('/app/document-issues/summary', {
          params: {
            query: {
              targetTypeCode: DOCUMENT_TARGET_TYPE_CODE,
              targetIds,
              documentTypeCode: DOCUMENT_TYPE_CODE,
            },
          },
        }),
      );

      return data.items;
    },
  });
};

/** 목록 줄에 실을 회차를 꺼낸다. 조회가 끝나지 않았거나 실패했으면 `null` — 「모른다」다. */
export const toIssueCounts = (
  summaries: DocumentIssueSummary[] | undefined,
): Map<number, number> | null => (summaries === undefined ? null : toIssueCountByLotId(summaries));

/**
 * 이 단말이 쓸 수 있는 프린터 — 화면 머리에 상시 보인다(스펙 §3 · K-3).
 *
 * ⚠ **단말을 주지 않는다** — 계약이 「주지 않으면 요청 단말 기준」이라 못박았고, 이 화면은
 * 단말 번호를 셸에서 받기 전이라도 프린터 상태를 보여야 한다.
 *
 * ⚠ **비어 올 수 있고 그것은 정상 응답이다**(스펙 §6). 오류로 다루지 않고 빈 상태로 그린다 —
 * 「없음」과 「확인하지 못함」은 사용자가 할 일이 다르다.
 */
export const usePrinters = (): UseQueryResult<Printer[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotLabelKeys.printers,
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
 * 고른 LOT 의 상세 — **우단 패널의 「양품」·「상태」는 여기서만 온다.**
 *
 * ⭐ `withProgress` 를 켠다. 켜지 않으면 `progress` 가 비어 오는데, 그때는 **양품 수를 모르는
 * 것**이지 0 인 것이 아니다.
 *
 * ⭐ **서버가 계산해 내린다**(공유계약 L-2). 화면이 실적을 모아 더하면 완료 화면(`P-02-06`)과
 * 이 화면의 값이 갈린다.
 *
 * ⚠ 목록은 이것을 줄마다 부르지 않는다 — 설계가 정한 방식이 아니고, 줄 수만큼 요청이 는다.
 */
export const useLotDetail = (lotId: number | null): UseQueryResult<Lot> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotLabelKeys.lotDetail(lotId ?? 0),
    enabled: lotId !== null,
    queryFn: async (): Promise<Lot> => {
      if (lotId === null) throw new Error('LOT 을 고르지 않으면 상세를 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/trace/lots/{lotId}', {
          params: { path: { lotId }, query: { withProgress: true } },
        }),
      );

      return data.lot;
    },
  });
};

/**
 * 품목 코드 — 우단 머리의 「품목 ABC-123」.
 *
 * `Lot` 에는 `itemId` 만 실린다. 화면이 코드를 보여야 하는 이유는 하나다 — **라벨에 인쇄된
 * 품목과 눈으로 대조**하는 자리이기 때문이다.
 */
export const useItem = (itemId: number | null): UseQueryResult<Item> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotLabelKeys.item(itemId ?? 0),
    enabled: itemId !== null,
    queryFn: async (): Promise<Item> => {
      if (itemId === null) throw new Error('품목을 모르면 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
      );

      return data.item;
    },
  });
};

/** 재발행 사유 한 가지. 표시 문구는 **서버가 준 이름을 그대로** 쓴다. */
export interface ReissueReasonOption {
  code: string;
  name: string;
}

/**
 * 재발행 사유 선택지.
 *
 * ⛔ **화면이 값을 지어내지 않는다.** 값 목록은 서버가 코드 그룹으로 내려 준다(계약 명시).
 * ⛔ **채번 식별자(`codeGroupId`)를 하드코딩하지 않는다** — 환경마다 다르다.
 *
 * ⚠ **비어 올 수 있다.** 그때는 재출력을 열지 않고 사유를 보인다 — 사유 없이 보내면 422 다.
 */
export const useReissueReasons = (enabled: boolean): UseQueryResult<ReissueReasonOption[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotLabelKeys.reissueReasons,
    enabled,
    queryFn: async (): Promise<ReissueReasonOption[]> => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: REISSUE_REASON_CODE_GROUP } },
        }),
      );

      return data.items.map((item) => ({ code: item.code, name: item.codeName }));
    },
  });
};
