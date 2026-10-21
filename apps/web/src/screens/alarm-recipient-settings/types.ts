import type {
  components,
  NotificationEventForward,
  NotificationSetting,
  NotificationSettingRecipient,
  NotificationSettingReplace,
  NotificationSettingSummary,
  NotificationSettingSummaryItem,
  RecipientCandidate,
  RecipientCandidatePage,
} from '@omf-mes/api-client';

/**
 * W-CO-11 — 부서 × 이벤트 알림 설정(001 재설계). 수신자는 개인 지정만 있다(결정 #19).
 * api-client 는 `import type` 으로만 참조한다.
 */
export type NotificationEvent = NotificationEventForward;
export type Department = components['schemas']['Department'];
export type SettingSummary = NotificationSettingSummary;
export type SettingSummaryItem = NotificationSettingSummaryItem;
export type Setting = NotificationSetting;
export type SettingRecipient = NotificationSettingRecipient;
export type SettingReplace = NotificationSettingReplace;
export type Candidate = RecipientCandidate;
export type CandidatePage = RecipientCandidatePage;

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
