import { describe, expect, it } from 'vitest';

import { SCREEN_ROUTES, screenPathOf } from './screen-routes';

describe('화면 ID 매핑표', () => {
  it('US4-4·Q13 출하 취소 결재(W-04-02)는 출하 예정 목록에 승인 요청 ID 를 싣는다 — 그 화면이 대상 출하의 지시서 상세를 연다', () => {
    expect(screenPathOf('W-04-02', 9001, SCREEN_ROUTES)).toBe(
      '/shipment/shipment-schedule?approvalRequestId=9001',
    );
  });

  it('US5-2 출하 내역(W-04-12) 화면 주소는 매핑표에 없다 — 옛 결재도 서버가 W-04-02 로 낸다(피처 012 R-7)', () => {
    expect(SCREEN_ROUTES['W-04-12']).toBeUndefined();
  });

  it('품질 승인 처리(W-03-09)는 화면째 지워 매핑표에 없다(omf-all-around#352)', () => {
    expect(SCREEN_ROUTES['W-03-09']).toBeUndefined();
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
