import { describe, expect, it } from 'vitest';

import { toRouteView, toStepView } from './types';
import type { ApprovalRoute, ApprovalRouteStep } from './types';

/**
 * 응답 → 화면 타입.
 *
 * **계약의 세 상태(`undefined`·`null`·값)를 화면의 두 상태로 줄이는 것이 이 변환의 일이다.**
 * 줄이지 않으면 읽는 자리마다 `?? null`이 흩어지고, 한 자리라도 빠뜨리면 「비었다」와
 * 「안 왔다」가 그 자리에서만 갈린다.
 */

const route = (patch: Partial<ApprovalRoute> = {}): ApprovalRoute => ({
  approvalRouteId: 9001,
  approvalTypeCode: 'SAMPLE-TYPE-A',
  isActive: true,
  stepCount: 2,
  inProgressCount: 3,
  ...patch,
});

const step = (patch: Partial<ApprovalRouteStep> = {}): ApprovalRouteStep => ({
  approvalRouteStepId: 9101,
  stepNo: 1,
  approverTypeCode: 'USER',
  approverUserId: 9201,
  approverName: '합성 승인자1',
  approverDepartmentName: '합성부서',
  approverIsActive: true,
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
      approvalTypeCode: 'SAMPLE-TYPE-A',
      isActive: false,
      stepCount: 0,
      inProgressCount: 0,
    });
  });
});

describe('toStepView', () => {
  it('표시 이름을 응답 값 그대로 옮긴다', () => {
    const view = toStepView(step());

    expect(view.approverName).toBe('합성 승인자1');
    expect(view.approverDepartmentName).toBe('합성부서');
    expect(view.approverIsActive).toBe(true);
  });

  it('이름이 오지 않으면 null이고, 화면 타입에 승인자 번호를 담지 않는다', () => {
    const view = toStepView(step({ approverName: undefined, approverDepartmentName: undefined }));

    // 선행 단언 — 담을 것을 담고 있어야 「담지 않는다」가 뜻을 갖는다.
    expect(view.stepNo).toBe(1);
    expect(view.approverName).toBeNull();
    expect(view.approverDepartmentName).toBeNull();
    // 번호를 담을 자리가 없으면 화면으로 샐 경로도 없다.
    expect(Object.keys(view)).not.toContain('approverUserId');
    expect(JSON.stringify(view)).not.toContain('9201');
  });

  it('빈 문자열 이름을 이름으로 세우지 않는다', () => {
    // 서버가 빈 문구를 주는 일이 실제로 있다. 빈 이름을 통과시키면 승인자 칸이 이유 없이 빈다.
    const view = toStepView(step({ approverName: '', approverDepartmentName: '' }));

    expect(view.approverName).toBeNull();
    expect(view.approverDepartmentName).toBeNull();
  });

  it('승인자가 사용 중지 상태면 그 사실을 옮긴다', () => {
    const view = toStepView(step({ approverIsActive: false }));

    expect(view.approverIsActive).toBe(false);
  });
});
