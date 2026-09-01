import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { emergencyWorkOrderKeys } from './queries';
import type { WorkOrderListResponse } from './types';
import { EMERGENCY_WORK_ORDER_TYPE_CODE, isEmergencyTypeCodeKnown } from './work-order-type';

/**
 * 한 번에 되찾아 볼 최대 건수.
 *
 * ⚠ **잘렸다는 사실을 화면이 말해야 한다.** 응답의 전체 건수가 이 수보다 크면 보이는 목록은
 * 답의 일부인데, 말하지 않으면 **「이게 전부」로 읽는다** — 배포 안 된 지시가 더 남아 있는데
 * 다 처리했다고 믿는다. 그 안내를 붙이는 것은 목록을 그리는 자리의 몫이고 여기서는 건수만 정한다.
 *
 * 이 목록은 「밀린 것을 치우는」 자리라 길 이유가 없다 — 길면 그 자체가 이상 신호다.
 */
export const UNRELEASED_SIZE = 20;

/**
 * **만들어졌지만 아직 배포되지 않은 긴급 W/O.** 화면에 들어올 때 한 번 부른다.
 *
 * ⭐ **서버가 정본이라 화면을 떠나도 잃지 않는다.** 발행과 배포는 두 호출이고 그 사이는 한
 * 트랜잭션이 아니어서, 발행이 성공하고 배포가 실패하면 **배포되지 않은 지시가 남는다.**
 * 종전에는 그 번호를 컴포넌트가 들고 있어 창을 떠나면 사라졌다 — 아무 데도 남지 않는
 * 유령 지시가 됐다. 이제 서버에 물어 되찾으므로 새로고침해도, 다른 단말에서도, 다른
 * 사용자에게도 보인다(omf-mes#258 회신).
 *
 * ⛔ **화면에 저장소를 두지 않는다.** 스펙에 없는 저장을 화면이 발명하면 그 사용자의 그
 * 브라우저에만 남아, 옆자리 사람은 같은 지시를 또 만든다.
 *
 * ⛔ **배포 여부는 「배포 시각이 있느냐」로 가른다** — 상태 코드 문자열을 몰라도 판정된다.
 * ⛔ **응답을 화면이 걸러서는 성립하지 않는다** — 목록이 페이지 단위라 페이지 «안에서만»
 * 걸러진다. 조건을 서버에 실어야 한다.
 *
 * ⚠ **빈 목록이 정상이다.** 밀린 것이 없다는 뜻이므로, 그릴 때 「없습니다」를 세우지 않는다.
 */
export const useUnreleasedEmergencyWorkOrders = (): UseQueryResult<WorkOrderListResponse> => {
  const { client } = useApiClient();
  /*
   * ⛔ **유형 값을 모르면 아예 묻지 않는다.** 빈 값으로 물으면 조건이 사라져 **긴급이 아닌
   * 지시까지** 돌아오고, 화면은 그것들에 [배포 재시도]를 내준다 — 남의 양산 지시를 이 화면이
   * 배포하게 된다. 조건이 성립하지 않을 때는 조회하지 않는 것이 맞다.
   */
  const isKnown = isEmergencyTypeCodeKnown();

  return useQuery({
    queryKey: emergencyWorkOrderKeys.unreleased(),
    enabled: isKnown,
    queryFn: () => {
      if (!isKnown) throw new Error('긴급 유형 값을 모르는 채로는 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/production/work-orders', {
          params: {
            query: {
              workOrderTypeCode: EMERGENCY_WORK_ORDER_TYPE_CODE,
              released: false,
              size: UNRELEASED_SIZE,
            },
          },
        }),
      );
    },
  });
};
