import { describe, expect, it } from 'vitest';

import { hasDraftErrors, sameRecipients, toDraft, toReplaceBody, validateDraft } from './draft';
import type { RecipientDraft } from './types';

const roleDraft = (patch: Partial<RecipientDraft> = {}): RecipientDraft => ({
  key: 'role-1',
  recipientTypeCode: 'ROLE',
  businessUnitId: '21',
  roleId: '31',
  userId: '',
  ...patch,
});

describe('알람 수신 규칙 초안', () => {
  it('조직·역할과 개인의 필수값을 서로 섞지 않는다', () => {
    const errors = validateDraft([
      roleDraft({ businessUnitId: '' }),
      roleDraft({ key: 'user-1', recipientTypeCode: 'USER', userId: '' }),
    ]);

    expect(errors[0]?.businessUnitId).toBeDefined();
    expect(errors[0]?.userId).toBeUndefined();
    expect(errors[1]?.userId).toBeDefined();
    expect(errors[1]?.businessUnitId).toBeUndefined();
  });

  it('같은 조직·역할과 같은 개인을 중복으로 두지 않는다', () => {
    const errors = validateDraft([
      roleDraft(),
      roleDraft({ key: 'role-2' }),
      roleDraft({ key: 'user-1', recipientTypeCode: 'USER', userId: '41' }),
      roleDraft({ key: 'user-2', recipientTypeCode: 'USER', userId: '41' }),
    ]);

    expect(errors.every((error) => error.duplicate !== undefined)).toBe(true);
    expect(hasDraftErrors(errors)).toBe(true);
  });

  it('전체 교체 본문에는 선택 방식의 짝 필드만 싣는다', () => {
    const body = toReplaceBody([
      roleDraft(),
      roleDraft({ key: 'user-1', recipientTypeCode: 'USER', userId: '41' }),
    ]);

    expect(body).toEqual({
      recipients: [
        { recipientTypeCode: 'ROLE', businessUnitId: 21, roleId: 31 },
        { recipientTypeCode: 'USER', userId: 41 },
      ],
      zaloEnabled: false,
    });
  });

  it('수신 규칙만 바꿀 때 서버의 기존 Zalo 값을 보존한다', () => {
    expect(toReplaceBody([roleDraft()], true).zaloEnabled).toBe(true);
  });

  it('서버 값을 왕복해도 같은 기준값으로 판정한다', () => {
    const first = toDraft([{ recipientTypeCode: 'ROLE', businessUnitId: 21, roleId: 31 }]);
    const second = toDraft([{ recipientTypeCode: 'ROLE', businessUnitId: 21, roleId: 31 }]);

    expect(sameRecipients(first, second)).toBe(true);
    expect(sameRecipients(first, [])).toBe(false);
  });
});
