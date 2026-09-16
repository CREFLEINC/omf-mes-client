import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { terminalPrinters } from '../../patterns/pop-terminal-printers';
import { runRequest } from '../../patterns/request';
import {
  DOCUMENT_TYPE_CODE,
  LOCATION_PAGE_SIZE,
  REISSUE_REASON_GROUP_CODE,
  TARGET_TYPE_CODE,
  type CodeValue,
  type DocumentIssueSummary,
  type Location,
  type Printer,
  type Warehouse,
} from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을
 * 참조하지 않는다.
 */
export const popLocationLabelKeys = {
  all: ['pop-location-label'] as const,
  warehouses: ['pop-location-label', 'warehouses'] as const,
  locations: (warehouseId: number, page: number) =>
    ['pop-location-label', 'locations', warehouseId, page] as const,
  printers: ['pop-location-label', 'printers'] as const,
  reissueReasons: ['pop-location-label', 'reissue-reasons'] as const,
  /** 발행 요약 전체 — 발행 뒤 이 앞자리로 한 번에 무효화한다. */
  summaries: ['pop-location-label', 'summary'] as const,
  summary: (targetIds: readonly number[]) =>
    ['pop-location-label', 'summary', [...targetIds].sort((a, b) => a - b).join(',')] as const,
};

/**
 * 창고 목록.
 *
 * ⚠ **사용 중지된 창고는 받지 않는다.** 라벨은 지금 선반에 붙이러 가는 것이라, 쓰지 않는 창고를
 * 고를 자리는 없다. 위치 쪽과 판단이 갈리는 점은 아래 `useLocations` 가 적는다.
 */
export const useWarehouses = (): UseQueryResult<Warehouse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: popLocationLabelKeys.warehouses,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { includeInactive: false } } }),
      );

      return data.items;
    },
  });
};

/** 위치 목록 한 쪽과 서버가 말한 총 건수. */
export interface LocationPage {
  items: Location[];
  /** 서버가 말한 전체 건수. 쪽 넘김 컨트롤이 이 값으로 끝을 안다. */
  total: number;
}

/**
 * 고른 창고의 위치 목록.
 *
 * ⭐ **사용 중지된 위치도 받는다**(`includeInactive: true`). 백엔드 전달 규격이 「위치 자격
 *    조건은 없다 — 존재하는 위치면 바로 발행된다(사용 중지된 위치 포함)」이다. 선반은 쓰지
 *    않기로 해도 **물리적으로 그 자리에 남아 있고**, 표지는 그대로 붙어 있어야 한다.
 *
 * ⛔ **전건을 한 번에 모으지 않는다.** 관리웹 `W-06-07` 은 계층 편집이라 부모·자식이 모두
 *    있어야 해서 모든 쪽을 모으지만, 이 화면은 **골라서 찍는 것**이라 목록을 쪽으로 넘긴다 —
 *    창고 하나에 수천 칸이 있는 곳에서 전건을 당기면 단말이 멎는다.
 */
export const useLocations = (
  warehouseId: number | null,
  page: number,
): UseQueryResult<LocationPage> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: popLocationLabelKeys.locations(warehouseId ?? 0, page),
    enabled: warehouseId !== null,
    queryFn: async () => {
      if (warehouseId === null) {
        throw new Error('창고를 고르기 전에는 위치를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/locations', {
          params: {
            query: { warehouseId, includeInactive: true, page, size: LOCATION_PAGE_SIZE },
          },
        }),
      );

      return { items: data.items, total: data.page?.total ?? data.items.length };
    },
  });
};

/**
 * 이 단말이 쓸 수 있는 프린터.
 *
 * ⭐ **셸이 답할 수 있으면 단말에 실제로 붙은 프린터를 먼저 쓴다** — 서버 목록은 계약 예시
 *    이름을 낼 수 있어, 화면과 실물이 어긋나면 「눌렀는데 딴 데서 나온다」를 가릴 수 없다.
 *    브라우저에서는 통로가 없어 `null` 이 오고, 그때 서버 목록을 쓴다.
 *
 * ⚠ **0건도 정상 응답이다.** 그때는 그 사실을 보이고 **발행은 막지 않는다** — 발행 기록과 물리
 *    인쇄는 다른 걸음이고, 기록은 프린터가 없어도 남는다.
 */
export const usePrinters = (): UseQueryResult<Printer[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: popLocationLabelKeys.printers,
    queryFn: async () => {
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

/** 재발행 사유 한 쪽. 값이 이보다 많아지는 그룹이 아니다. */
const REISSUE_REASON_PAGE_SIZE = 100;

/**
 * 재발행 사유 값 목록.
 *
 * ⛔ **값을 하드코딩하지 않는다.** 고객이 늘리는 공통코드 그룹이라 환경마다 다르고, 빈 목록이
 *    네트워크 오류를 뜻하지도 않는다.
 */
export const useReissueReasons = (enabled: boolean): UseQueryResult<CodeValue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: popLocationLabelKeys.reissueReasons,
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: REISSUE_REASON_GROUP_CODE,
              page: 1,
              size: REISSUE_REASON_PAGE_SIZE,
            },
          },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 고른 위치들의 발행 이력.
 *
 * ⭐ **회차를 화면이 세지 않는다.** 「이것이 재발행인가」는 서버가 아는 사실이고, 화면은 그것을
 *    **묻는다.** 세면 서버와 어긋나는 순간 사유 없이 보내 422 를 받거나, 필요 없는 사유를 받아
 *    첫 발행 기록에 거짓 사유가 남는다.
 *
 * ⭐ **422 를 기다리지 않고 미리 묻는 이유** — 발행은 한 트랜잭션이라 사유가 빠지면 **전건이
 *    실패**한다. 실패를 보고 사유를 받아 다시 보내면 사용자는 같은 일을 두 번 한다.
 */
export const useIssueSummary = (
  targetIds: readonly number[],
  enabled: boolean,
): UseQueryResult<DocumentIssueSummary[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: popLocationLabelKeys.summary(targetIds),
    enabled: enabled && targetIds.length > 0,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/app/document-issues/summary', {
          params: {
            query: {
              targetTypeCode: TARGET_TYPE_CODE,
              targetIds: [...targetIds],
              documentTypeCode: DOCUMENT_TYPE_CODE,
            },
          },
        }),
      );

      return data.items;
    },
  });
};
