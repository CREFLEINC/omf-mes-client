import type { ApiClient, SupplierItemDefault, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { shellSelectsPrinter, terminalPrinters } from '../../patterns/pop-terminal-printers';
import { runRequest } from '../../patterns/request';
import { REISSUE_REASON_CODE_GROUP } from './codes';
import { pairKeyOf, toPrinterView, type PrinterView } from './types';

/**
 * 이 화면의 읽기(005 · omf-all-around#254).
 *
 * | 무엇 | 경로 |
 * | --- | --- |
 * | 공급사·품목 목록 · 대기/최근 자재 관리 LOT | `GET /logistics/waiting-material-lots`(계약 §1) — 한 번에 받는다 |
 * | 프린터 · 재발행 사유 | 지금 그대로 |
 *
 * ⭐ 옛 「라벨 대기 입하 줄」(`GET /logistics/inbound-receipt-lines` · 입하 건 → 줄 모으기)은 없앴다(FR-036 ·
 *    D-19). 라벨은 입하 전 대기 자재 관리 LOT 에 찍는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

/**
 * 목록 주기 갱신 간격.
 *
 * ⭐ **이 목록을 바꾸는 것은 이 화면만이 아니다.** 관리웹(W-01-14)에서 만든 LOT 도 여기 대기로 서고, PDA
 *    입하 스캔이 대기 LOT 을 입하됨으로 옮긴다 — 화면이 스스로 다시 받지 않으면 앱을 껐다 켜야 보였다
 *    (omf-all-around#29).
 * ⛔ **조회 화면에 자동 갱신을 두지 않는다는 관례의 예외다**(공유계약 L-6). 그 관례의 근거는 「사용자
 *    수만큼 부하가 곱해진다」인데, POP 단말은 **공장당 몇 대뿐**이다.
 */
export const LIST_REFRESH_MS = 20_000;

/** 다시 인쇄에서 보이는 기간(마지막 발행 기준). 그보다 오래된 라벨은 스캔해도 찾지 못한다고 말한다. */
export const REPRINT_DAYS = 14;

/** 주기 갱신을 걸 것인가 — **발행 중에는 걸지 않는다**(도는 사이 목록이 바뀌면 결과가 줄을 잃는다). */
export const listRefetchInterval = (isBusy: boolean, interval = LIST_REFRESH_MS): number | false =>
  isBusy ? false : interval;

export const waitingKeys = {
  all: ['pop-material-lot-label', 'waiting'] as const,
  plant: (plantId: number) => ['pop-material-lot-label', 'waiting', plantId] as const,
};

/** 공급사·품목별 대기 자재 관리 LOT — 그 공장 전부(계약 §1). */
export const fetchWaitingGroups = async (
  client: Client,
  plantId: number,
): Promise<WaitingMaterialLotGroup[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/waiting-material-lots', { params: { query: { plantId } } }),
  );

  return data.items;
};

export interface WaitingGroupsResult {
  groups: WaitingMaterialLotGroup[];
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  /** 서버에서 마지막으로 받은 시각(ms). 받은 적 없으면 0. */
  updatedAt: number;
  refetch: () => void;
}

const NO_GROUPS: WaitingMaterialLotGroup[] = [];

/**
 * 왼쪽 목록 · 오른쪽 표 · 다시 인쇄가 모두 이 한 조회에서 나온다 — 같은 순간의 값이라 서로 어긋나지 않는다.
 * ⚠ 공장을 모르면(단말 등록 전) 부르지 않는다.
 */
export const useWaitingGroups = (plantId: number | null, isBusy: boolean): WaitingGroupsResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: plantId === null ? waitingKeys.all : waitingKeys.plant(plantId),
    enabled: plantId !== null,
    refetchInterval: listRefetchInterval(isBusy),
    queryFn: () => fetchWaitingGroups(client, plantId ?? 0),
  });

  return {
    groups: query.data ?? NO_GROUPS,
    isPending: plantId === null || query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    updatedAt: query.dataUpdatedAt,
    refetch: () => {
      void query.refetch();
    },
  };
};

/**
 * 이 단말이 쓸 수 있는 프린터와 그 상태.
 *
 * ⛔ **`documentTypeCode`로 거르지 않는다.** 문서 유형 값 목록이 아직 확정되지 않아(착수 이슈
 * 미결 1) 화면이 값을 넣으면 서버가 모르는 코드로 걸러 **목록이 통째로 비어 올 수 있다.**
 * 거르지 않으면 최악이 「쓸 수 없는 프린터도 함께 보인다」이고, 거르면 최악이 「쓸 수 있는
 * 프린터가 없다고 보인다」다 — 뒤쪽이 더 나쁘다.
 *
 * ⚠ **비어 올 수 있다.** 서버가 무엇을 보고 목록을 만드는지가 미결이다(착수 이슈 6항).
 * 빈 목록은 정상 응답이므로 오류로 다루지 않고 빈 상태로 그린다.
 */
export const usePrinters = (): UseQueryResult<PrinterView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['pop-material-lot-label', 'printers'],
    queryFn: async () => {
      /*
       * ⭐ **셸이 답할 수 있으면 단말에 실제로 붙은 프린터를 먼저 쓴다**(사용자 지시
       *    2026-09-08 · `patterns/pop-terminal-printers`). 브라우저에서는 통로가 없어
       *    `null` 이 오고, 그때는 아래 서버 목록을 그대로 쓴다.
       */
      const local = await terminalPrinters();

      if (local !== null) return local.map(toPrinterView);

      const data = await runRequest(() => client.GET('/app/printers', {}));

      return data.items.map(toPrinterView);
    },
  });
};

/** 셸이 고른 프린터로 보낼 수 있는가 — 모르면 `false`(화면은 고르는 칸을 막는다). */
export const useShellSelectsPrinter = (): UseQueryResult<boolean> =>
  useQuery({
    queryKey: ['pop-material-lot-label', 'printer-selectable'],
    queryFn: shellSelectsPrinter,
  });

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
 * ⚠ **비어 올 수 있다.** 값 목록이 아직 확정되지 않은 코드 그룹이라(`omf-mes#145`) 운영
 * 데이터가 비어 있을 수 있고, 그때는 재인쇄를 열지 않고 사유를 보인다 — 사유 없이 보내면 422 다.
 */
export const useReissueReasons = (enabled: boolean): UseQueryResult<ReissueReasonOption[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['pop-material-lot-label', 'reissue-reasons'],
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
 * 공장의 공급사·품목 기본 정보 전부(계약 §9) — 왼쪽 목록의 기본값 한 줄. (공급사, 품목) 열쇠로 찾는다.
 * ⚠ 못 읽으면 줄마다 「기본 정보 없음」으로 읽힐 수 있다 — 그래서 실패를 따로 알린다(`isError`).
 */
export const useSupplierItemDefaults = (plantId: number | null) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['pop-material-lot-label', 'defaults', plantId],
    enabled: plantId !== null,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, SupplierItemDefault>> => {
      const all = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/supplier-item-defaults', {
            params: { query: { plantId: plantId ?? 0, page, size } },
          }),
        ),
      );

      return new Map(all.items.map((row) => [pairKeyOf(row.supplierId, row.itemId), row] as const));
    },
  });
};
