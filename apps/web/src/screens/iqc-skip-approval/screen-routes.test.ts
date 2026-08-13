import { describe, expect, it } from 'vitest';

import { MAPPED_SCREEN_ID, MAPPED_SCREEN_PATH } from './fixtures';
import { SCREEN_ROUTES, screenPathOf } from './screen-routes';

describe('SCREEN_ROUTES 자리표시', () => {
  /**
   * **빈 표가 지금의 사실이다.** 문서 하나를 지목해 여는 주소 규약이 계약에도 이 저장소에도
   * 없다 — 그럴듯한 경로를 지어 넣으면 사용자는 「열기」를 누르고 엉뚱한 자리에 도착한다.
   *
   * 이 화면의 대상은 입하 계열일 가능성이 높고 그 목록 화면이 이 앱에 이미 있지만, 그것은
   * **조건으로 여는 목록 화면**이라 특정 문서로 이동시킬 수단이 없다. 줄 하나를 넣고 싶은
   * 유혹이 실재해 그 판정을 여기 시험으로 못 박는다.
   */
  it('지금은 비어 있다 — 열 곳을 지어내지 않는다', () => {
    expect(Object.keys(SCREEN_ROUTES)).toEqual([]);
  });
});

describe('screenPathOf', () => {
  it('표에 없는 화면 ID는 없음을 값으로 낸다', () => {
    expect(screenPathOf('W-99-98', SCREEN_ROUTES)).toBeNull();
  });

  /**
   * **전환 감지기**(M28의 단위 몫) — 표에 줄이 생기면 그것만으로 경로가 나온다.
   *
   * 이 짝이 없으면 「늘 `null`」로 굳힌 구현이 통과하고, 규약이 정해지는 날 표를 채워도
   * 열기가 살아나지 않는다.
   */
  it('표를 채우면 그 화면 ID가 경로를 낸다', () => {
    expect(screenPathOf(MAPPED_SCREEN_ID, { [MAPPED_SCREEN_ID]: MAPPED_SCREEN_PATH })).toBe(
      MAPPED_SCREEN_PATH,
    );
  });

  /**
   * 계약이 `screenId`를 선택 필드로 두어 빈 문자열이 스키마를 통과한다. 그것을 열쇠로 쓰면
   * 표에 실수로 들어간 빈 열쇠가 **아무 대상이나** 열게 된다.
   */
  it('빈 화면 ID는 표를 뒤지지 않는다', () => {
    expect(screenPathOf('', { '': MAPPED_SCREEN_PATH })).toBeNull();
  });

  /**
   * **표에 넣지 않은 열쇠는 표에 없는 것이다** — 빈 열쇠 방어와 같은 갈래의 남은 한 축이다.
   *
   * 표가 객체 리터럴이라 프로토타입 체인이 살아 있다. 화면 ID가 `toString`·`constructor`처럼
   * 오면 조회가 **함수**를 내고, 없음을 뜻하는 `null`이 아니라서 걸러지지 않는다. 타입도
   * 막지 못한다(`Record<string, string>`이 그 키를 문자열로 약속한 것처럼 보인다).
   *
   * 그대로 두면 「열기」가 **살아 있는 버튼**으로 서고 눌렀을 때 함수가 경로 자리에 실려 간다.
   */
  it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__'])(
    '프로토타입에서 온 열쇠 %s는 화면 ID가 아니다',
    (screenId) => {
      expect(screenPathOf(screenId, SCREEN_ROUTES)).toBeNull();
      /* 표가 채워진 뒤에도 같다 — 이 조회는 표가 서고 나서도 그대로 남는 코드다. */
      expect(screenPathOf(screenId, { [MAPPED_SCREEN_ID]: MAPPED_SCREEN_PATH })).toBeNull();
    },
  );

  /** 짝 방향 — 막는 것은 **프로토타입에서 온 것**뿐이다. 같은 낱말을 표에 넣으면 그것은 열린다. */
  it('같은 낱말이라도 표에 실제로 넣었으면 그 값을 낸다', () => {
    expect(screenPathOf('toString', { toString: MAPPED_SCREEN_PATH })).toBe(MAPPED_SCREEN_PATH);
  });
});
