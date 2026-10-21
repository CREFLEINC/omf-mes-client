import type { components } from '@omf-mes/api-client';

/**
 * W-CO-11 — 부서 × 이벤트 알림 설정(001 재설계). 수신자는 개인 지정만 있다(결정 #19).
 * api-client 는 `import type` 으로만 참조한다.
 */
type Schemas = components['schemas'];

export type NotificationEvent = Schemas['NotificationEvent'];
export type Department = Schemas['Department'];
export type SettingSummary = Schemas['NotificationSettingSummary'];
export type SettingSummaryItem = SettingSummary['items'][number];
export type Setting = Schemas['NotificationSetting'];
export type SettingRecipient = Setting['recipients'][number];
export type SettingReplace = Schemas['NotificationSettingReplace'];
export type CandidatePage = Schemas['RecipientCandidatePage'];
export type Candidate = CandidatePage['items'][number];

/**
 * 고치는 중인 한 행. 수신자는 표시에 필요한 칸을 함께 든다 — 후보에서 고른 사람도 저장 전에
 * 이름·부서·전화번호 여부가 보여야 한다.
 */
export interface SettingDraft {
  enabled: boolean;
  zaloEnabled: boolean;
  recipients: SettingRecipient[];
}

export interface Option {
  value: string;
  label: string;
}
