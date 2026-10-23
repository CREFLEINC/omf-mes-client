import type { ChipStatus } from '@crefle/web-ui';
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

/** 승인 유형 코드 → 사용자 용어(`CONCESSION` → 「특채」). 모르는 코드는 원문 그대로 둔다. */
export const approvalTypeLabelOf = (code: string): string =>
  (messages.qualityApproval.typeLabels as Record<string, string | undefined>)[code] ?? code;

export interface StatusBadge {
  label: string;
  tone: ChipStatus;
}

const STATUS_TONE: Readonly<Record<string, ChipStatus>> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

/** 요청 상태 코드 → 배지(#144). 대기 주황 · 승인 초록 · 반려 빨강, 모르는 값은 회색에 코드 그대로. */
export const statusBadgeOf = (code: string): StatusBadge => ({
  label:
    (messages.qualityApproval.statusLabels as Record<string, string | undefined>)[code] ?? code,
  tone: STATUS_TONE[code] ?? 'idle',
});

/** 승인 유형 탭의 선택지 — 이름은 사용자 용어로 보인다. */
export const toTypeOptions = (codes: readonly string[]): CodeOption[] =>
  codes.map((code) => ({ value: code, label: approvalTypeLabelOf(code) }));

export const approvalScopeWarning = (codes: readonly string[]): string | undefined =>
  codes.length === 0 ? messages.qualityApproval.scopeWarning : undefined;
