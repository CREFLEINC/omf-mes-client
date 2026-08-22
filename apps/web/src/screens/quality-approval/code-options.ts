import { messages } from '@omf-mes/i18n';

export interface CodeOption {
  value: string;
  label: string;
}

/** 서버 기준값 통지가 오기 전에는 값을 추측해 채우지 않는다. */
export const QUALITY_APPROVAL_TYPE_CODES: readonly string[] = [];
export const QUALITY_APPROVAL_STATUS_CODES: readonly string[] = [];

export const toCodeOptions = (codes: readonly string[]): CodeOption[] =>
  codes.map((code) => ({ value: code, label: code }));

export const approvalScopeWarning = (codes: readonly string[]): string | undefined =>
  codes.length === 0 ? messages.qualityApproval.scopeWarning : undefined;
