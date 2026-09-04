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

/**
 * 단말이 알려 준 프린터 한 대. **드라이버 이름과 보이는 이름을 따로 적는다** — 지정할 때
 * 무엇을 써야 하는지가 이 둘 중 하나이고, 둘이 다른 경우가 실제로 있다.
 */
export interface LoggedPrinter {
  name: string;
  displayName?: string;
  isDefault?: boolean;
}

export interface PrintLogEntry {
  at: string;
  /** 어느 출력물이었나. 현장에서 종이와 맞춰 보는 값이다. */
  label: string;
  /** 단말이 알려 준 프린터 전부. **비어 있는지 여럿인지가 사유를 가른다.** */
  available: readonly LoggedPrinter[];
  /** 고른 프린터. 못 골랐으면 `null`. */
  deviceName: string | null;
  /**
   * 이 회차에 실제로 읽힌 지정값. **`(없음)` 이면 환경변수가 앱까지 오지 않은 것이다** —
   * Windows 는 새 사용자 변수를 탐색기가 다시 뜨기 전까지 물려주지 않아, 값을 넣었는데도
   * 앱은 못 본 상태가 생긴다. 그 구분을 로그에서 바로 해야 한 번에 끝난다.
   */
  preferred: string | undefined;
  reason: string;
}

/** 프린터 한 대를 한 토막으로. 이름이 둘이면 둘 다, 기본 표시가 있으면 그것까지 적는다. */
const describe = (printer: LoggedPrinter): string => {
  const shown =
    printer.displayName === undefined || printer.displayName === printer.name
      ? printer.name
      : `${printer.name} (보이는이름=${printer.displayName})`;

  return printer.isDefault === true ? `${shown} [기본]` : shown;
};

/** 한 줄로 만든다 — 여러 줄로 적으면 실패 한 건의 경계가 흐려진다. */
export function formatPrintLog(entry: PrintLogEntry): string {
  const printers =
    entry.available.length === 0 ? '(없음)' : entry.available.map(describe).join(' | ');
  const chosen = entry.deviceName ?? '(못 고름)';
  const preferred =
    entry.preferred === undefined || entry.preferred === '' ? '(없음)' : entry.preferred;

  return `${entry.at}\t${entry.label}\t지정값=${preferred}\t고른 프린터=${chosen}\t단말 프린터=${printers}\t사유=${entry.reason}\n`;
}

/** 예외에서 사람이 읽을 사유를 뽑는다. 말 없는 실패도 빈 줄로 남기지 않는다. */
export function reasonOf(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;

  return String(error);
}
