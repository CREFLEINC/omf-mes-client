import { describe, expect, it } from 'vitest';

import { routeViewFixtures } from './fixtures';
import {
  emptyRouteFormValues,
  isSameRouteValues,
  routeToFormValues,
  toBusinessUnitId,
  toRouteCreate,
  toRouteUpdate,
} from './route-request';
import type { RouteFormValues, RouteView } from './types';

const [withUnit, allUnits, lowerOnly] = routeViewFixtures as [RouteView, RouteView, RouteView];

const values = (overrides: Partial<RouteFormValues> = {}): RouteFormValues => ({
  approvalTypeCode: 'PURCHASE_ORDER',
  businessUnitId: '9101',
  minValue: '100',
  maxValue: '500',
  ...overrides,
});

describe('emptyRouteFormValues', () => {
  it('등록 폼은 빈 값으로 선다 — 기본값을 지어내지 않는다', () => {
    expect(emptyRouteFormValues()).toEqual({
      approvalTypeCode: '',
      businessUnitId: '',
      minValue: '',
      maxValue: '',
    });
  });
});

describe('routeToFormValues', () => {
  it('서버 값을 그대로 폼 값으로 옮긴다', () => {
    expect(routeToFormValues(withUnit)).toEqual({
      approvalTypeCode: 'PURCHASE_ORDER',
      businessUnitId: '9101',
      minValue: '100',
      maxValue: '500',
    });
  });

  it('비어 있는 사업부·값 구간은 빈 칸이 된다', () => {
    expect(routeToFormValues(allUnits)).toEqual({
      approvalTypeCode: 'PURCHASE_ORDER',
      businessUnitId: '',
      minValue: '',
      maxValue: '',
    });
  });

  /** 하한 0은 값이다 — 빈 칸으로 옮기면 저장할 때 「전 구간」으로 바뀐다. */
  it('하한 0을 빈 칸으로 만들지 않는다', () => {
    expect(routeToFormValues(lowerOnly)).toMatchObject({ minValue: '0', maxValue: '' });
  });
});

describe('isSameRouteValues', () => {
  it('네 값이 모두 같아야 같다', () => {
    expect(isSameRouteValues(values(), values())).toBe(true);
  });

  it.each(['approvalTypeCode', 'businessUnitId', 'minValue', 'maxValue'] as const)(
    '「%s」가 달라지면 고친 것으로 본다',
    (key) => {
      expect(isSameRouteValues(values(), values({ [key]: '다른 값' }))).toBe(false);
    },
  );
});

describe('toBusinessUnitId', () => {
  it('빈 칸은 전 사업부 공통이다', () => {
    expect(toBusinessUnitId('')).toBeNull();
  });

  it('식별자가 아니면 싣지 않는다 — NaN을 서버로 보내지 않는다', () => {
    expect(toBusinessUnitId('abc')).toBeNull();
    expect(toBusinessUnitId('0')).toBeNull();
    expect(toBusinessUnitId('-1')).toBeNull();
  });

  it('식별자는 숫자로 옮긴다', () => {
    expect(toBusinessUnitId('9101')).toBe(9101);
  });
});

describe('toRouteCreate', () => {
  it('네 필드를 싣는다', () => {
    expect(toRouteCreate(values())).toEqual({
      approvalTypeCode: 'PURCHASE_ORDER',
      businessUnitId: 9101,
      minValue: 100,
      maxValue: 500,
    });
  });

  /** 목이 공백만인 유형을 201로 받는다 — 턴 값을 보내는 것이 화면의 방어다. */
  it('승인 유형의 앞뒤 공백을 턴다', () => {
    expect(toRouteCreate(values({ approvalTypeCode: '  PURCHASE_ORDER  ' }))).toMatchObject({
      approvalTypeCode: 'PURCHASE_ORDER',
    });
  });

  it('비운 칸은 null로 싣는다', () => {
    expect(toRouteCreate(values({ businessUnitId: '', minValue: '', maxValue: '' }))).toEqual({
      approvalTypeCode: 'PURCHASE_ORDER',
      businessUnitId: null,
      minValue: null,
      maxValue: null,
    });
  });

  it('하한 0을 비움으로 만들지 않는다', () => {
    expect(toRouteCreate(values({ minValue: '0' }))).toMatchObject({ minValue: 0 });
  });
});

describe('toRouteUpdate', () => {
  /**
   * **세 필드를 늘 명시해 싣는다.** 서버 동작은 생략과 같지만(둘 다 비워진다) 생략으로
   * 비우면 「빠뜨린 것」과 「비우려는 것」이 코드에서 구별되지 않는다.
   */
  it('비운 칸까지 세 필드를 늘 명시한다', () => {
    const body = toRouteUpdate(values({ businessUnitId: '', minValue: '', maxValue: '' }));

    expect(Object.keys(body).sort()).toEqual(['businessUnitId', 'maxValue', 'minValue']);
    expect(body).toEqual({ businessUnitId: null, minValue: null, maxValue: null });
  });

  it('값이 있으면 그대로 싣는다', () => {
    expect(toRouteUpdate(values())).toEqual({
      businessUnitId: 9101,
      minValue: 100,
      maxValue: 500,
    });
  });

  /**
   * 계약의 수정 본문에 승인 유형이 없고(바꾸면 다른 결재선이다) 사용 여부는 전용 액션으로만
   * 바뀐다 — 실어 보내면 서버가 400을 낼 수 있고, 무엇보다 화면이 하지 않기로 한 일이다.
   */
  it('승인 유형과 사용 여부를 싣지 않는다', () => {
    const body: Record<string, unknown> = toRouteUpdate(values());

    expect(body.approvalTypeCode).toBeUndefined();
    expect(body.isActive).toBeUndefined();
    expect('approvalTypeCode' in body).toBe(false);
    expect('isActive' in body).toBe(false);
  });
});
