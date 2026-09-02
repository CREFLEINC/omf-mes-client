import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 자재LOT 상태의 **표시명**을 받아 온다.
 *
 * 계약이 `Lot.statusCode` 설명에 **조회 경로를 못박아 두었다** — 값 집합이 데이터에 있고
 * 화면은 그것을 받아 쓴다(공유계약 G-2). 그래서 `NORMAL`·`DEFECTIVE` 같은 원문 코드를
 * 그대로 낼 이유가 없다.
 *
 * ⚠ **표시와 판정은 다른 문제다.** 투입 가부는 여전히 서버가 정하고(스펙 §5-2) 이 조회는
 * 어느 판단에도 쓰이지 않는다 — **읽을 수 있게 하는 데만** 쓴다. 이 구분이 흐려지면
 * 「상태가 이러이러하니 막는다」가 화면에 굳는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 */

type Client = ApiClient['client'];

/** 계약이 이 값의 코드 그룹을 이 이름으로 적는다. 화면이 지어낸 값이 아니다. */
const LOT_STATUS_GROUP = 'LOT_STATUS';

export const lotStatusKeys = {
  labels: ['material-input-scan', 'lot-status-labels'] as const,
};

const fetchLotStatusLabels = async (client: Client): Promise<Map<string, string>> => {
  const data = await runRequest(() =>
    client.GET('/mdm/code-values', {
      params: { query: { codeGroupCode: LOT_STATUS_GROUP, includeInactive: true } },
    }),
  );

  /*
   * **비활성 값도 함께 받는다.** 지난 자료가 그 값을 가리킬 수 있고, 선택지를 만드는 조회가
   * 아니라 **이름을 푸는 조회**라 좁히면 옛 값이 「알 수 없음」으로 보인다.
   */
  return new Map(
    data.items
      .filter((item) => item.codeName.trim() !== '')
      .map((item) => [item.code, item.codeName]),
  );
};

export interface LotStatusLabels {
  /**
   * 코드를 사람이 읽는 말로 옮긴다.
   *
   * **모르면 원문 코드를 그대로 돌려준다.** 「알 수 없음」으로 덮으면 담당자에게 전할 단서가
   * 사라진다 — 옮기지 못한 것과 값이 없는 것은 다르다.
   */
  describe: (code: string) => string;
  /** 이름을 풀지 못한 상태인가. 화면이 그 사실을 밝힐 때 쓴다. */
  isUnavailable: boolean;
}

export const useLotStatusLabels = (): LotStatusLabels => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lotStatusKeys.labels,
    queryFn: () => fetchLotStatusLabels(client),
  });

  const labels = query.data;

  return {
    describe: (code) => labels?.get(code) ?? code,
    /*
     * 실패했을 때만 밝힌다. **불러오는 중은 밝히지 않는다** — 곧 이름이 서므로, 그 찰나에
     * 「이름을 못 불러왔습니다」를 내면 아무 조치도 필요 없는 안내가 깜빡인다.
     */
    isUnavailable: query.isError,
  };
};
