import type { components } from '@omf-mes/api-client';

/**
 * W-CO-14 — 공장 × 인계 작업 종류 알림 설정(피처 002). 수신자는 최대 5명이다(FR-007).
 * api-client 는 `import type` 으로만 참조한다.
 */
export type HandoverAlertType = components['schemas']['HandoverAlertType'];
export type HandoverAlertSetting = components['schemas']['HandoverAlertSetting'];
export type HandoverAlertRecipient = HandoverAlertSetting['recipients'][number];
export type HandoverAlertSettingReplace = components['schemas']['HandoverAlertSettingReplace'];
export type SettingSummary = components['schemas']['HandoverAlertSettingSummary'];
export type SettingSummaryItem = SettingSummary['items'][number];
export type Plant = components['schemas']['Plant'];
export type CandidatePage = components['schemas']['RecipientCandidatePage'];
export type Candidate = CandidatePage['items'][number];

/** 한 종류의 담당자 최대 인원(FR-007, 서버도 400 `RECIPIENT_LIMIT`). */
export const MAX_RECIPIENTS = 5;

/** 고치는 중인 수신자. 후보에서 고른 사람도 저장 전에 이름·부서·전화번호 여부가 보여야 한다. */
export interface DraftRecipient {
  userId: number;
  name: string;
  loginId: string;
  departmentName: string | null;
  hasPhone: boolean;
  active: boolean;
}

export interface SettingDraft {
  enabled: boolean;
  zaloEnabled: boolean;
  recipients: DraftRecipient[];
}

export interface Option {
  value: string;
  label: string;
}
