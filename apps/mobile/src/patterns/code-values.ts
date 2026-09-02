import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

export interface CodeValue {
  code: string;
  name: string;
}

export const codeValueKeys = {
  group: (group: string) => ['code-values', group] as const,
};

/**
 * 이 그룹의 값 목록.
 *
 * 화면이 값을 지어내지 않는다 - 지어낸 값은 서버가 받지 않고, 그 실패는 등록을 누른 뒤에야
 * 드러난다.
 */
export const useCodeValues = (group: string): UseQueryResult<CodeValue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: codeValueKeys.group(group),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', { params: { query: { codeGroupCode: group } } }),
      );

      /*
       * 쓰지 않는 값을 새 입력의 선택지로 내지 않는다. 표시 순서는 마스터가 정한 것을 따른다.
       */
      return data.items
        .filter((value) => value.isActive)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((value) => ({ code: value.code, name: value.nameKo ?? value.codeName }));
    },
  });
};
