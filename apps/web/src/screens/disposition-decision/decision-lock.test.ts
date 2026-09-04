import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toDecisionLock, type DecisionLockInput } from './decision-lock';

const t = messages.dispositionDecision;
/** ⚠ 지어낸 자리표시다 — 처분 유형의 실제 값 목록은 아직 확정되지 않았다. */
const CODES = ['REWORK'];

const http = (status: number): ApiError => ({ kind: 'http', status });
const NETWORK: ApiError = { kind: 'network' };

const input = (overrides: Partial<DecisionLockInput> = {}): DecisionLockInput => ({
  selectedId: 41,
  isSaving: false,
  writeError: null,
  detailError: null,
  uomId: 7001,
  dispositionTypeCodes: CODES,
  ...overrides,
});

describe('toDecisionLock — 잠그지 않는 경우', () => {
  it('다 갖춰지면 잠그지 않는다', () => {
    expect(toDecisionLock(input())).toEqual({ reason: undefined, isUncertain: false });
  });

  it('저장이 409로 거부돼도 잠그지 않는다 — 고쳐서 다시 보낼 수 있다', () => {
    expect(toDecisionLock(input({ writeError: http(409) })).reason).toBeUndefined();
  });

  it('저장이 400으로 거부돼도 잠그지 않는다 — 실행 전 거부다', () => {
    expect(toDecisionLock(input({ writeError: http(400) })).reason).toBeUndefined();
  });
});

describe('toDecisionLock — 잠그는 경우', () => {
  it('고른 부적합이 없으면 먼저 고르라고 한다', () => {
    expect(toDecisionLock(input({ selectedId: null })).reason).toBe(t.form.selectFirstReason);
  });

  it('저장 중에는 저장 중이라고 한다', () => {
    expect(toDecisionLock(input({ isSaving: true })).reason).toBe(t.form.savingReason);
  });

  it('⭐ 연결이 끊긴 저장은 적용 여부를 모르므로 잠그고 «확인이 필요하다»고 표시한다', () => {
    expect(toDecisionLock(input({ writeError: NETWORK }))).toEqual({
      reason: t.form.uncertainReason,
      isUncertain: true,
    });
  });

  it('⭐ 겨냥한 부적합이 지금 고른 것과 다르면 그 번호를 대며 잠근다', () => {
    const lock = toDecisionLock(
      input({ writeError: NETWORK, otherPendingWriteNo: 'NC-TEST-0041' }),
    );

    expect(lock.reason).toBe(t.form.uncertainOtherTarget('NC-TEST-0041'));
    expect(lock.reason).not.toBe(t.form.uncertainReason);
    expect(lock.isUncertain).toBe(true);
  });

  it('⭐ 5xx도 같은 묶음이다 — 한쪽만 잠그면 최악의 조합이 된다', () => {
    expect(toDecisionLock(input({ writeError: http(500) }))).toEqual({
      reason: t.form.uncertainReason,
      isUncertain: true,
    });
    expect(toDecisionLock(input({ writeError: http(503) })).isUncertain).toBe(true);
  });

  it('⭐ 저장 403도 잠근다 — 읽기는 되고 쓰기만 막히는 게이팅이 있다', () => {
    expect(toDecisionLock(input({ writeError: http(403) })).reason).toBe(t.form.forbiddenReason);
  });

  it('상세 조회 403도 잠근다', () => {
    expect(toDecisionLock(input({ detailError: http(403) })).reason).toBe(t.form.forbiddenReason);
  });

  it('⛔ 단위를 정할 수 없으면 사유를 보이며 잠근다 — 조용히 아무 일도 안 하지 않는다', () => {
    expect(toDecisionLock(input({ uomId: undefined })).reason).toBe(t.form.unitUnknownReason);
  });

  it('처분 값 목록이 비면 잠근다(G-2)', () => {
    expect(toDecisionLock(input({ dispositionTypeCodes: [] })).reason).toBe(t.dispositionPending);
  });
});

describe('toDecisionLock — 우선순위', () => {
  it('대상이 없으면 다른 무엇보다 먼저 말한다', () => {
    expect(
      toDecisionLock(input({ selectedId: null, isSaving: true, writeError: NETWORK })).reason,
    ).toBe(t.form.selectFirstReason);
  });

  it('저장 중이 적용 여부 불명보다 앞선다 — 지금 보내는 중이다', () => {
    expect(toDecisionLock(input({ isSaving: true, writeError: NETWORK })).reason).toBe(
      t.form.savingReason,
    );
  });

  it('⭐ 적용 여부 불명이 권한·단위·값 목록보다 앞선다 — 그것부터 확인해야 한다', () => {
    const lock = toDecisionLock(
      input({
        writeError: NETWORK,
        detailError: http(403),
        uomId: undefined,
        dispositionTypeCodes: [],
      }),
    );

    expect(lock.reason).toBe(t.form.uncertainReason);
    expect(lock.isUncertain).toBe(true);
  });

  it('권한 없음이 단위·값 목록보다 앞선다', () => {
    expect(
      toDecisionLock(input({ detailError: http(403), uomId: undefined, dispositionTypeCodes: [] }))
        .reason,
    ).toBe(t.form.forbiddenReason);
  });

  it('단위를 모르는 것이 값 목록 없음보다 앞선다', () => {
    expect(toDecisionLock(input({ uomId: undefined, dispositionTypeCodes: [] })).reason).toBe(
      t.form.unitUnknownReason,
    );
  });

  it('적용 여부 불명일 때만 확인이 필요하다고 표시한다', () => {
    expect(toDecisionLock(input({ detailError: http(403) })).isUncertain).toBe(false);
    expect(toDecisionLock(input({ uomId: undefined })).isUncertain).toBe(false);
    expect(toDecisionLock(input({ isSaving: true })).isUncertain).toBe(false);
  });
});
