import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 상태 필터의 선택지 — **고객의 공통코드 마스터에서 받는다.**
 *
 * ⛔ **상태 값 목록을 화면에 박지 않는다**(G-8). 우리가 다섯 개를 지어 넣으면, 마스터에
 * 여섯 번째가 늘어난 날 그 상태의 W/O 는 **어느 조건으로도 걸러 볼 수 없게 된다** — 그런데
 * 화면은 멀쩡해 보인다. 값 목록의 정본은 서버다.
 *
 * ⚠ **그룹코드가 계약에 적혀 있지 않다.** 다른 상태 그룹은 계약이 이름을 밝혀 두었지만
 * (`EQUIPMENT_STATUS`·`LOT_STATUS`) W/O 상태는 그 자리가 비어 있어, 같은 짓기 규칙을 따라
 * 이름을 세웠다. **틀렸으면 선택지가 비어 온다** — 그때 화면은 필터를 지우지 않고 **끄고
 * 이유를 적는다**(G-1·G-2). 조용히 사라지면 「원래 없는 기능」으로 읽히고, 값이 채워지는
 * 날에도 아무도 눈치채지 못한다. 확인 요청: omf-mes#272
 */
export const WORK_ORDER_STATUS_GROUP_CODE = 'WORK_ORDER_STATUS';

/** 한 번에 받아 둘 최대 건수. 상태 값이 이보다 많을 일은 없다. */
export const STATUS_OPTION_SIZE = 100;

export interface StatusOptions {
  /** 고를 수 있는 상태. 값은 계약의 `statusCode` 로 그대로 나간다. */
  options: { value: string; label: string }[];
  /** 코드값에서 표시명을 찾는다. 목록·상세의 상태 열이 함께 쓴다. */
  labelOf: (code: string | undefined) => string;
  isPending: boolean;
  isError: boolean;
  /**
   * 선택지를 세울 수 없는가 — 조회가 실패했거나, 값이 하나도 오지 않았거나.
   *
   * ⛔ 두 경우를 **하나로 묶는 것이 맞다.** 사용자가 할 수 있는 일이 같기 때문이다(상태로는
   * 못 거른다). 원인별로 다른 문구를 내면 「서버 오류」·「그룹 없음」 같은, 사용자가 손댈 수
   * 없는 사정을 읽게 된다.
   */
  isUnavailable: boolean;
}

/**
 * 상태 코드값을 받는다.
 *
 * ⛔ **받지 못했을 때 코드 값을 표시명 대신 쓰지 않는다.** `SYN_RUN` 은 사용자가 쓰는 말이
 * 아니다 — 모르면 코드를 그대로 두되, 그것이 표시명인 척하지 않도록 목록 쪽에서 판단한다.
 * 여기서는 **찾은 것만** 이름으로 바꾸고 나머지는 받은 코드를 돌려준다. 상태 코드는 품목
 * 식별자와 달리 **그 자체가 사람이 읽을 수 있는 말**이라 숨기면 오히려 정보가 준다.
 */
export const useWorkOrderStatusOptions = (): StatusOptions => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['work-order-progress', 'status-options'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: WORK_ORDER_STATUS_GROUP_CODE,
              /* 쓰지 않게 된 상태로 만들어 둔 W/O 가 남아 있다 — 그것도 걸러 볼 수 있어야 한다. */
              includeInactive: true,
              size: STATUS_OPTION_SIZE,
            },
          },
        }),
      );

      return (
        [...data.items]
          /* 마스터가 정한 순서를 그대로 따른다 — 화면이 다시 줄 세우면 마스터와 어긋난다. */
          .sort((left, right) => left.displayOrder - right.displayOrder)
          /* 표시명은 다국어 컬럼이 먼저, 기본 이름이 fallback(G-33). 로케일 스위치 전이라 한국어만 본다. */
          .map((value) => ({
            value: value.code,
            label: (value.nameKo ?? '').trim() || value.codeName,
          }))
      );
    },
  });

  const options = query.data ?? [];
  const byCode = new Map(options.map((option) => [option.value, option.label]));

  return {
    options,
    labelOf: (code) => (code === undefined ? '' : (byCode.get(code) ?? code)),
    isPending: query.isPending,
    isError: query.isError,
    isUnavailable: !query.isPending && options.length === 0,
  };
};
