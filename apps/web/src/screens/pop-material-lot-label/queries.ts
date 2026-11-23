import type { ApiClient, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { shellSelectsPrinter, terminalPrinters } from '../../patterns/pop-terminal-printers';
import { runRequest } from '../../patterns/request';
import { REISSUE_REASON_CODE_GROUP } from './codes';
import { toPrinterView, type PrinterView } from './types';
import { withoutSystemReissueReasons } from '../../patterns/reissue-reasons';

/**
 * 이 화면의 읽기(005 · omf-all-around#254).
 *
 * | 무엇 | 경로 |
 * | --- | --- |
 * | 왼쪽 공급사·품목 · 탭 넷 · 번호 찾기 | `patterns/material-lot-precreate`(피처 014 — 서버 쪽 · 찾기, 20초 다시 받기 없음) |
 * | 보내기 직전 확인 | `GET /logistics/waiting-material-lots`(계약 §1) — `mutations.verifyCommands` 만 |
 * | 프린터 · 재발행 사유 | 지금 그대로 |
 *
 * ⭐ 옛 「라벨 대기 입하 줄」(`GET /logistics/inbound-receipt-lines` · 입하 건 → 줄 모으기)은 없앴다(FR-036 ·
 *    D-19). 라벨은 입하 전 대기 자재 관리 LOT 에 찍는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

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

      /* 서버만 쓰는 사유(`LOT_SPLIT`)는 사람이 고르지 않는다(피처 013). */
      return withoutSystemReissueReasons(
        data.items.map((item) => ({ code: item.code, name: item.codeName })),
      );
    },
  });
};
