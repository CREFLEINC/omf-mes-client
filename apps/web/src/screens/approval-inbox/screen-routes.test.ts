import { describe, expect, it } from 'vitest';

import { SCREEN_ROUTES, screenPathOf } from './screen-routes';

describe('화면 ID 매핑표', () => {
  it('W-03-09는 정식 주소에 선택한 승인 요청 ID를 싣는다', () => {
    expect(screenPathOf('W-03-09', 9001, SCREEN_ROUTES)).toBe(
      '/quality/approvals?approvalRequestId=9001',
    );
  });

  it('표에 없는 화면 ID는 경로가 없다', () => {
    expect(screenPathOf('W-99-99', 9001, SCREEN_ROUTES)).toBeNull();
  });

  it('객체 프로토타입 이름은 표의 경로로 읽지 않는다', () => {
    expect(screenPathOf('constructor', 9001, SCREEN_ROUTES)).toBeNull();
    expect(screenPathOf('toString', 9001, SCREEN_ROUTES)).toBeNull();
  });

  it('표에 줄이 생기면 그 경로가 나온다 — 자리표시가 죽은 가지가 아니다', () => {
    /* 전환 감지기: 매핑표를 채우는 것만으로 열기가 살아나야 한다(계획 M28). */
    expect(
      screenPathOf('W-99-99', 9001, {
        'W-99-99': { path: '/synthetic/target', selectionKey: 'syntheticId' },
      }),
    ).toBe('/synthetic/target?syntheticId=9001');
  });

  it('빈 화면 ID는 표를 뒤지지 않는다 — 빈 열쇠에 값이 실린 표도 통하지 않는다', () => {
    expect(
      screenPathOf('', 9001, {
        '': { path: '/synthetic/empty-key', selectionKey: 'syntheticId' },
      }),
    ).toBeNull();
  });
});
