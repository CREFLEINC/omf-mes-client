import { describe, expect, it } from 'vitest';

import {
  addRecipients,
  hasInactiveRecipient,
  isApproverEvent,
  lacksRecipients,
  noPhoneCount,
  removeRecipient,
  sameDraft,
  toDraft,
  toReplaceBody,
} from './draft';
import type { SettingDraft, SettingRecipient } from './types';

const recipient = (appUserId: number, overrides: Partial<SettingRecipient> = {}) => ({
  appUserId,
  loginId: `syn.user.${String(appUserId)}`,
  userName: `합성 사용자 ${String(appUserId)}`,
  departmentName: '합성 부서',
  active: true,
  hasPhone: true,
  ...overrides,
});

const draft = (overrides: Partial<SettingDraft> = {}): SettingDraft => ({
  enabled: true,
  zaloEnabled: false,
  recipients: [recipient(41)],
  ...overrides,
});

describe('isApproverEvent', () => {
  it('결재 이벤트만 결재자 수신이다 — 칸이 없으면 수신자를 정하는 쪽으로 읽는다', () => {
    expect(isApproverEvent({ eventCode: 'A', eventName: 'a', recipientMode: 'APPROVER' })).toBe(
      true,
    );
    expect(isApproverEvent({ eventCode: 'B', eventName: 'b', recipientMode: 'CONFIGURED' })).toBe(
      false,
    );
    expect(isApproverEvent({ eventCode: 'C', eventName: 'c' })).toBe(false);
    expect(isApproverEvent(undefined)).toBe(false);
  });
});

describe('toDraft', () => {
  it('상세의 켜기·Zalo·수신자를 그대로 든다', () => {
    expect(
      toDraft({
        departmentId: 7,
        eventCode: 'WORK_ORDER_CLOSED',
        enabled: true,
        zaloEnabled: true,
        recipients: [recipient(41)],
      }),
    ).toEqual({ enabled: true, zaloEnabled: true, recipients: [recipient(41)] });
  });
});

describe('addRecipients · removeRecipient', () => {
  it('고른 후보를 더하되 이미 있는 사람은 다시 넣지 않는다', () => {
    const next = addRecipients(draft(), [
      { appUserId: 41, loginId: 'x', userName: 'x', departmentName: null, hasPhone: true },
      { appUserId: 42, loginId: 'y', userName: 'y', departmentName: null, hasPhone: false },
      { appUserId: 42, loginId: 'y', userName: 'y', departmentName: null, hasPhone: false },
    ]);

    expect(next.recipients.map((item) => item.appUserId)).toEqual([41, 42]);
    expect(next.recipients[1]).toMatchObject({ active: true, hasPhone: false });
  });

  it('해제하면 그 사람만 빠진다', () => {
    const next = removeRecipient(draft({ recipients: [recipient(41), recipient(42)] }), 41);

    expect(next.recipients.map((item) => item.appUserId)).toEqual([42]);
  });
});

describe('경고·안내 판정', () => {
  it('US4-4 켬 + 수신자 0명이면 경고 대상이다', () => {
    expect(lacksRecipients(draft({ recipients: [] }), false)).toBe(true);
    expect(lacksRecipients(draft({ enabled: false, recipients: [] }), false)).toBe(false);
    expect(lacksRecipients(draft(), false)).toBe(false);
  });

  it('결재 이벤트는 수신자가 없어도 경고하지 않는다 — 결재자가 받는다', () => {
    expect(lacksRecipients(draft({ recipients: [] }), true)).toBe(false);
  });

  it('US4-5 전화번호가 없는 수신자 수를 센다', () => {
    expect(
      noPhoneCount(draft({ recipients: [recipient(41, { hasPhone: false }), recipient(42)] })),
    ).toBe(1);
  });

  it('비활성 수신자가 있는지 가른다', () => {
    expect(hasInactiveRecipient(draft({ recipients: [recipient(41, { active: false })] }))).toBe(
      true,
    );
    expect(hasInactiveRecipient(draft())).toBe(false);
  });
});

describe('toReplaceBody', () => {
  it('켜기·Zalo·수신자 번호를 싣는다', () => {
    expect(toReplaceBody(draft({ zaloEnabled: true }), false)).toEqual({
      enabled: true,
      zaloEnabled: true,
      recipientUserIds: [41],
    });
  });

  it('결재 이벤트에는 수신자를 싣지 않는다 — 서버가 RECIPIENTS_NOT_ALLOWED 로 거절한다', () => {
    expect(toReplaceBody(draft(), true).recipientUserIds).toEqual([]);
  });

  it('알림을 꺼도 Zalo 값은 지우지 않는다', () => {
    expect(toReplaceBody(draft({ enabled: false, zaloEnabled: true }), false).zaloEnabled).toBe(
      true,
    );
  });
});

describe('sameDraft', () => {
  it('수신자 순서가 달라도 구성이 같으면 같다', () => {
    expect(
      sameDraft(
        draft({ recipients: [recipient(41), recipient(42)] }),
        draft({ recipients: [recipient(42), recipient(41)] }),
      ),
    ).toBe(true);
  });

  it.each<[string, Partial<SettingDraft>]>([
    ['enabled', { enabled: false }],
    ['zaloEnabled', { zaloEnabled: true }],
    ['recipients', { recipients: [recipient(42)] }],
  ])('%s 가 다르면 다르다', (_field, patch) => {
    expect(sameDraft(draft(), draft(patch))).toBe(false);
  });
});
