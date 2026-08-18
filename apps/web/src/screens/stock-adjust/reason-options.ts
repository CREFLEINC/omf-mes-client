import type { components } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupResult } from './lookups';
import type { LookupEntry, PageMeta } from './types';

/**
 * 조정 사유 선택지 — **고객이 공통코드 마스터(W-06-06)에 등록하는 마스터 데이터**를
 * 실행 시점에 조회한다(#36 회신 · 공유계약 `G-31` · 스펙 `W-01-12` §8-3).
 *
 * 앞 회차까지 이 자리는 **자리표시(빈 배열)** 였다. 값 목록을 설계가 정해서 내려 줄 것으로
 * 보고 「확정될 때까지 등록이 막힌다」로 두었는데, 결정은 그 반대였다 — **우리가 정할 값이
 * 아니다.** 그래서 자리표시를 걷고 조회로 바꾸며, 그와 함께 걷히는 것이 셋이다.
 *
 * | 걷은 것 | 왜 |
 * | --- | --- |
 * | 「값 목록이 아직 확정되지 않아…」 안내 | ⛔ 그 표시는 **우리가 정해야 하는데 못 한 값**에만 쓴다 |
 * | 사유 미확정에 걸린 등록 잠금 | 목록은 고객의 마스터가 정한다 — 화면이 앞서 막을 근거가 없다 |
 * | 값 목록 상수 | 정본이 서버로 옮겨졌다 |
 *
 * ⚠ **여기서 가장 중요한 규율은 「값 문면을 보지 않는다」다**(#36 회신 ③). 어느 코드가 와도
 * 화면은 같게 돈다 — 값에 동작이 걸릴 값이었다면 설계가 확정해서 내려 주었을 것이다.
 * 그래서 이 파일에는 **사유 코드 문자열과 견주는 자리가 하나도 없다.**
 *
 * ⚠ **조정 상태·문서 유형은 여기 해당하지 않는다** — 그 둘은 전이·분기가 걸려 설계가 정한다.
 * 상태 자리표시는 `code-options.ts`에 그대로 남는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type CodeGroupResponse = components['schemas']['CodeGroup'];

/**
 * 조정 사유 코드 그룹의 **그룹코드**. 이 화면이 열어 볼 그룹을 특정하는 유일한 값이다.
 *
 * ⚠ **이것은 사유 「값」이 아니다.** 금지된 것은 사유 코드에 거는 분기·검증이고, 어느 그룹의
 * 코드값을 보는지를 정하는 열쇠는 조회가 성립하려면 있어야 한다 — 계약이 코드값 조회에
 * `codeGroupId`를 **필수**로 요구한다(계약 실측).
 *
 * **번호(`codeGroupId`)를 쓰지 않는다**(전례 `judgment-group.ts`) — 번호는 자료가 만들어질 때
 * 정해져 환경마다 다르다. 그룹코드로 조회한 뒤 목록에서 정확히 일치하는 것을 고른다.
 */
export const ADJUST_REASON_GROUP_CODE = 'ADJUST_REASON';

/**
 * 조회한 코드그룹 목록에서 조정 사유 그룹을 고른다. 없으면 `null`이다.
 *
 * **정확 일치만 고른다**(전례 `judgment-group.ts`의 세 방어를 그대로 가져온다). 여기서 가장
 * 나쁜 결함은 「엉뚱한 그룹이 열려 다른 업무의 코드값이 조정 사유로 보이는 것」이고, 그 값은
 * **되돌릴 수 없는 전표**에 실린다.
 *
 * - **부분 일치를 쓰지 않는다** — 조회의 `q`가 부분 검색이라 이름이 겹치는 그룹이 함께 온다
 * - **대소문자를 접지 않는다** — 접으면 대소문자만 다른 별개 그룹이 걸린다
 * - **그룹명을 보지 않는다** — 그룹명은 사람이 고쳐 쓰는 표시용 이름이라 판정 근거가 못 된다
 *
 * 못 찾았을 때 **첫 항목으로 대신하지 않는다.** 「없음」은 정상 상태이고, 첫 항목을 쓰면 그
 * 순간부터 화면이 조용히 다른 그룹의 값을 사유로 내민다.
 *
 * 사용 여부는 판정 근거가 아니다 — 꺼진 그룹도 찾아내야 그 사실이 화면에 그대로 드러난다.
 */
export const findAdjustReasonGroup = (
  groups: readonly CodeGroupResponse[],
): CodeGroupResponse | null =>
  groups.find((group) => group.groupCode === ADJUST_REASON_GROUP_CODE) ?? null;

/**
 * 캐시 키. **그룹과 코드값을 가른다** — 한 키에 묶으면 그룹만 다시 받아도 값이 함께 버려진다.
 * 값 키에 그룹 번호를 담는 것은 그룹이 달라지면 값 목록도 갈려야 하기 때문이다.
 */
export const reasonLookupKeys = {
  group: ['stock-adjust-reasons', 'group'] as const,
  values: (codeGroupId: number) => ['stock-adjust-reasons', 'values', codeGroupId] as const,
};

/** 그룹 조회는 첫 쪽만 본다 — 그룹코드로 좁힌 조회라 다음 쪽까지 갈 결과가 나오지 않는다. */
const GROUP_QUERY = { q: ADJUST_REASON_GROUP_CODE, includeInactive: true } as const;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ENTRIES: LookupEntry[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 조정 사유 선택지 — 헤더 사유 칸과 이력 조건 칸이 **같은 목록**을 쓴다(두 번 부르지 않는다).
 *
 * **두 걸음이다.** 그룹코드로 그룹을 찾고, 그 번호로 코드값을 받는다. 계약이 코드값 조회에
 * `codeGroupId`를 필수로 요구해 그룹을 모르면 요청 자체가 성립하지 않는다 — 그래서 그룹을
 * 못 찾으면 **부르지 않는다**(부르면 422가 오고 사용자에게는 「화면이 안 된다」로 보인다).
 *
 * **`includeInactive`를 켜지 않는다.** 다섯 참조(창고·위치·품목·단위·LOT)는 지난 자료의 이름을
 * 풀어야 해서 켜지만, 사유는 **이름을 푸는 자리가 없다** — 이력 표도 상세도 코드를 그대로
 * 그린다. 중지된 사유를 고르게 하면 마스터에서 끈 일이 화면에서 무의미해진다.
 *
 * **「없음」은 실패가 아니다.** 그룹이 없거나 값이 0건인 것은 고객의 마스터가 아직 그렇다는
 * 사실이다 — ⛔ 그 상태에 「목록 준비 중」을 붙이거나 칸을 잠그지 않는다(#36 회신 ④).
 * 화면이 말하는 것은 **불러오지 못했다(실패)** 와 **일부만 받았다(잘림)** 둘뿐이고, 그 문구는
 * 다섯 참조와 같은 자리(`lookupNote`)에서 나온다.
 */
export const useAdjustReasonLookup = (): LookupResult => {
  const { client } = useApiClient();

  const groupQuery = useQuery({
    queryKey: reasonLookupKeys.group,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/code-groups', { params: { query: GROUP_QUERY } })),
  });

  /**
   * **조회에 성공한 상태에서만 값을 갖는다**(전례 W-06-04와 같은 규율). 「받은 자료가 있는가」로
   * 판정하면 재조회가 실패해도 캐시에 남은 지난 목록으로 그룹을 계속 찾아, 본문은 실패인데
   * 값 조회만 살아남는다.
   */
  const groupId = groupQuery.isSuccess
    ? (findAdjustReasonGroup(groupQuery.data.items)?.codeGroupId ?? null)
    : null;

  const valueQuery = useQuery({
    queryKey: reasonLookupKeys.values(groupId ?? 0),
    enabled: groupId !== null,
    queryFn: () => {
      if (groupId === null) {
        throw new Error('조정 사유 코드 그룹을 찾기 전에는 코드값을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/code-values', { params: { query: { codeGroupId: groupId } } }),
      );
    },
  });

  const data = valueQuery.data;

  return {
    /**
     * **값 문면을 보지 않는다**(#36 회신 ③). 거르지도, 차례를 바꾸지도, 특정 값을 알아보지도
     * 않는다 — 받은 것을 그대로 옮긴다. 차례가 뜻일 수 있다(자주 쓰는 것부터 등).
     */
    entries:
      data?.items.map((item) => ({
        value: item.code,
        label: `${item.code} · ${item.codeName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    /* 두 걸음 중 어느 쪽이 실패해도 사용자가 보는 것은 같다 — 고를 수 없다는 사실 하나다. */
    isError: groupQuery.isError || valueQuery.isError,
    /* 그룹을 못 찾은 상태는 **다 받은 상태**다 — 기다림으로 두면 그 자리가 영영 도는 것으로 보인다. */
    isLoading: groupQuery.isPending || (groupId !== null && valueQuery.isPending),
    refetch: () => {
      void groupQuery.refetch();
      void valueQuery.refetch();
    },
  };
};
