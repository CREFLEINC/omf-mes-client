import { describe, expect, it } from 'vitest';

import { type PrintLogEntry, formatPrintLog, reasonOf } from './print-log';

const entry: PrintLogEntry = {
  at: '2026-09-03T10:00:00.000Z',
  label: 'LOT-0001',
  available: [],
  deviceName: null,
  preferred: undefined,
  reason: '프린터를 찾을 수 없다',
};

describe('인쇄 진단 기록', () => {
  // ⚠ 현장 단말은 키오스크라 이 파일이 사유를 아는 유일한 자리다.
  it('프린터가 하나도 없었다는 사실을 남긴다', () => {
    expect(formatPrintLog(entry)).toContain('단말 프린터=(없음)');
    expect(formatPrintLog(entry)).toContain('고른 프린터=(못 고름)');
  });

  it('여럿이었으면 이름을 모두 남긴다 — 기본이 없던 것인지 가려야 한다', () => {
    const line = formatPrintLog({
      ...entry,
      available: [{ name: 'TSC TH240' }, { name: 'Microsoft Print to PDF' }],
    });

    expect(line).toContain('TSC TH240 | Microsoft Print to PDF');
  });

  // ⚠ 기본 표시와 보이는 이름이 사유를 가르는 값이다 — 둘 다 남는지 못박는다.
  it('기본 표시와 보이는 이름을 함께 남긴다', () => {
    const line = formatPrintLog({
      ...entry,
      available: [{ name: 'TSC_TH240', displayName: 'TSC TH240', isDefault: true }],
    });

    expect(line).toContain('TSC_TH240 (보이는이름=TSC TH240) [기본]');
  });

  // ⛔ 환경변수가 앱까지 왔는지 로그에서 갈려야 한 번에 끝난다.
  it('지정값이 앱까지 오지 않았으면 그렇게 남긴다', () => {
    expect(formatPrintLog(entry)).toContain('지정값=(없음)');
    expect(formatPrintLog({ ...entry, preferred: 'TSC TH240' })).toContain('지정값=TSC TH240');
  });

  it('한 줄로 끝난다 — 실패 한 건의 경계가 흐려지지 않는다', () => {
    expect(formatPrintLog(entry).split('\n').filter(Boolean)).toHaveLength(1);
  });

  it('말 없는 실패도 빈 사유로 남기지 않는다', () => {
    expect(reasonOf(new Error(''))).not.toBe('');
    expect(reasonOf('종이 없음')).toBe('종이 없음');
  });
});
