import type { ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.iqcSkipApproval;

/** 표에 없는 코드는 그대로 돌려준다 — 화면이 이름을 짓지 않는다. */
const lookup = (table: Readonly<Record<string, string>>, code: string): string =>
  table[code] ?? code;

/** 승인 유형 코드 → 사용자 용어(`IQC_SKIP` → 「IQC 생략」). */
export const approvalTypeLabelOf = (code: string): string => lookup(t.labels.approvalType, code);

/**
 * 대상 표시명의 앞머리 유형 코드만 사용자 용어로 바꾼다(「INBOUND_LOT #12」 → 「입하 LOT #12」).
 * 표시명이 그 코드로 시작하지 않으면 서버 값 그대로다.
 */
export const targetLabelOf = (displayName: string, targetTypeCode: string): string => {
  const label = lookup(t.labels.targetType, targetTypeCode);
  if (label === targetTypeCode || !displayName.startsWith(targetTypeCode)) return displayName;
  return label + displayName.slice(targetTypeCode.length);
};

export interface StatusBadge {
  label: string;
  tone: ChipStatus;
}

const STATUS_TONE: Readonly<Record<string, ChipStatus>> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

/** 요청 상태·단계 결재 결과 → 배지. 대기 주황 · 승인 초록 · 반려 빨강, 모르는 값은 회색에 코드 그대로. */
export const statusBadgeOf = (code: string): StatusBadge => ({
  label: lookup(t.labels.status, code),
  tone: STATUS_TONE[code] ?? 'idle',
});
