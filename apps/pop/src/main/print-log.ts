/**
 * 인쇄 진단 기록 — **화면 대신 파일에 남긴다.**
 *
 * ⛔ **기술 오류 문구를 사용자에게 보이지 않는다**(사용자 지시 2026-09-03). 그렇다고 사유를
 *    버리면 현장 단말은 키오스크라 개발자도구도 주소창도 없어 **무슨 일이 났는지 알 방법이
 *    사라진다.** 그래서 화면에서 뺀 것을 여기에 둔다 — 사람이 나중에 파일로 읽는다.
 *
 * ⚠ **인쇄가 실패한 회차만 적는다.** 성공까지 적으면 몇 달 도는 단말에서 파일이 계속 자라고,
 *    정작 찾으려는 실패가 그 사이에 묻힌다.
 */

export interface PrintLogEntry {
  at: string;
  /** 어느 출력물이었나. 현장에서 종이와 맞춰 보는 값이다. */
  label: string;
  /** 단말이 알려 준 프린터. **비어 있는지 여럿인지가 사유를 가른다.** */
  available: readonly string[];
  /** 고른 프린터. 못 골랐으면 `null`. */
  deviceName: string | null;
  reason: string;
}

/** 한 줄로 만든다 — 여러 줄로 적으면 실패 한 건의 경계가 흐려진다. */
export function formatPrintLog(entry: PrintLogEntry): string {
  const printers = entry.available.length === 0 ? '(없음)' : entry.available.join(' | ');
  const chosen = entry.deviceName ?? '(못 고름)';

  return `${entry.at}\t${entry.label}\t고른 프린터=${chosen}\t단말 프린터=${printers}\t사유=${entry.reason}\n`;
}

/** 예외에서 사람이 읽을 사유를 뽑는다. 말 없는 실패도 빈 줄로 남기지 않는다. */
export function reasonOf(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;

  return String(error);
}
