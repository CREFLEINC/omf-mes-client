import { describe, expect, it } from 'vitest';

import { formatPrintLog, reasonOf } from './print-log';

const entry = {
  at: '2026-09-03T10:00:00.000Z',
  label: 'LOT-0001',
  available: [] as string[],
  deviceName: null,
  reason: '프린터를 찾을 수 없다',
};

describe('인쇄 진단 기록', () => {
  // ⚠ 현장 단말은 키오스크라 이 파일이 사유를 아는 유일한 자리다.
  it('프린터가 하나도 없었다는 사실을 남긴다', () => {
    expect(formatPrintLog(entry)).toContain('단말 프린터=(없음)');
    expect(formatPrintLog(entry)).toContain('고른 프린터=(못 고름)');
  });

  it('여럿이었으면 이름을 모두 남긴다 — 기본이 없던 것인지 가려야 한다', () => {
    const line = formatPrintLog({ ...entry, available: ['TSC TH240', 'Microsoft Print to PDF'] });

    expect(line).toContain('TSC TH240 | Microsoft Print to PDF');
  });

  it('한 줄로 끝난다 — 실패 한 건의 경계가 흐려지지 않는다', () => {
    expect(formatPrintLog(entry).split('\n').filter(Boolean)).toHaveLength(1);
  });

  it('말 없는 실패도 빈 사유로 남기지 않는다', () => {
    expect(reasonOf(new Error(''))).not.toBe('');
    expect(reasonOf('종이 없음')).toBe('종이 없음');
  });
});
