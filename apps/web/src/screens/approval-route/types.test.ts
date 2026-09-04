import { describe, expect, it } from 'vitest';

import { toRouteView } from './types';
import type { ApprovalRoute } from './types';

/**
 * 응답 → 화면 타입.
 *
 * **계약의 세 상태(`undefined`·`null`·값)를 화면의 두 상태로 줄이는 것이 이 변환의 일이다.**
 * 줄이지 않으면 읽는 자리마다 `?? null`이 흩어지고, 한 자리라도 빠뜨리면 「비었다」와
 * 「안 왔다」가 그 자리에서만 갈린다.
 */

const route = (patch: Partial<ApprovalRoute> = {}): ApprovalRoute => ({
  approvalRouteId: 9001,
  approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
  isActive: true,
  stepCount: 2,
  inProgressCount: 3,
  ...patch,
});

describe('toRouteView', () => {
  it('선택 필드가 오지 않으면 null로 세운다', () => {
    const view = toRouteView(route());

    expect(view.businessUnitId).toBeNull();
    expect(view.minValue).toBeNull();
    expect(view.maxValue).toBeNull();
  });

  it('명시적인 null도 null이다', () => {
    const view = toRouteView(route({ businessUnitId: null, minValue: null, maxValue: null }));

    expect(view.businessUnitId).toBeNull();
    expect(view.minValue).toBeNull();
    expect(view.maxValue).toBeNull();
  });

  it('0을 빈 값으로 바꾸지 않는다', () => {
    // `|| null`로 줄이면 0이 사라진다 — 값 구간 하한 0은 「없음」이 아니라 확정된 값이다.
    const view = toRouteView(route({ minValue: 0, maxValue: 0 }));

    expect(view.minValue).toBe(0);
    expect(view.maxValue).toBe(0);
  });

  it('필수 필드를 응답 값 그대로 옮긴다', () => {
    const view = toRouteView(
      route({ approvalRouteId: 9002, stepCount: 0, inProgressCount: 0, isActive: false }),
    );

    expect(view).toMatchObject({
      approvalRouteId: 9002,
      approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
      isActive: false,
      stepCount: 0,
      inProgressCount: 0,
    });
  });
});
