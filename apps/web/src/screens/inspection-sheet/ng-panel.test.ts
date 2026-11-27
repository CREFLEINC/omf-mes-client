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

  /* omf-all-around#364 — 칸의 글자는 공장 시각(+07:00)이다. 브라우저가 한국이어도 같은 순간으로 오간다. */
  it('수리 일시 칸은 공장 시각으로 보이고 공장 시각으로 읽힌다 — 브라우저가 한국이어도', () => {
    const originalTz = process.env.TZ;
    process.env.TZ = 'Asia/Seoul';
    try {
      expect(toLocalInput('2026-11-27T04:53:00.000Z')).toBe('2026-11-27T11:53');

      const [body] = toNgBody([
        {
          key: 'ng-2',
          foundDepartmentCode: null,
          foundStepCode: null,
          occurrenceProcessText: null,
          standardNo: null,
          checkItemCode: null,
          ngContent: 'x',
          investigationText: null,
          ngTypeCode: null,
          repairDepartmentCode: null,
          repairWorkerNo: null,
          repairedAt: '2026-11-27T11:53',
          recheckResultCode: null,
          recheckWorkerNo: null,
          recheckedAt: '',
        },
      ]);

      expect(body?.repairedAt).toBe('2026-11-27T04:53:00.000Z');
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });
});
