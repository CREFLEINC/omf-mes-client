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
});
