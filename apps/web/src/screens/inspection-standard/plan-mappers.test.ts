import { describe, expect, it } from 'vitest';

import { inspectionPlanFixtures } from './fixtures';
import {
  emptyPlanFormValues,
  formatApprovedAt,
  isSamePlanValues,
  planToFormValues,
  toPlanCreate,
  toPlanUpdate,
} from './plan-mappers';
import type { PlanFormValues } from './types';

const filled: PlanFormValues = {
  inspectionPlanCode: ' SYN-PLAN-01 ',
  inspectionPlanName: ' 합성 검사기준 A ',
  inspectionTypeCode: 'IQC',
  itemId: '5001',
  processId: '9001',
  routingId: '7003',
};

describe('planToFormValues', () => {
  it('계약의 값을 폼 문자열로 옮긴다', () => {
    expect(planToFormValues(inspectionPlanFixtures[1]!)).toEqual({
      inspectionPlanCode: 'SYN-PLAN-02',
      inspectionPlanName: '합성 검사기준 B',
      inspectionTypeCode: 'PQC',
      itemId: '5001',
      processId: '9001',
      routingId: '7003',
    });
  });

  /* 널·없음을 모두 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다. */
  it('널인 품목·공정·라우팅은 빈 문자열이 된다', () => {
    const values = planToFormValues(inspectionPlanFixtures[2]!);

    expect(values.itemId).toBe('');
    expect(values.processId).toBe('');
    expect(values.routingId).toBe('');
  });
});

describe('emptyPlanFormValues', () => {
  it('모든 칸이 빈 폼을 만든다', () => {
    expect(emptyPlanFormValues()).toEqual({
      inspectionPlanCode: '',
      inspectionPlanName: '',
      inspectionTypeCode: '',
      itemId: '',
      processId: '',
      routingId: '',
    });
  });
});

describe('toPlanUpdate', () => {
  it('앞뒤 공백을 떼고 선택 값을 숫자로 옮긴다', () => {
    expect(toPlanUpdate(filled)).toEqual({
      inspectionPlanCode: 'SYN-PLAN-01',
      inspectionPlanName: '합성 검사기준 A',
      inspectionTypeCode: 'IQC',
      itemId: 5001,
      processId: 9001,
      routingId: 7003,
    });
  });

  it('비운 선택 값은 널로 보낸다', () => {
    const body = toPlanUpdate({ ...filled, itemId: '', processId: '', routingId: '' });

    expect(body.itemId).toBeNull();
    expect(body.processId).toBeNull();
    expect(body.routingId).toBeNull();
  });

  /*
   * 승인 정보와 사용 여부는 전용 액션(:approve · :deactivate)으로만 바뀐다.
   * 수정 본문에 실으면 계약 위반이다.
   */
  it('승인 정보와 사용 여부를 싣지 않는다', () => {
    const body = toPlanUpdate(filled) as Record<string, unknown>;

    expect('approvedBy' in body).toBe(false);
    expect('approvedAt' in body).toBe(false);
    expect('isActive' in body).toBe(false);
    expect('inspectionPlanId' in body).toBe(false);
  });
});

describe('toPlanCreate', () => {
  it('등록 본문은 수정 본문과 같은 항목을 싣는다', () => {
    expect(toPlanCreate(filled)).toEqual(toPlanUpdate(filled));
  });
});

describe('isSamePlanValues', () => {
  it('모든 칸이 같으면 같다고 본다', () => {
    expect(isSamePlanValues(filled, { ...filled })).toBe(true);
  });

  it('한 칸이라도 다르면 다르다고 본다', () => {
    expect(isSamePlanValues(filled, { ...filled, routingId: '' })).toBe(false);
    expect(isSamePlanValues(filled, { ...filled, inspectionTypeCode: 'OQC' })).toBe(false);
  });
});

describe('formatApprovedAt', () => {
  it('날짜와 분까지만 낸다', () => {
    expect(formatApprovedAt('2026-08-04T09:12:00+09:00')).toBe('2026-08-04 09:12');
  });

  it('값이 없으면 null이다', () => {
    expect(formatApprovedAt(null)).toBeNull();
    expect(formatApprovedAt(undefined)).toBeNull();
    expect(formatApprovedAt('')).toBeNull();
  });

  /* 시각을 지어내지 않는다 — 형식이 다르면 원문을 그대로 낸다. */
  it('아는 형식이 아니면 원문을 그대로 낸다', () => {
    expect(formatApprovedAt('2026년 8월 4일')).toBe('2026년 8월 4일');
  });
});
