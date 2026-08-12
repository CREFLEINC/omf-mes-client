import { describe, expect, it } from 'vitest';

import { judgeDuplicate, type DuplicateProbe } from './duplicate-check';
import type { ApprovalRoute } from './types';

const route = (overrides: Partial<ApprovalRoute> = {}): ApprovalRoute => ({
  approvalRouteId: 9001,
  approvalTypeCode: 'SAMPLE-TYPE-A',
  businessUnitId: 9101,
  minValue: null,
  maxValue: null,
  isActive: true,
  stepCount: 2,
  inProgressCount: 0,
  ...overrides,
});

const probe = (items: ApprovalRoute[], overrides: Partial<DuplicateProbe> = {}): DuplicateProbe => ({
  items,
  total: items.length,
  isLoading: false,
  isError: false,
  ...overrides,
});

describe('judgeDuplicate — 판정하지 못하는 갈래', () => {
  /**
   * **순서가 뜻을 정한다.** 실패·미도착을 「중복 없음」으로 읽으면 못 본 것을 없다고 단정하고,
   * 「중복 있음」으로 읽으면 조회 실패가 마스터 관리 전체를 멈춘다.
   */
  it('실패가 미도착보다 앞선다', () => {
    expect(judgeDuplicate(probe([], { isError: true, isLoading: true }), target())).toEqual({
      kind: 'unknown',
      reason: 'failed',
    });
  });

  it('아직 오지 않았으면 판정하지 않는다', () => {
    expect(judgeDuplicate(probe([], { isLoading: true }), target())).toEqual({
      kind: 'unknown',
      reason: 'loading',
    });
  });

  /** 조용한 잘림 금지 — 잘린 목록으로 「없다」고 판정하면 있는 중복을 못 본다. */
  it('전체 건수가 받은 건수보다 많으면 잘린 것이다', () => {
    expect(judgeDuplicate(probe([route()], { total: 5 }), target({ selfRouteId: 9001 }))).toEqual({
      kind: 'unknown',
      reason: 'truncated',
    });
  });

  it('잘림이 중복 판정보다 앞선다', () => {
    expect(judgeDuplicate(probe([route()], { total: 5 }), target())).toEqual({
      kind: 'unknown',
      reason: 'truncated',
    });
  });
});

const target = (
  overrides: Partial<{ businessUnitId: number | null; selfRouteId: number | null }> = {},
) => ({ businessUnitId: 9101, selfRouteId: null, ...overrides });

describe('judgeDuplicate — 사업부 맞추기', () => {
  it('같은 사업부의 사용 중 결재선이 있으면 막는다', () => {
    expect(judgeDuplicate(probe([route()]), target())).toEqual({
      kind: 'blocked',
      existingCount: 1,
      existingRouteId: 9001,
    });
  });

  /**
   * **사업부 지정본과 전 사업부 공통본은 다른 결재선이다**(계약). 하나로 뭉개면
   * 정당한 공통본 등록이 지정본 때문에 막힌다.
   */
  it('사업부가 다르면 중복이 아니다', () => {
    expect(judgeDuplicate(probe([route({ businessUnitId: 9102 })]), target())).toEqual({
      kind: 'clear',
    });
  });

  it('전 사업부 공통끼리만 맞는다', () => {
    const rows = [route({ approvalRouteId: 9001, businessUnitId: null })];

    expect(judgeDuplicate(probe(rows), target({ businessUnitId: null }))).toEqual({
      kind: 'blocked',
      existingCount: 1,
      existingRouteId: 9001,
    });
  });

  it('전 사업부 공통을 만들 때 사업부 지정본은 중복이 아니다', () => {
    expect(judgeDuplicate(probe([route()]), target({ businessUnitId: null }))).toEqual({
      kind: 'clear',
    });
  });

  it('사업부를 지정할 때 전 사업부 공통본은 중복이 아니다', () => {
    expect(judgeDuplicate(probe([route({ businessUnitId: null })]), target())).toEqual({
      kind: 'clear',
    });
  });
});

describe('judgeDuplicate — 자기 자신', () => {
  /** 빼지 않으면 자기 자신 때문에 수정이 **늘** 막힌다. */
  it('수정할 때 자기 행은 중복이 아니다', () => {
    expect(judgeDuplicate(probe([route()]), target({ selfRouteId: 9001 }))).toEqual({
      kind: 'clear',
    });
  });

  it('자기 행을 뺀 뒤에도 남은 것이 있으면 막는다', () => {
    const rows = [route({ approvalRouteId: 9001 }), route({ approvalRouteId: 9002 })];

    expect(judgeDuplicate(probe(rows), target({ selfRouteId: 9001 }))).toEqual({
      kind: 'blocked',
      existingCount: 1,
      existingRouteId: 9002,
    });
  });

  it('등록에는 자기 행이 없다', () => {
    expect(judgeDuplicate(probe([]), target({ selfRouteId: null }))).toEqual({ kind: 'clear' });
  });
});

describe('judgeDuplicate — 「활성 중복」의 뜻', () => {
  /**
   * **무엇을 중복으로 볼 것인가의 정본이 이 파일이다.** 조준 조회가 `activeOnly=true`를
   * 싣지만 그것은 요청의 사정이고, 판정의 근거는 여기 한 곳에 있어야 한다.
   */
  it('사용 중지된 결재선은 중복이 아니다', () => {
    expect(judgeDuplicate(probe([route({ isActive: false })]), target())).toEqual({
      kind: 'clear',
    });
  });

  it('여러 건이면 건수를 함께 낸다', () => {
    const rows = [route({ approvalRouteId: 9001 }), route({ approvalRouteId: 9002 })];

    expect(judgeDuplicate(probe(rows), target())).toEqual({
      kind: 'blocked',
      existingCount: 2,
      existingRouteId: 9001,
    });
  });

  /** 기존 행으로 옮겨 가는 길이 이 번호 하나에 달렸다 — 추가 조회를 만들지 않기 위한 것이다. */
  it('막을 때 기존 결재선 번호를 함께 낸다', () => {
    const judged = judgeDuplicate(probe([route({ approvalRouteId: 9007 })]), target());

    expect(judged).toMatchObject({ kind: 'blocked', existingRouteId: 9007 });
  });
});
