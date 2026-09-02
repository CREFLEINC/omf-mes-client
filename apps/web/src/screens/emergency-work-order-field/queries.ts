import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { WorkOrderListResponse } from './types';
import { isEmergencyTypeCodeKnown } from './work-order-type';

/** 이 화면이 소유하는 캐시 키. 다른 화면 슬라이스의 키 모듈을 참조하지 않는다. */
export const emergencyWorkOrderFieldKeys = {
  all: ['emergency-work-order-field'] as const,
  list: (typeCode: string) => ['emergency-work-order-field', 'list', typeCode] as const,
};

/** 한 번에 되찾아 볼 최대 건수. 현장에서 한 화면에 담기는 만큼만 본다. */
export const LIST_SIZE = 20;

/**
 * 진행할 수 있는 긴급 W/O 목록.
 *
 * ⛔ **유형 축만으로는 완료·마감된 긴급 W/O 까지 실린다** — 상태 축(`open`)을 함께 건다.
 * `open` 은 「배포됐고 아직 완료·마감·취소되지 않은 것」이라, 상태 코드 문자열을 몰라도
 * 판정된다(설계 근거: 요구서 §3-20).
 *
 * ⛔ **응답을 화면이 걸러서는 성립하지 않는다** — 목록이 페이지 단위라 페이지 «안에서만»
 * 걸러진다. 두 조건 모두 서버에 싣는다.
 *
 * ⛔ **자동 갱신을 두지 않는다**(L-6). 갱신은 사람이 새로고침할 때만 일어난다.
 */
export const useEmergencyWorkOrders = (typeCode: string): UseQueryResult<WorkOrderListResponse> => {
  const { client } = useApiClient();
  /*
   * ⛔ **유형 값을 모르면 아예 묻지 않는다.** 빈 값으로 물으면 조건이 사라져 양산·재작업
   * 지시까지 돌아오고, 화면은 그것들을 긴급으로 보인 뒤 현장 화면으로 넘긴다.
   */
  const isKnown = isEmergencyTypeCodeKnown(typeCode);

  return useQuery({
    queryKey: emergencyWorkOrderFieldKeys.list(typeCode),
    enabled: isKnown,
    queryFn: () => {
      if (!isKnown) throw new Error('긴급 유형 값을 모르는 채로는 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/production/work-orders', {
          params: { query: { workOrderTypeCode: typeCode, open: true, size: LIST_SIZE } },
        }),
      );
    },
  });
};
