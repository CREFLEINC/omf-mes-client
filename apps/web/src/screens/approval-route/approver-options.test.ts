import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { approverNote, toApproverOptions, type ApproverLookup } from './approver-options';
import { userFixtures } from './fixtures';
import type { AppUser } from './types';

const t = messages.approvalRoute;

/** 인덱스 접근이 `undefined`를 섞지 않게 한 자리에서 좁힌다. 픽스처가 비지 않는다는 것은 이 파일의 전제다. */
const userAt = (index: number): AppUser => userFixtures[index] as AppUser;

const lookup = (overrides: Partial<ApproverLookup> = {}): ApproverLookup => ({
  options: [],
  isError: false,
  truncated: false,
  refetch: () => undefined,
  ...overrides,
});

/**
 * 승인자 선택지.
 *
 * **사업부 참조와 다른 자리다.** 사업부는 이미 저장된 번호를 이름으로 **푸는** 참조라 네 갈래를
 * 갈라야 하지만, 승인자는 **고르는 값**이라 목록을 그대로 쓴다 — 못 고른 값이 화면에 설 일이 없다.
 * 대신 **목록이 잘리면 그 사실을 밝혀야 한다**: 고를 수 없는 사람이 생기는데 화면이 조용하면
 * 사용자는 「그런 사람이 없다」로 결론짓는다.
 */
describe('toApproverOptions', () => {
  it('표시명과 로그인ID를 함께 낸다 — 같은 이름이 둘일 수 있다', () => {
    expect(toApproverOptions(userFixtures)[0]).toMatchObject({
      value: '9301',
      label: '합성 승인자1 · sample.user1',
      appUserId: 9301,
      approverName: '합성 승인자1',
    });
  });

  it('차례를 바꾸지 않는다 — 서버가 준 차례가 뜻일 수 있다', () => {
    expect(toApproverOptions(userFixtures).map((option) => option.appUserId)).toEqual(
      userFixtures.map((user) => user.appUserId),
    );
  });

  /**
   * 표시명이 빈 문자열로 오는 일이 실제로 있다. **내부 번호를 대신 내지 않는다** —
   * 로그인ID는 사용자가 아는 값이지만 `appUserId`는 아니다(이 저장소 이슈 #44).
   */
  it('표시명이 비면 로그인ID로 적고 내부 번호를 내지 않는다', () => {
    const options = toApproverOptions([{ ...userAt(0), appUserId: 9309, userName: '' }]);

    expect(options[0]?.label).toBe('sample.user1');
    expect(options[0]?.approverName).toBe('sample.user1');
    expect(options[0]?.label).not.toContain('9309');
  });

  it('사용 여부를 그대로 들고 온다 — 새 단계의 경고 판정 근거다', () => {
    expect(toApproverOptions(userFixtures).map((option) => option.isActive)).toEqual(
      userFixtures.map((user) => user.isActive),
    );
  });

  /**
   * **부서 이름을 지어내지 않는다.** 계약의 사용자 목록은 부서 **번호**만 준다 —
   * 단계 응답이 주는 `approverDepartmentName`에 해당하는 값이 이 목록에는 없다.
   * 새로 고른 승인자의 부서는 저장 뒤 서버 응답이 채운다.
   */
  it('부서 이름을 담지 않는다 — 사용자 목록이 주지 않는 값이다', () => {
    for (const option of toApproverOptions(userFixtures)) {
      expect(option.label).not.toContain('부서');
    }
  });
});

describe('approverNote', () => {
  it('평소에는 아무 말도 하지 않는다', () => {
    expect(approverNote(lookup())).toBeUndefined();
  });

  it('목록이 잘리면 밝힌다', () => {
    expect(approverNote(lookup({ truncated: true }))).toBe(t.notes.approverListTruncated);
  });

  it('불러오지 못하면 밝힌다', () => {
    expect(approverNote(lookup({ isError: true }))).toBe(t.notes.approverListFailed);
  });

  /**
   * **실패가 잘림보다 앞선다.** 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면 둘이 함께
   * 참이 된다 — 그때 사용자가 먼저 알아야 하는 것은 「지금 보이는 것이 낡았다」는 쪽이다.
   */
  it('실패와 잘림이 겹치면 실패를 낸다', () => {
    expect(approverNote(lookup({ isError: true, truncated: true }))).toBe(
      t.notes.approverListFailed,
    );
  });
});
