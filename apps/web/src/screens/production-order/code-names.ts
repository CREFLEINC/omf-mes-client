import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
import { runRequest } from '../../patterns/request';

/**
 * 이 화면이 보이는 코드값의 표시명 — 공통코드 마스터에서 받는다(공유계약 G-32).
 *
 * ⛔ 이름을 화면에 박지 않는다. 계약이 값 목록을 각 그룹의 code-values 로 받으라고 적어 두었다.
 * 사용 중지된 코드로 만든 기록도 남아 있으므로 사용 중지 코드까지 받는다.
 * 이름을 못 찾으면 코드를 그대로 돌려준다 — 「알 수 없음」으로 가리면 정보가 준다.
 */
export const PRODUCTION_ORDER_CODE_GROUPS = {
  productionOrderStatus: 'PRODUCTION_ORDER_STATUS',
  productionPlanStatus: 'PRODUCTION_PLAN_STATUS',
  workOrderStatus: 'WORK_ORDER_STATUS',
  workOrderType: 'WORK_ORDER_TYPE',
} as const;

type CodeGroupKey = keyof typeof PRODUCTION_ORDER_CODE_GROUPS;

export type CodeNameOf = (code: string) => string;
export type ProductionOrderCodeNames = Record<CodeGroupKey, CodeNameOf>;

const CODE_PAGE_SIZE = 100;
const EMPTY_NAMES = new Map<string, string>();

const useCodeNameOf = (groupCode: string): CodeNameOf => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['production-order-code-names', groupCode] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: { codeGroupCode: groupCode, includeInactive: true, size: CODE_PAGE_SIZE },
          },
        }),
      );

      return new Map(data.items.map((value) => [value.code, masterName(value, value.codeName)]));
    },
  });
  const names = query.data ?? EMPTY_NAMES;

  return (code) => names.get(code) ?? code;
};

export const useProductionOrderCodeNames = (): ProductionOrderCodeNames => ({
  productionOrderStatus: useCodeNameOf(PRODUCTION_ORDER_CODE_GROUPS.productionOrderStatus),
  productionPlanStatus: useCodeNameOf(PRODUCTION_ORDER_CODE_GROUPS.productionPlanStatus),
  workOrderStatus: useCodeNameOf(PRODUCTION_ORDER_CODE_GROUPS.workOrderStatus),
  workOrderType: useCodeNameOf(PRODUCTION_ORDER_CODE_GROUPS.workOrderType),
});
