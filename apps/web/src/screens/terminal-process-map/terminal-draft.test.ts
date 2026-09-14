import { describe, expect, it } from 'vitest';

import { EMPTY_TERMINAL, toCreateBody, toUpdateBody, validateTerminal } from './terminal-draft';

const filled = {
  ...EMPTY_TERMINAL,
  terminalCode: 'FR002V2-POP-NEW',
  plant: '3',
  terminalTypeCode: 'POP',
};

describe('단말 운영 상태', () => {
  it('신규 등록에는 상태 입력을 요구하지 않고 계약 기본 RUNNING을 보낸다', () => {
    expect(validateTerminal(filled, true).statusCode).toBeUndefined();
    expect(toCreateBody({ ...filled, statusCode: 'READY' })).toEqual({
      terminalCode: 'FR002V2-POP-NEW',
      plantId: 3,
      terminalTypeCode: 'POP',
      statusCode: 'RUNNING',
      equipmentId: null,
    });
  });

  it('수정에서는 운영 상태를 반드시 입력하고 그대로 보낸다', () => {
    expect(validateTerminal(filled, false).statusCode).toBeDefined();
    expect(validateTerminal({ ...filled, statusCode: 'STOPPED' }, false).statusCode).toBeUndefined();
    expect(toUpdateBody({ ...filled, statusCode: 'STOPPED' }).statusCode).toBe('STOPPED');
  });
});
