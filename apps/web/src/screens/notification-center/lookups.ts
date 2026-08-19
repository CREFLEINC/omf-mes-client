import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 알림 유형 목록 — 조건 줄의 선택지와 카드 제목의 이름 풀이가 **한 조회를 함께 쓴다.**
 *
 * ⭐ **좁혀 부를 방법이 없고, 그래서 안전하다.** 사본 체크리스트의 「참조 조회는 좁히지
 * 않는다」가 겨눈 사고는 *선택지용으로 좁힌 조회를 이름 풀이에도 써서 좁힘 밖 값이 「알 수
 * 없음」이 되는 것*인데, 이 경로에는 **좁힘 인자가 하나도 없다**(실측 — 생성 타입의
 * `query?: never`). 한 조회로 둘 다 쓰는 것이 위험을 만들지 않는다.
 *
 * ⭐ **이 목록의 정본은 계약이다**(계약 설명 · 스펙 §5-1). 화면이 코드를 하드코딩하지 않는다 —
 * 공통코드 마스터에 두면 편집 가능해지고, 코드가 바뀌면 보내는 쪽이 조용히 깨진다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface EventEntry {
  /** 계약의 `eventCode`. 조건 줄의 선택 값이자 카드가 들고 있는 값이다 */
  value: string;
  label: string;
}

/**
 * 유형 목록의 조회 결과 — **두 칸뿐이다.**
 *
 * ⛔ **형제 사본들의 `isLoading`·`refetch`·`truncated`를 가져오지 않는다.** 그 셋이 저쪽에서
 * 참인 이유는 **화면이 실제로 소비하기 때문**이다 — 이름이 아직 안 왔음을 따로 말하고(`isLoading`),
 * 실패한 참조마다 「다시 시도」를 붙이며(`refetch`), 잘린 목록을 밝힌다(`truncated`).
 *
 * 이 화면은 셋 다 소비하지 않는다. 미도착도 실패도 **원문 코드로 낙하**해 같은 결과가 되므로
 * 진행 상태를 물을 자리가 없고(`describeEvent`), 유형 목록이 실패해도 알림 목록은 그대로
 * 그려져 사용자가 **하던 일을 계속할 수 있다** — 그 자리에 「다시 시도」를 두면 누르지 않아도
 * 되는 버튼이 상시로 선다. 잘림은 계약에 `page`가 없어 셀 수단 자체가 없다.
 */
export interface LookupResult {
  entries: EventEntry[];
  /** 실패 사실. 조건 줄이 「유형으로 좁힐 수 없다」를 밝히는 데만 쓴다 */
  isError: boolean;
}

/** 결과가 없을 때 쓰는 고정 참조. 매 렌더 새 배열을 만들면 이 값을 받는 쪽이 매번 달라진다. */
const EMPTY_ENTRIES: EventEntry[] = [];

export const lookupKeys = {
  events: ['notification-center-lookups', 'events'] as const,
};

/**
 * 알림 유형 목록.
 *
 * **잘림을 다루지 않는다** — 이 응답에는 `page` 메타가 없다(실측: `{ items }`뿐).
 * 형제 화면들의 `truncated` 판정을 그대로 가져오면 셀 수 없는 값을 세게 된다.
 */
export const useNotificationEventOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.events,
    queryFn: () => runRequest(() => client.GET('/app/notification-events')),
  });

  return {
    entries:
      query.data?.items.map((item) => ({ value: item.eventCode, label: item.eventName })) ??
      EMPTY_ENTRIES,
    isError: query.isError,
  };
};

/**
 * 코드를 사람이 읽는 이름으로 푼다. **풀 수 없으면 원문 코드를 그대로 돌려준다.**
 *
 * ⭐ **형제 화면들의 4갈래 판정(`toReference`)을 가져오지 않는다.** 그 형태가 참인 이유는
 * 그쪽의 낙하 값이 **「알 수 없음」이라는 판단**이기 때문이다 — 목록이 아직 안 왔거나 못 받은
 * 것을 「그 값이 목록에 없다」로 말하면 정상 값에 *잘못됐다*는 표를 붙이는 셈이라, 미도착·실패를
 * 갈라야 한다.
 *
 * 여기서는 낙하 값이 **원본 코드 자체**다. 판단이 아니라 사실이라 어느 갈래에서도 틀리지 않고,
 * 그래서 갈래를 나눌 이유가 없다 — 미도착·실패·목록에 없음이 전부 같은 결과로 수렴한다.
 * 사용자는 그 코드를 그대로 담당자에게 전할 수 있다(공유계약 A-10 규칙 2와 같은 태도).
 *
 * **이름이 비었거나 공백뿐이어도 코드로 낙하한다** — 빈 제목을 그리면 카드가 무엇에 대한
 * 알림인지 말하지 못한다(T1의 본문 낙하와 같은 규율).
 */
export const describeEvent = (code: string, entries: readonly EventEntry[]): string => {
  const label = entries.find((entry) => entry.value === code)?.label;

  return label === undefined || label.trim() === '' ? code : label;
};

/**
 * 고른 값이 목록에 없으면 맨 앞에 남긴다.
 *
 * 남기지 않으면 주소로 들어온 유형이 선택칸에서 사라져 **해제할 방법이 없어진다** —
 * 목록 조회가 실패한 동안에도 같은 일이 일어난다.
 */
export const withCurrentEvent = (entries: readonly EventEntry[], current: string): EventEntry[] =>
  current === '' || entries.some((entry) => entry.value === current)
    ? [...entries]
    : [{ value: current, label: current }, ...entries];
