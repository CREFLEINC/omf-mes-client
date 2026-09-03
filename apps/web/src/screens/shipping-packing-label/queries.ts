import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { REISSUE_REASON_CODE_GROUP, targetTypeCodeOf, type LabelKind } from './codes';
import {
  toAllocationView,
  toHandlingUnitView,
  toIssueSummaryView,
  toIssueView,
  toPrinterView,
  toShipmentView,
  type AllocationView,
  type HandlingUnitView,
  type IssueSummaryView,
  type IssueView,
  type PrinterView,
  type ShipmentView,
} from './types';

/**
 * 이 화면의 읽기 — **다섯이다.**
 *
 * | 무엇 | 경로 | 언제 |
 * | --- | --- | --- |
 * | 출하 배분 | `GET /logistics/shipment-lot-allocations?shipmentId=` | 진입 즉시 |
 * | 취급 단위 | `GET /inventory/handling-units/{id}` | 포장 라벨을 고를 때 |
 * | 발행 현황 | `GET /app/document-issues/summary` | 대상 목록이 정해질 때마다 |
 * | 프린터 | `GET /app/printers?documentTypeCode=` | 라벨 종류를 고를 때마다 |
 * | 재발행 사유 | `GET /mdm/code-values?codeGroupCode=REISSUE_REASON` | 재발행 구획이 펼쳐질 때 |
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

const ROOT = 'shipping-packing-label';

export const labelKeys = {
  shipment: (shipmentId: number | null) => [ROOT, 'shipment', shipmentId] as const,
  allocations: (shipmentId: number | null) => [ROOT, 'allocations', shipmentId] as const,
  handlingUnit: (handlingUnitId: number) => [ROOT, 'handling-unit', handlingUnitId] as const,
  summary: (targetTypeCode: string, documentTypeCode: string, targetIds: readonly number[]) =>
    [ROOT, 'summary', targetTypeCode, documentTypeCode, targetIds] as const,
  printers: (documentTypeCode: string) => [ROOT, 'printers', documentTypeCode] as const,
  reissueReasons: [ROOT, 'reissue-reasons'] as const,
  history: (targetTypeCode: string, targetId: number | null) =>
    [ROOT, 'history', targetTypeCode, targetId] as const,
};

export const useShipment = (shipmentId: number | null): UseQueryResult<ShipmentView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: labelKeys.shipment(shipmentId),
    enabled: shipmentId !== null,
    queryFn: async () => {
      if (shipmentId === null) throw new Error('출하 없이 출하 문맥을 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/logistics/shipments/{shipmentId}', {
          params: { path: { shipmentId } },
        }),
      );

      return toShipmentView(data);
    },
  });
};

/**
 * 이 출하의 배분 전부.
 *
 * ⛔ **`oqcPassed` 로 서버에 거르게 하지 않는다.** 계약에 그 질의가 있지만(요구서 §3-17),
 * 스펙 §3 의 목록은 검사 대기 건을 **「⛔ 발행 불가」로 함께 그린다.** 서버에서 걸러 오면
 * 그 줄이 사라져 사용자는 포장이 어디 갔는지 알 수 없다 — 「없다」와 「아직 안 된다」가
 * 같은 모양이 된다(공유계약 G-9).
 *
 * ⚠ **출하가 없으면 부르지 않는다**(`enabled`). 조건 없이 부르면 다른 출하의 배분이 섞여
 * 온다 — 그 라벨은 이 단말이 뽑을 것이 아니다.
 */
export const useAllocations = (shipmentId: number | null): UseQueryResult<AllocationView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: labelKeys.allocations(shipmentId),
    enabled: shipmentId !== null,
    queryFn: async () => {
      if (shipmentId === null) throw new Error('출하 없이 배분을 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/logistics/shipment-lot-allocations', { params: { query: { shipmentId } } }),
      );

      return data.items.map(toAllocationView);
    },
  });
};

const fetchHandlingUnit = async (
  client: Client,
  handlingUnitId: number,
): Promise<HandlingUnitView> => {
  const data = await runRequest(() =>
    client.GET('/inventory/handling-units/{handlingUnitId}', {
      params: { path: { handlingUnitId } },
    }),
  );

  // 상세는 봉투로 온다 — 내용물(`contents`)은 이 화면이 그리지 않는다.
  return toHandlingUnitView(data.handlingUnit);
};

export interface HandlingUnitsResult {
  units: HandlingUnitView[];
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * 이 출하의 취급 단위 — **배분이 가리키는 것들을 건별로 받는다.**
 *
 * ⛔ **`GET /inventory/handling-units` 목록을 쓰지 않는다.** 그 경로의 질의 축은 창고·
 * 로케이션·유형·상태·번호검색뿐이라 **「이 출하의 포장」을 좁힐 수 없다.** 창고로 좁히면 같은
 * 창고의 다른 출하 포장까지 후보가 되고, 그것은 **남의 출하 라벨을 뽑을 수 있다는 뜻**이다.
 *
 * 그래서 배분 응답의 `handlingUnitId` 를 유일하게 만들어 그 수만큼 상세를 부른다. 번호와
 * 상태가 배분 응답에 실려 있지 않아 다른 길이 없다.
 *
 * ⚠ **요청이 포장 수만큼이다.** 한 출하의 포장은 수십 단위라 감당한다 — 배분 응답에 취급
 * 단위 번호가 실리면 이 훅은 통째로 사라진다.
 */
export const useHandlingUnits = (
  allocations: readonly AllocationView[],
  enabled: boolean,
): HandlingUnitsResult => {
  const { client } = useApiClient();

  /*
   * 한 포장에 여러 배분이 담긴다(한 포장 안에 여러 LOT). 유일하게 만들지 않으면 같은 포장을
   * 여러 번 부르고 목록에도 같은 줄이 여러 번 선다.
   */
  const ids = [
    ...new Set(
      allocations.flatMap((allocation) =>
        allocation.handlingUnitId === null ? [] : [allocation.handlingUnitId],
      ),
    ),
  ];

  const results = useQueries({
    queries: ids.map((handlingUnitId) => ({
      queryKey: labelKeys.handlingUnit(handlingUnitId),
      enabled,
      queryFn: () => fetchHandlingUnit(client, handlingUnitId),
    })),
  });

  return {
    units: results.flatMap((result) => (result.data === undefined ? [] : [result.data])),
    isPending: enabled && results.some((result) => result.isPending),
    // 한 건이라도 실패하면 목록이 불완전하다 — 일부만 보이는 것을 「전부」로 내지 않는다.
    isError: results.some((result) => result.isError),
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
};

/**
 * 대상들의 발행 현황 — 목록의 「최근 발행 · 회차」 칸과 재발행 판정의 입력이다.
 *
 * `targetTypeCode`는 고정 OpenAPI enum에 맞춰 납품 라벨은 `LOT`, 포장 라벨은
 * `HANDLING_UNIT`로 `codes.ts`가 한 곳에서 결정한다.
 *
 * ⛔ **대상이 없으면 부르지 않는다.** 빈 배열로 부르면 서버가 400 을 낸다(`targetIds` 필수).
 */
export const useIssueSummaries = (
  kind: LabelKind | null,
  targetIds: readonly number[],
): UseQueryResult<IssueSummaryView[]> => {
  const { client } = useApiClient();
  const targetTypeCode = kind === null ? '' : targetTypeCodeOf(kind);

  return useQuery({
    queryKey: labelKeys.summary(targetTypeCode, kind ?? '', targetIds),
    enabled: kind !== null && targetIds.length > 0,
    queryFn: async () => {
      if (kind === null) throw new Error('라벨 종류 없이 발행 현황을 조회하지 않습니다.');
      const resolvedTargetTypeCode = targetTypeCodeOf(kind);

      const data = await runRequest(() =>
        client.GET('/app/document-issues/summary', {
          params: {
            query: {
              /* 종류가 정해진 뒤에만 여기 온다 — 계약이 닫은 대상 유형 형으로 다시 뽑는다. */
              targetTypeCode: targetTypeCodeOf(kind),
              targetIds: [...targetIds],
              // 한 대상에 라벨과 성적서가 따로 붙을 수 있다 — 이 화면 몫만 센다(계약 명시).
              documentTypeCode: kind,
            },
          },
        }),
      );

      return data.items.map(toIssueSummaryView);
    },
  });
};

/**
 * 이 종류를 찍을 수 있는 프린터.
 *
 * ⭐ **`documentTypeCode` 로 거른다** — 이것이 라벨 종류를 유형 값으로 가른 이유다(스펙 §5-2).
 * 거르지 않으면 **고객에게 나가는 납품 라벨을 창고 포장 프린터로 보낸다.**
 *
 * ⚠ 앞선 화면(`P-01-01`)은 값이 미확정이라 거르지 않았는데, 그 전제는 2026-09-02 에
 * 사라졌다(`enum` 9종 확정 · 변경 통지 #700).
 *
 * ⚠ **비어 올 수 있다.** 서버가 무엇을 보고 목록을 만드는지가 아직 미결이다(스펙 §8-5).
 * 빈 목록은 정상 응답이므로 오류로 다루지 않고 빈 상태로 그린다.
 */
export const usePrinters = (kind: LabelKind | null): UseQueryResult<PrinterView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: labelKeys.printers(kind ?? ''),
    enabled: kind !== null,
    queryFn: async () => {
      if (kind === null) throw new Error('라벨 종류 없이 프린터를 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/app/printers', { params: { query: { documentTypeCode: kind } } }),
      );

      return data.items.map(toPrinterView);
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
 * ⚠ **비어 올 수 있다.** 그때는 재발행을 열지 않고 사유를 보인다(공유계약 G-2) — 사유 없이
 * 보내면 `ck_document_reissue_reason` 이 저장 자체를 막는다.
 */
export const useReissueReasons = (enabled: boolean): UseQueryResult<ReissueReasonOption[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: labelKeys.reissueReasons,
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: REISSUE_REASON_CODE_GROUP } },
        }),
      );

      return data.items.map((item) => ({ code: item.code, name: item.codeName }));
    },
  });
};

/**
 * 한 대상의 발행 이력 — 회차별로 한 행이다.
 *
 * 회차가 오르면 새 행이고 이전 회차는 남는다(계약 명시). 그래서 세로 `Stepper` 로 그린다
 * (스펙 §7) — 「회차로 쌓이는 것」의 세 번째 사용처다.
 *
 * ⚠ `targetTypeCode` 와 `targetId` 는 **함께** 준다 — 하나만 주면 400 이다(계약 명시).
 */
export const useIssueHistory = (
  kind: LabelKind | null,
  targetId: number | null,
): UseQueryResult<IssueView[]> => {
  const { client } = useApiClient();
  const targetTypeCode = kind === null ? '' : targetTypeCodeOf(kind);

  return useQuery({
    queryKey: labelKeys.history(targetTypeCode, targetId),
    enabled: kind !== null && targetId !== null,
    queryFn: async () => {
      if (kind === null || targetId === null)
        throw new Error('대상 없이 이력을 조회하지 않습니다.');
      const resolvedTargetTypeCode = targetTypeCodeOf(kind);

      const data = await runRequest(() =>
        client.GET('/app/document-issues', {
          params: {
            query: { targetTypeCode: targetTypeCodeOf(kind), targetId, documentTypeCode: kind },
          },
        }),
      );

      return data.items.map(toIssueView);
    },
  });
};
