import { messages } from '@omf-mes/i18n';

export interface CodeOption {
  value: string;
  label: string;
}

/**
 * 서버 기준값 통지가 오기 전에는 값을 추측해 채우지 않는다.
 * ⭐ 특채(`CONCESSION`)는 서버가 정한 값이다(omf-all-around#84 · 서버 장부 P-79) — 처분 판정 처리(W-03-10)가 요청한다.
 * ⭐ OQC 생략(`OQC_SKIP`)은 서버가 정한 값이다(omf-all-around#119 · 서버 장부 P-83) — OQC 출하검사 판정(W-04-03)이 요청한다.
 */
export const QUALITY_APPROVAL_TYPE_CODES: readonly string[] = ['CONCESSION', 'OQC_SKIP'];
export const QUALITY_APPROVAL_STATUS_CODES: readonly string[] = [];

export const toCodeOptions = (codes: readonly string[]): CodeOption[] =>
  codes.map((code) => ({ value: code, label: code }));

export const approvalScopeWarning = (codes: readonly string[]): string | undefined =>
  codes.length === 0 ? messages.qualityApproval.scopeWarning : undefined;
