import { describe, expect, it } from 'vitest';

import { type NgDraft, toLocalInput, toNgBody } from './ng-panel';

describe('NG 블록 보낼 모양', () => {
  it('빈 글자는 null 로, 날짜 입력칸은 ISO 로 바꾸고 화면 열쇠는 뺀다', () => {
    const draft: NgDraft = {
      key: 'ng-1',
      foundDepartmentCode: 'QUALITY',
      foundStepCode: 'PROCESS_1',
      occurrenceProcessText: '  ',
      standardNo: null,
      checkItemCode: ' S 403 ',
      ngContent: ' 배선 정리 불량 ',
      investigationText: '',
      ngTypeCode: 'WORK',
      repairDepartmentCode: 'PRODUCTION',
      repairWorkerNo: '901463',
      repairedAt: toLocalInput('2026-10-21T03:15:00.000Z'),
      recheckResultCode: 'OK',
      recheckWorkerNo: null,
      recheckedAt: '',
    };

    const [body] = toNgBody([draft]);

    expect(body).not.toHaveProperty('key');
    expect(body).toMatchObject({
      occurrenceProcessText: null,
      checkItemCode: 'S 403',
      ngContent: '배선 정리 불량',
      investigationText: null,
      repairWorkerNo: '901463',
      repairedAt: '2026-10-21T03:15:00.000Z',
      recheckedAt: null,
    });
  });
});
