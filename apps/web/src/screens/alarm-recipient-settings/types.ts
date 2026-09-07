import type { components } from '@omf-mes/api-client';

export type NotificationEvent = components['schemas']['NotificationEvent'];
export type NotificationSubscription = components['schemas']['NotificationSubscription'];
export type NotificationRecipient = components['schemas']['NotificationRecipient'];
export type NotificationSubscriptionReplace =
  components['schemas']['NotificationSubscriptionReplace'];
export type AppUser = components['schemas']['AppUser'];
export type Role = components['schemas']['Role'];
export type BusinessUnit = components['schemas']['BusinessUnit'];

export interface RecipientDraft {
  key: string;
  recipientTypeCode: 'ROLE' | 'USER';
  businessUnitId: string;
  roleId: string;
  userId: string;
}

export interface DraftError {
  businessUnitId?: string;
  roleId?: string;
  userId?: string;
  duplicate?: string;
}

export interface Option {
  value: string;
  label: string;
}

export interface PreviewResult {
  resolvedAt: string;
  totalCount: number;
  users: {
    userId: number;
    userName: string;
    departmentName?: string | null;
    isActive: boolean;
  }[];
}
