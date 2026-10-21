import { setLocale } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toDefectTypes, toSessionViews, toWorkerResults, type ParticipantRow } from './crew-model';

const session = (workSessionId: number, sessionNo: number, endedAt?: string) => ({
  workSessionId,
  workOrderId: 7001,
  sessionNo,
  terminalId: 1,
  startedAt: '2026-10-20T08:00:00+09:00',
  statusCode: 'SYN',
  ...(endedAt === undefined ? {} : { endedAt }),
});
const member = (
  workSessionWorkerId: number,
  workerId: number,
  workerRoleCode: string,
  joinedAt: string,
  leftAt?: string,
) => ({
  workSessionWorkerId,
  workerId,
  workerNo: `W${String(workerId)}`,
  workerName: `작업자${String(workerId)}`,
  workerRoleCode,
  joinedAt,
  participatedMinutes: 15.25,
  ...(leftAt === undefined ? {} : { leftAt }),
});
const qty = { goodQty: 0, defectQty: 0, holdQty: 0, scrapQty: 0, reworkQty: 0 };
const result = (
  productionResultId: number,
  workerId: number,
  goodQty: number,
  extra: Record<string, unknown> = {},
) => ({
  productionResultId,
  productionResultNo: `PR-${String(productionResultId)}`,
  workOrderId: 7001,
  resultSequence: productionResultId,
  ...qty,
  goodQty,
  uomId: 1,
  resultSourceCode: 'MANUAL' as const,
  occurredAt: '2026-10-20T09:00:00+09:00',
  workerId,
  statusCode: 'SYN',
  ...extra,
});
const allocation = (workerId: number, workerRoleCode: string, goodQty: number) => ({
  workerId,
  workerNo: `W${String(workerId)}`,
  workerName: `작업자${String(workerId)}`,
  workerRoleCode,
  participatedMinutes: 30,
  shareRatio: 0.5,
  ...qty,
  goodQty,
});

describe('toSessionViews', () => {
  it('세션 번호 순, 참여자는 남은 사람·떠난 사람을 합쳐 참여 순이고 옛 역할은 부다', () => {
    const views = toSessionViews(
      [session(2, 2), session(1, 1, '2026-10-20T12:00:00+09:00')],
      new Map([
        [
          1,
          [
            member(12, 102, 'OPERATOR', '2026-10-20T09:00:00+09:00', '2026-10-20T10:00:00+09:00'),
            member(11, 101, 'MAIN', '2026-10-20T08:00:00+09:00'),
          ],
        ],
      ]),
    );

    expect(views.map((view) => [view.sessionNo, view.endedAt])).toEqual([
      [1, '2026-10-20T12:00:00+09:00'],
      [2, null],
    ]);
    expect(views[0]?.participants.map((row) => [row.workerId, row.role, row.leftAt])).toEqual([
      [101, 'MAIN', null],
      [102, 'SUB', '2026-10-20T10:00:00+09:00'],
    ]);
    expect(views[1]?.participants).toEqual([]);
  });
});

describe('toWorkerResults', () => {
  const known: ParticipantRow[] = [
    {
      workSessionWorkerId: 1,
      workerId: 105,
      workerNo: 'W105',
      workerName: '작업자105',
      role: 'MAIN',
      joinedAt: '2026-10-20T08:00:00+09:00',
      leftAt: null,
      participatedMinutes: null,
    },
  ];

  it('배분을 작업자별로 더하고, 정정된 원본은 빼며, 배분이 없으면 적은 사람의 몫이다', () => {
    const rows = toWorkerResults(
      [
        result(1, 101, 100, {
          workerAllocations: [allocation(101, 'MAIN', 60), allocation(102, 'SUB', 40)],
        }),
        /* 1 을 정정한 실적 — 1 은 세지 않는다. */
        result(2, 101, 90, {
          correctsProductionResultId: 1,
          workerAllocations: [allocation(101, 'MAIN', 50), allocation(102, 'SUB', 40)],
        }),
        result(3, 102, 10, { workerAllocations: [allocation(102, 'MAIN', 10)] }),
        result(4, 105, 7, { workerAllocations: [] }),
        /* 그 구간에 없던 참여자의 0 몫 줄은 작업자를 새로 세우지 않는다. */
        result(5, 101, 3, {
          workerAllocations: [allocation(101, 'MAIN', 3), allocation(109, 'SUB', 0)],
        }),
      ],
      known,
    );

    expect(rows.map((row) => [row.workerId, row.role, row.goodQty, row.workerName])).toEqual([
      [101, 'MAIN', 53, '작업자101'],
      [102, 'BOTH', 50, '작업자102'],
      [105, 'MAIN', 7, '작업자105'],
    ]);
  });
});

describe('toDefectTypes', () => {
  const defect = (defectCodeId: number, qty: number, parentDefectName: string | null = '외관') => ({
    defectRecordId: defectCodeId * 10 + qty,
    defectCodeId,
    defectCode: `D${String(defectCodeId)}`,
    defectName: defectCodeId === 11 ? '긁힘' : '찍힘',
    parentDefectCodeId: parentDefectName === null ? null : 1,
    parentDefectCode: parentDefectName === null ? null : 'A',
    parentDefectName,
    qty,
  });

  it('유형별로 더하고 정정된 원본은 세지 않는다', () => {
    const rows = toDefectTypes([
      result(1, 101, 10, { defects: [defect(11, 5)] }),
      result(2, 101, 10, { correctsProductionResultId: 1, defects: [defect(11, 3)] }),
      result(3, 101, 0, { defectQty: 3, defects: [defect(11, 2), defect(12, 1, null)] }),
      /* 유형 없이 수량만 남은 불량 — 「유형 없음」으로 모은다. */
      result(6, 101, 0, { defectQty: 4, defects: [defect(11, 1)] }),
      result(4, 101, 5),
      /* 대분류로 단 옛 기록 — 대분류 칸이 아예 없다. */
      result(5, 101, 0, {
        defects: [
          { defectRecordId: 99, defectCodeId: 1, defectCode: 'A', defectName: '외관', qty: 6 },
        ],
      }),
    ]);

    expect(rows).toEqual([
      { defectCodeId: 11, label: '외관 › 긁힘', qty: 6 },
      { defectCodeId: 12, label: '찍힘', qty: 1 },
      { defectCodeId: 1, label: '외관', qty: 6 },
      { defectCodeId: null, label: null, qty: 3 },
    ]);
  });
});

describe('toDefectTypes 이름 언어', () => {
  it('대분류·상세 모두 화면 언어 이름을 쓰고, 없으면 기본 이름이다', () => {
    setLocale('vi');
    try {
      const rows = toDefectTypes([
        result(1, 101, 0, {
          defects: [
            {
              defectRecordId: 1,
              defectCodeId: 11,
              defectCode: 'A01',
              defectName: '긁힘',
              nameVi: 'Trầy xước',
              parentDefectCodeId: 1,
              parentDefectCode: 'A',
              parentDefectName: '외관',
              parentNameVi: 'Ngoại quan',
              qty: 2,
            },
            {
              defectRecordId: 2,
              defectCodeId: 12,
              defectCode: 'A02',
              defectName: '찍힘',
              parentDefectCodeId: 1,
              parentDefectCode: 'A',
              parentDefectName: '외관',
              qty: 1,
            },
          ],
        }),
      ]);

      expect(rows.map((row) => row.label)).toEqual(['Ngoại quan › Trầy xước', '외관 › 찍힘']);
    } finally {
      setLocale('ko');
    }
  });
});
