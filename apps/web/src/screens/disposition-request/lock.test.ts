import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { decisionFixture, productCandidate, returnCandidate } from './fixtures';
import { toFollowUpStates, toRegisterLock, toRequestLock } from './lock';
import { toProgressSteps } from './progress';
import { toCandidateRow, toDecisionRow } from './types';

const t = messages.dispositionRequest;
const detailReady = { isPending: false, isError: false };
const networkError: ApiError = { kind: 'network' };

describe('toRegisterLock — ① 부적합 등록', () => {
  it('대상이 없으면 그 사유로 잠근다', () => {
    expect(
      toRegisterLock({ row: null, severityReady: true, isSaving: false, writeError: null }).reason,
    ).toBe(t.register.lock.noTarget);
  });

  it('부적합이 이미 있으면 번호를 들어 잠근다', () => {
    const row = toCandidateRow(productCandidate());

    expect(
      toRegisterLock({ row, severityReady: true, isSaving: false, writeError: null }).reason,
    ).toBe(t.register.lock.alreadyRegistered('NC-TEST-0001'));
  });

  /* G-2 — 선택지가 비면 지어내지 않고 사유를 단다. 저장 버튼도 같은 사유로 잠긴다. */
  it('심각도 선택지가 비면 잠근다', () => {
    const row = toCandidateRow(returnCandidate());

    expect(
      toRegisterLock({ row, severityReady: false, isSaving: false, writeError: null }).reason,
    ).toBe(t.register.lock.severityPending);
  });

  it('부적합 없음 · 선택지 있음이면 열린다', () => {
    const row = toCandidateRow(returnCandidate());

    expect(toRegisterLock({ row, severityReady: true, isSaving: false, writeError: null })).toEqual(
      {
        reason: undefined,
        isUncertain: false,
      },
    );
  });

  /* 적용 여부를 모르는 저장 — 잠그되 빠져나갈 길(결과 확인)을 함께 낸다. */
  it('응답 없이 끝난 등록은 불확실 잠금이다', () => {
    const row = toCandidateRow(returnCandidate());
    const lock = toRegisterLock({
      row,
      severityReady: true,
      isSaving: false,
      writeError: networkError,
    });

    expect(lock.reason).toBe(t.register.lock.uncertain);
    expect(lock.isUncertain).toBe(true);
  });
});

describe('toRequestLock — ② 판정 의뢰', () => {
  it('부적합이 없으면 먼저 등록하라고 잠근다', () => {
    const row = toCandidateRow(returnCandidate());

    expect(
      toRequestLock({ row, detail: detailReady, isSaving: false, writeError: null }).reason,
    ).toBe(t.request.lock.noNonconformance);
  });

  it('의뢰 전이면 열리고, 상세가 서기 전에는 잠근다', () => {
    const row = toCandidateRow(productCandidate());

    expect(
      toRequestLock({ row, detail: detailReady, isSaving: false, writeError: null }).reason,
    ).toBeUndefined();
    expect(
      toRequestLock({
        row,
        detail: { isPending: true, isError: false },
        isSaving: false,
        writeError: null,
      }).reason,
    ).toBe(t.request.lock.loading);
  });

  it.each([
    ['PENDING_DECISION', t.request.lock.alreadyRequested],
    ['DECIDED', t.request.lock.decided],
  ])('%s 이면 그 단계의 사유로 잠근다', (statusCode, reason) => {
    const row = toCandidateRow(productCandidate({ nonconformanceStatusCode: statusCode }));

    expect(
      toRequestLock({ row, detail: detailReady, isSaving: false, writeError: null }).reason,
    ).toBe(reason);
  });

  /* 모르는 상태에 이름을 지어내지 않는다 — 코드를 들어 막는다. */
  it('모르는 상태 코드는 코드를 들어 잠근다', () => {
    const row = toCandidateRow(productCandidate({ nonconformanceStatusCode: 'SYN-X' as never }));

    expect(
      toRequestLock({ row, detail: detailReady, isSaving: false, writeError: null }).reason,
    ).toBe(t.request.lock.unknownStage('SYN-X'));
  });
});

describe('toFollowUpStates — ③ 후속', () => {
  it('처분이 없으면 셋 다 「처분이 내려지면」 사유다', () => {
    const states = toFollowUpStates([]);

    expect(states.rework.reason).toBe(t.result.followUp.reworkNotDecided);
    expect(states.disposal.reason).toBe(t.result.followUp.disposalNotDecided);
    expect(states.reinstate.reason).toBe(t.result.followUp.reinstateNotDecided);
  });

  /* 조건이 맞아도 열 화면이 없으면 그 사실을 사유로 말한다 — 지어낸 주소로 보내지 않는다. */
  it('재작업 처분이 있으면 사유가 「현장 단말 화면」으로 바뀐다', () => {
    const states = toFollowUpStates([toDecisionRow(decisionFixture())]);

    expect(states.rework.reason).toBe(t.result.followUp.reworkUnavailable);
    expect(states.disposal.reason).toBe(t.result.followUp.disposalNotDecided);
  });

  it('정상 처분이 있으면 재고 재등록 후속 작업을 연다', () => {
    const states = toFollowUpStates([
      toDecisionRow(decisionFixture({ dispositionTypeCode: 'NORMAL' })),
    ]);

    expect(states.reinstate.reason).toBeUndefined();
  });
});

describe('toProgressSteps', () => {
  it('대상이 없으면 전부 대기다', () => {
    expect(toProgressSteps(null, false).map((step) => step.status)).toEqual([
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('단계가 오를수록 앞이 완료로 바뀐다', () => {
    expect(toProgressSteps('NONE', true).map((step) => step.status)).toEqual([
      'current',
      'pending',
      'pending',
      'pending',
    ]);
    expect(toProgressSteps('PENDING_DECISION', true).map((step) => step.status)).toEqual([
      'complete',
      'complete',
      'current',
      'pending',
    ]);
    expect(toProgressSteps('DECIDED', true).map((step) => step.status)).toEqual([
      'complete',
      'complete',
      'complete',
      'current',
    ]);
  });
});
