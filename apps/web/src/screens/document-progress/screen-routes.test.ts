import { describe, expect, it } from 'vitest';

import {
  SCREEN_ROUTES,
  judgeScreenOpen,
  screenPathOf,
  type ScreenRouteTable,
} from './screen-routes';

const filled: ScreenRouteTable = { 'SYN-SCREEN-01': '/logistics/synthetic-screen' };

describe('SCREEN_ROUTES', () => {
  /**
   * ⭐ **비어 있는 것이 지금의 사실이다.** 문서 하나를 지목해 여는 주소 규약이 계약에도 이
   * 저장소에도 없어, 그럴듯한 경로를 지어 넣으면 사용자가 「열었더니 그 문서가 아닌」 자리에 간다.
   */
  it('빈 표다', () => {
    expect(Object.keys(SCREEN_ROUTES)).toHaveLength(0);
  });
});

describe('screenPathOf', () => {
  it('표에 있으면 주소를 낸다', () => {
    expect(screenPathOf('SYN-SCREEN-01', filled)).toBe('/logistics/synthetic-screen');
  });

  it('표에 없으면 null이다', () => {
    expect(screenPathOf('SYN-SCREEN-99', filled)).toBeNull();
  });

  /**
   * **빈 화면 ID는 표를 뒤지지 않는다.** 계약이 `screenId`를 선택으로 두어 빈 문자열이 스키마를
   * 통과하는데, 그것을 열쇠로 쓰면 표에 실수로 들어간 빈 열쇠가 아무 문서나 열게 된다.
   */
  it('빈 화면 ID는 표를 뒤지지 않는다', () => {
    expect(screenPathOf('', { ...filled, '': '/logistics/synthetic-screen' })).toBeNull();
  });
});

describe('judgeScreenOpen', () => {
  /* 표가 비어 있는 지금 — **어떤 화면 ID로도 열리지 않는다.** */
  it('빈 표에서는 열리지 않는다', () => {
    expect(judgeScreenOpen('SYN-SCREEN-01', SCREEN_ROUTES)).toEqual({ kind: 'unmapped' });
  });

  /* ⭐ 표에 줄이 생기면 **그것만으로** 열기가 살아난다 — 다른 자리는 바뀌지 않는다. */
  it('표를 채우면 열린다', () => {
    expect(judgeScreenOpen('SYN-SCREEN-01', filled)).toEqual({
      kind: 'open',
      path: '/logistics/synthetic-screen',
    });
  });

  /**
   * 「화면 ID가 오지 않았다」와 「이 앱에 그 화면이 없다」를 가른다 — **풀 수 있는 사람이 다르다.**
   * 앞은 계약·규약 쪽 일이고 뒤는 이 저장소에 줄을 더하면 된다.
   */
  it('화면 ID가 없으면 그 사실을 낸다', () => {
    expect(judgeScreenOpen('', filled)).toEqual({ kind: 'noScreenId' });
  });
});
