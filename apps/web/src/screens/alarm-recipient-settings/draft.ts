import { messages } from '@omf-mes/i18n';

import { createLocalKey } from '../../patterns/local-key';
import type {
  DraftError,
  NotificationRecipient,
  NotificationSubscriptionReplace,
  RecipientDraft,
} from './types';

const t = messages.alarmRecipientSettings;

export const emptyRecipient = (key = createLocalKey()): RecipientDraft => ({
  key,
  recipientTypeCode: 'ROLE',
  businessUnitId: '',
  roleId: '',
  userId: '',
});

export const toDraft = (recipients: readonly NotificationRecipient[]): RecipientDraft[] =>
  recipients.map((recipient, index) => ({
    key: `${recipient.recipientTypeCode}-${String(recipient.businessUnitId ?? '')}-${String(recipient.roleId ?? '')}-${String(recipient.userId ?? '')}-${String(index)}`,
    recipientTypeCode: recipient.recipientTypeCode,
    businessUnitId: recipient.businessUnitId === undefined ? '' : String(recipient.businessUnitId),
    roleId: recipient.roleId === undefined ? '' : String(recipient.roleId),
    userId: recipient.userId === undefined ? '' : String(recipient.userId),
  }));

const signature = (recipient: RecipientDraft): string =>
  recipient.recipientTypeCode === 'ROLE'
    ? `ROLE:${recipient.businessUnitId}:${recipient.roleId}`
    : `USER:${recipient.userId}`;

export const validateDraft = (recipients: readonly RecipientDraft[]): DraftError[] => {
  const counts = new Map<string, number>();
  recipients.forEach((recipient) => {
    const key = signature(recipient);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return recipients.map((recipient) => ({
    ...(recipient.recipientTypeCode === 'ROLE' && recipient.businessUnitId === ''
      ? { businessUnitId: t.errors.requiredBusinessUnit }
      : {}),
    ...(recipient.recipientTypeCode === 'ROLE' && recipient.roleId === ''
      ? { roleId: t.errors.requiredRole }
      : {}),
    ...(recipient.recipientTypeCode === 'USER' && recipient.userId === ''
      ? { userId: t.errors.requiredUser }
      : {}),
    ...((counts.get(signature(recipient)) ?? 0) > 1 ? { duplicate: t.errors.duplicate } : {}),
  }));
};

export const hasDraftErrors = (errors: readonly DraftError[]): boolean =>
  errors.some((error) => Object.keys(error).length > 0);

export const toReplaceBody = (
  recipients: readonly RecipientDraft[],
  zaloEnabled = false,
): NotificationSubscriptionReplace => ({
  recipients: recipients.map((recipient) =>
    recipient.recipientTypeCode === 'ROLE'
      ? {
          recipientTypeCode: 'ROLE',
          businessUnitId: Number(recipient.businessUnitId),
          roleId: Number(recipient.roleId),
        }
      : { recipientTypeCode: 'USER', userId: Number(recipient.userId) },
  ),
  zaloEnabled,
});

export const sameRecipients = (
  left: readonly RecipientDraft[],
  right: readonly RecipientDraft[],
): boolean =>
  left.length === right.length &&
  left.every((recipient, index) => {
    const counterpart = right[index];
    return counterpart !== undefined && signature(recipient) === signature(counterpart);
  });
