import type {
  Candidate,
  DraftRecipient,
  HandoverAlertSetting,
  HandoverAlertSettingReplace,
  SettingDraft,
} from './types';

export const toDraft = (setting: HandoverAlertSetting): SettingDraft => ({
  enabled: setting.enabled,
  zaloEnabled: setting.zaloEnabled,
  recipients: setting.recipients.map((recipient) => ({
    userId: recipient.userId,
    name: recipient.name,
    loginId: recipient.loginId,
    departmentName: recipient.departmentName ?? null,
    hasPhone: recipient.hasPhone,
    active: recipient.active,
  })),
});

/**
 * 알림을 끄면 Zalo 도 끈다 — 서버가 `zaloEnabled && !enabled` 를 400 으로 막는다(CHECK).
 * W-CO-11 은 값을 남기지만 이 표는 그 조합을 저장할 수 없다.
 */
export const setEnabled = (draft: SettingDraft, enabled: boolean): SettingDraft => ({
  ...draft,
  enabled,
  zaloEnabled: enabled ? draft.zaloEnabled : false,
});

/** 후보에서 고른 사람을 더한다. 이미 있는 사람은 다시 넣지 않는다. 후보는 활성 사용자만 온다. */
export const addRecipients = (draft: SettingDraft, picked: readonly Candidate[]): SettingDraft => {
  const present = new Set(draft.recipients.map((recipient) => recipient.userId));
  const added: DraftRecipient[] = [];

  for (const candidate of picked) {
    if (present.has(candidate.appUserId)) continue;
    present.add(candidate.appUserId);
    added.push({
      userId: candidate.appUserId,
      name: candidate.userName,
      loginId: candidate.loginId,
      departmentName: candidate.departmentName ?? null,
      hasPhone: candidate.hasPhone,
      active: true,
    });
  }

  return { ...draft, recipients: [...draft.recipients, ...added] };
};

export const removeRecipient = (draft: SettingDraft, userId: number): SettingDraft => ({
  ...draft,
  recipients: draft.recipients.filter((recipient) => recipient.userId !== userId),
});

export const noPhoneCount = (draft: SettingDraft): number =>
  draft.recipients.filter((recipient) => !recipient.hasPhone).length;

export const inactiveCount = (draft: SettingDraft): number =>
  draft.recipients.filter((recipient) => !recipient.active).length;

/** US2-5 — 켜 두었는데 받을 사람이 없다. 저장은 막지 않는다. */
export const lacksRecipients = (draft: SettingDraft): boolean =>
  draft.enabled && draft.recipients.length === 0;

export const toReplaceBody = (draft: SettingDraft): HandoverAlertSettingReplace => ({
  enabled: draft.enabled,
  zaloEnabled: draft.enabled && draft.zaloEnabled,
  recipientUserIds: draft.recipients.map((recipient) => recipient.userId),
});

/** 「고친 것이 있는가」. 수신자는 순서가 아니라 구성으로 견준다. */
export const sameDraft = (left: SettingDraft, right: SettingDraft): boolean => {
  if (left.enabled !== right.enabled || left.zaloEnabled !== right.zaloEnabled) return false;
  if (left.recipients.length !== right.recipients.length) return false;

  const ids = new Set(right.recipients.map((recipient) => recipient.userId));
  return left.recipients.every((recipient) => ids.has(recipient.userId));
};
