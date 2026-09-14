import { describe, expect, it } from 'vitest';

import { statusTextOf, toTerminalView } from './types';

const terminal = {
  terminalId: 77,
  terminalCode: 'FR007-MOBILE',
  plantId: 7,
  terminalTypeCode: 'MOBILE',
  statusCode: 'RUNNING',
  isActive: true,
  equipmentId: null,
  equipmentCode: null,
  equipmentName: null,
  tokenVersion: 1,
};

describe('단말 등록 확인 표시', () => {
  it('가동 상태와 별도로 서버 미등록·등록 완료를 옮긴다', () => {
    const unregistered = toTerminalView({
      ...terminal,
      registrationStatusCode: 'UNREGISTERED',
      registrationConfirmedAt: null,
    });
    const registered = toTerminalView({
      ...terminal,
      registrationStatusCode: 'REGISTERED',
      registrationConfirmedAt: '2026-09-14T09:00:00Z',
    });

    expect(unregistered.statusCode).toBe('RUNNING');
    expect(unregistered.registrationStatusCode).toBe('UNREGISTERED');
    expect(registered.registrationStatusCode).toBe('REGISTERED');
    expect(registered.registrationConfirmedAt).toBe('2026-09-14T09:00:00Z');
  });

  it('옛 응답에 등록 필드가 없으면 등록 완료로 추정하지 않는다', () => {
    const view = toTerminalView(terminal);
    expect(view.registrationStatusCode).toBeNull();
    expect(view.registrationConfirmedAt).toBeNull();
  });

  it('미등록은 운영 RUNNING보다 먼저 보이고 등록 완료일 때만 운영 상태를 보인다', () => {
    const labels = { unregistered: '미등록', unknown: '확인 전' };
    expect(statusTextOf(toTerminalView({ ...terminal, registrationStatusCode: 'UNREGISTERED' }), labels)).toBe('미등록');
    expect(statusTextOf(toTerminalView({ ...terminal, registrationStatusCode: 'REGISTERED' }), labels)).toBe('RUNNING');
    expect(statusTextOf(toTerminalView(terminal), labels)).toBe('확인 전');
  });
});
