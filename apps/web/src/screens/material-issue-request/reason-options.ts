import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { EMPTY_ENTRIES, type LookupResult } from './lookups';

/**
 * 요청 사유의 값 목록 — **고객의 공통코드 마스터에서 받는다.**
 *
 * ⭐ **선택기는 항상 활성이다.** 이 그룹은 값이 이미 확정된 고객 마스터(G-31)라, 「값 미확정 →
 * 비활성」(G-2) 패턴을 여기 적용하면 틀린다. 코드값이 0건으로 와도 잠그지 않는다 — 사유 없이
 * **비고만으로도 발행할 수 있기 때문이다**(스펙 §5-6 의 「또는」).
 *
 * ⚠ **값 문면을 보지 않는다.** 이 슬라이스 어디에도 사유 코드 리터럴을 두지 않는다 — 거르지도,
 * 특정 값을 알아보지도, 마스터가 정한 차례를 바꾸지도 않는다.
 *
 * ⛔ **두 걸음으로 부르지 않는다.** 계약이 `codeGroupCode` 를 직접 받으므로(실측) 코드그룹을
 * 먼저 조회해 번호를 얻을 필요가 없다. `codeGroupId` 와 **둘 중 정확히 하나**만 보낸다 —
 * 둘 다 보내거나 둘 다 빠지면 400 이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export const MATERIAL_ISSUE_REQUEST_REASON_GROUP_CODE = 'MATERIAL_ISSUE_REQUEST_REASON';

/** 한 번에 받아 둘 최대 건수. 사유 값이 이보다 많을 일은 없다. */
export const REASON_OPTION_SIZE = 100;

export const reasonLookupKeys = {
  reasons: ['material-issue-request-lookups', 'reasons'] as const,
};

export const useReasonOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: reasonLookupKeys.reasons,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: MATERIAL_ISSUE_REQUEST_REASON_GROUP_CODE,
              /* 지금 고를 수 있는 사유만 낸다 — 쓰지 않게 된 사유를 새로 고르게 두지 않는다. */
              includeInactive: false,
              size: REASON_OPTION_SIZE,
            },
          },
        }),
      );

      return (
        [...data.items]
          /* 마스터가 정한 차례를 그대로 따른다 — 화면이 다시 줄 세우면 마스터와 어긋난다. */
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((item) => ({ value: item.code, label: item.codeName, isActive: item.isActive }))
      );
    },
  });

  return {
    entries: query.data ?? EMPTY_ENTRIES,
    /* 한 쪽에 다 담기는 목록이라 잘림을 말할 자리가 없다. */
    truncated: false,
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};
