import type {
  Candidate,
  NotificationEvent,
  Setting,
  SettingDraft,
  SettingRecipient,
  SettingReplace,
} from './types';

/**
 * 결재 이벤트는 그 차례의 결재자가 받는다 — 수신자를 정할 수 없다(FR-010).
 * 이벤트를 아직 못 찾았으면(카탈로그 조회 전) 정할 수 있는 쪽으로 읽는다.
 */
export const isApproverEvent = (event: NotificationEvent | undefined): boolean =>
  event?.recipientMode === 'APPROVER';

export const toDraft = (setting: Setting): SettingDraft => ({
  enabled: setting.enabled,
  zaloEnabled: setting.zaloEnabled,
  recipients: setting.recipients,
});

/** 후보에서 고른 사람을 더한다. 이미 있는 사람은 다시 넣지 않는다 — 중복은 서버도 거절한다. */
export const addRecipients = (draft: SettingDraft, picked: readonly Candidate[]): SettingDraft => {
  const present = new Set(draft.recipients.map((recipient) => recipient.appUserId));
  const added: SettingRecipient[] = [];

  for (const candidate of picked) {
    if (present.has(candidate.appUserId)) continue;
    present.add(candidate.appUserId);
    /* 후보는 활성 사용자만 온다(계약). */
    added.push({ ...candidate, active: true });
  }

  return { ...draft, recipients: [...draft.recipients, ...added] };
};

export const removeRecipient = (draft: SettingDraft, appUserId: number): SettingDraft => ({
  ...draft,
  recipients: draft.recipients.filter((recipient) => recipient.appUserId !== appUserId),
});

/** US4-5 — 전화번호가 없는 수신자는 Zalo 를 받지 못하고 알림센터로만 받는다. */
export const noPhoneCount = (draft: SettingDraft): number =>
  draft.recipients.filter((recipient) => !recipient.hasPhone).length;

/** US4-4 — 켜 두었는데 받을 사람이 없다. 결재 이벤트는 결재자가 받으므로 해당하지 않는다. */
export const lacksRecipients = (draft: SettingDraft, approver: boolean): boolean =>
  draft.enabled && !approver && draft.recipients.length === 0;

/** 비활성 사용자는 수신자로 둘 수 없다 — 서버도 400 으로 막는다. 화면이 먼저 알린다. */
export const hasInactiveRecipient = (draft: SettingDraft): boolean =>
  draft.recipients.some((recipient) => !recipient.active);

/**
 * 저장 본문. 결재 이벤트에는 수신자를 싣지 않는다(서버 `RECIPIENTS_NOT_ALLOWED`).
 *
 * ⭐ 알림을 끄더라도 Zalo 값은 그대로 싣는다 — Switch 를 잠글 뿐 값을 지우지 않는다.
 * 지우면 다시 켰을 때 사용자가 정한 적 없는 값으로 돌아가 있다.
 */
export const toReplaceBody = (draft: SettingDraft, approver: boolean): SettingReplace => ({
  enabled: draft.enabled,
  zaloEnabled: draft.zaloEnabled,
  recipientUserIds: approver ? [] : draft.recipients.map((recipient) => recipient.appUserId),
});

/** 「고친 것이 있는가」. 수신자는 순서가 아니라 구성으로 견준다 — 서버가 순서를 지키지 않는다. */
export const sameDraft = (left: SettingDraft, right: SettingDraft): boolean => {
  if (left.enabled !== right.enabled || left.zaloEnabled !== right.zaloEnabled) return false;
  if (left.recipients.length !== right.recipients.length) return false;

  const ids = new Set(right.recipients.map((recipient) => recipient.appUserId));
  return left.recipients.every((recipient) => ids.has(recipient.appUserId));
};
