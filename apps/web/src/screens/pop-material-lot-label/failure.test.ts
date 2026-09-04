import type { ApiError } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { toIssueFailure } from './failure';
import type { IssueRunResult } from './mutations';

/**
 * 실패 갈래 판정 — **화면을 띄우지 않고 조합만 잰다.**
 *
 * 흐름 시험(`issue-flow.test.tsx`)은 목이 답할 수 있는 모양만 지나간다. 정규화가 내는 갈래는
 * 그보다 넓어서(같은 403 이 봉투 유무로 `http`·`validation`·`stateLocked` 로 갈린다) 여기서
 * 갈래별로 직접 잰다.
 */
const resultOf = (over: Partial<IssueRunResult>): IssueRunResult => ({
  lineId: 1,
  isPrinted: false,
  failedAt: null,
  hasCreatedLot: false,
  issue: null,
  error: null,
  ...over,
});

const forbiddenEnvelope = (kind: 'validation' | 'stateLocked'): ApiError => ({
  kind,
  errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: '출력 권한이 없습니다.' }],
});

describe('toIssueFailure', () => {
  it('아직 아무것도 하지 않았거나 끝까지 갔으면 실패가 아니다', () => {
    expect(toIssueFailure(resultOf({}))).toBeNull();
    expect(toIssueFailure(resultOf({ isPrinted: true, failedAt: null }))).toBeNull();
  });

  it('인쇄에서 멈춘 것은 기록이 남은 실패다', () => {
    expect(toIssueFailure(resultOf({ failedAt: 'print' }))).toBe('printFailed');
  });

  it('채번 충돌은 봉투로 와도 상태 코드로 와도 재시도 가능이다', () => {
    const conflict: ApiError = { kind: 'conflict', cause: 'user', message: '충돌' };
    const bare: ApiError = { kind: 'http', status: 409 };

    expect(toIssueFailure(resultOf({ failedAt: 'register', error: conflict }))).toBe(
      'registerConflict',
    );
    expect(toIssueFailure(resultOf({ failedAt: 'register', error: bare }))).toBe(
      'registerConflict',
    );
  });

  it('⛔ 400 을 채번 충돌로 읽지 않는다', () => {
    const error: ApiError = { kind: 'http', status: 400 };

    expect(toIssueFailure(resultOf({ failedAt: 'register', error }))).toBe('other');
  });

  /**
   * ⛔ **봉투로 온 403 이 이 판정의 실제 모양이다.** 계약이 403 을 오류 봉투로 정의하므로
   * 정규화는 상태 코드를 버리고 `validation`(또는 `stateLocked`)으로 접는다 — 상태 코드만 보는
   * 판정은 실서버에서 한 번도 참이 되지 않는다.
   */
  it('권한 거부는 봉투로 와도 상태 코드로 와도 같은 갈래다', () => {
    const bare: ApiError = { kind: 'http', status: 403 };

    expect(toIssueFailure(resultOf({ failedAt: 'issue', error: bare }))).toBe('issueForbidden');
    expect(
      toIssueFailure(resultOf({ failedAt: 'issue', error: forbiddenEnvelope('validation') })),
    ).toBe('issueForbidden');
    expect(
      toIssueFailure(resultOf({ failedAt: 'issue', error: forbiddenEnvelope('stateLocked') })),
    ).toBe('issueForbidden');
  });

  it('권한 거부가 아닌 봉투는 그 밖의 실패다', () => {
    const error: ApiError = {
      kind: 'validation',
      errors: [{ scope: 'field', code: 'REQUIRED', field: 'lotNo', message: '필수입니다.' }],
    };

    expect(toIssueFailure(resultOf({ failedAt: 'issue', error }))).toBe('other');
  });

  it('갈래를 가릴 오류가 없으면 그 밖의 실패다', () => {
    expect(toIssueFailure(resultOf({ failedAt: 'register', error: null }))).toBe('other');
  });
});
