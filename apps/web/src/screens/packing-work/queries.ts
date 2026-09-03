import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { HANDLING_UNIT_TYPE_GROUP, type CodeValue, type HandlingUnit, type Lot } from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을
 * 참조하지 않는다.
 */
export const packingWorkKeys = {
  all: ['packing-work'] as const,
  lots: (workOrderId: number) => ['packing-work', 'lots', workOrderId] as const,
  unitTypes: ['packing-work', 'unit-types'] as const,
  parents: ['packing-work', 'parents'] as const,
};

/** 한 코드 그룹에서 받아 올 값 수의 상한. */
const CODE_VALUES_PAGE_SIZE = 200;

/** 상위 포장 후보로 받아 올 취급 단위 수의 상한. */
const PARENT_PAGE_SIZE = 100;

/**
 * 좌단 《포장 대상》 — 이 작업지시의 **완료된** 생산LOT.
 *
 * ⭐ **완료 축으로 좁힌다**(스펙 §0 「포장 작업자가 … 포장한다」 · §4-B). 미완료 LOT 은
 * 포장 대상이 아니다 — 인식표(`P-02-05`)가 생산 «중»에 붙는 것과 반대다.
 *
 * ⚠ **미달로 마감된 LOT 도 함께 온다.** 실물이 있으므로 포장 대상이다(스펙 §6). 화면이
 * 다시 거르지 않는다.
 *
 * ⛔ **「잔여」를 채우지 못한다.** 이미 포장된 수량을 뺀 잔여를 내리는 필드가 계약에 없다
 * (설계 회신 대기). `initialQty` 를 잔여로 쓰면 두 번 포장한 LOT 이 아직 다 남은 것처럼
 * 보인다 — 그래서 최초 수량임을 밝혀 그대로 보이고, 잔여 열은 세우지 않는다.
 */
export const useTargetLots = (workOrderId: number | null): UseQueryResult<Lot[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: packingWorkKeys.lots(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: async (): Promise<Lot[]> => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 포장 대상을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: { query: { workOrderId, completed: true } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 포장 유형 선택지 — **서버가 내려주는 값을 그대로 쓴다**(공유계약 G-2 · G-32).
 *
 * ⛔ **자리표시 상수를 두지 않는다.** 착수 통지 §4 와 스펙 §8-1 은 「값 목록 미확정」으로
 * 적었지만 계약이 조회 경로로 닫았다 — 그 뒤로도 상수를 들고 있으면 서버에 없는 값을
 * 사용자가 고른 것으로 기록에 남는다.
 */
export const useHandlingUnitTypes = (): UseQueryResult<CodeValue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: packingWorkKeys.unitTypes,
    queryFn: async (): Promise<CodeValue[]> => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: HANDLING_UNIT_TYPE_GROUP,
              /*
               * ⛔ **쪽 번호를 보내지 않는다.** 첫 쪽만 쓰는 조회라 보낼 이유가 없고,
               * 서버·목이 번호를 세는 기준(0 부터냐 1 부터냐)이 갈리면 보낸 쪽이 빈 목록을
               * 받는다 — 실측으로 목에서 그렇게 됐다. 기본값을 그대로 쓴다.
               */
              size: CODE_VALUES_PAGE_SIZE,
            },
          },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 상위 포장 후보 — 박스를 얹을 팔레트(스펙 §5-3).
 *
 * ⚠ **이 화면의 주 흐름은 박스 만들기다.** 팔레트 적재가 여기 소관인지는 미결이라
 * (스펙 §8-3) 선택 UI 만 두고 기본은 「없음」이다.
 */
export const useParentHandlingUnits = (): UseQueryResult<HandlingUnit[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: packingWorkKeys.parents,
    queryFn: async (): Promise<HandlingUnit[]> => {
      const data = await runRequest(() =>
        client.GET('/inventory/handling-units', {
          /* 쪽 번호를 보내지 않는다 — 위 「포장 유형」과 같은 이유다. */
          params: { query: { size: PARENT_PAGE_SIZE } },
        }),
      );

      return data.items;
    },
  });
};
