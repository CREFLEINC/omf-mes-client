import { describe, expect, it } from 'vitest';

import {
  labelPendingProgress,
  lotProgress,
  orderSummary,
  progressFixtures,
  scheduleLine,
} from './fixtures';
import {
  countedGroups,
  hasLot,
  hasStageCounts,
  isStageGroup,
  lineTableRowId,
  linesWithLots,
  presentGroups,
  progressByLine,
  stageGroupOf,
  stageLead,
  stageTone,
  toLineTableRows,
} from './stage';

describe('단계 코드 → 묶음 · 색', () => {
  it('검사 셋은 검사 대기 묶음, 보류는 보류, 입고 대기는 입고, 적치 둘은 적치 — 끝난 것과 모르는 코드는 묶음이 없다', () => {
    expect(stageGroupOf('LABEL_PENDING')).toBe('LABEL');
    expect(stageGroupOf('INSPECTION_REQUIRED')).toBe('INSPECTION');
    expect(stageGroupOf('INSPECTION_REQUESTED')).toBe('INSPECTION');
    expect(stageGroupOf('INSPECTION_IN_PROGRESS')).toBe('INSPECTION');
    expect(stageGroupOf('INSPECTION_HELD')).toBe('HELD');
    expect(stageGroupOf('RECEIPT_READY')).toBe('RECEIPT');
    expect(stageGroupOf('PUTAWAY_PENDING')).toBe('PUTAWAY');
    expect(stageGroupOf('PUTAWAY_TEMPORARY')).toBe('PUTAWAY');
    expect(stageGroupOf('COMPLETED')).toBeNull();
    expect(stageGroupOf('CANCELLED')).toBeNull();
    expect(stageGroupOf('SOMETHING_NEW')).toBeNull();
  });

  it('이 화면의 할 일(의뢰 전·입고 대기)은 파랑, 기다림은 노랑, 보류는 빨강, 끝은 초록, 모르는 코드는 중립', () => {
    expect(stageTone('INSPECTION_REQUIRED')).toBe('info');
    expect(stageTone('RECEIPT_READY')).toBe('info');
    expect(stageTone('INSPECTION_REQUESTED')).toBe('warning');
    expect(stageTone('INSPECTION_HELD')).toBe('error');
    expect(stageTone('COMPLETED')).toBe('success');
    /* 라벨 발행(POP)은 적치(PDA)와 같은 「다른 곳의 할 일」. */
    expect(stageTone('LABEL_PENDING')).toBe('idle');
    expect(stageTone('SOMETHING_NEW')).toBe('idle');
  });

  it('주소의 stage 값은 다섯 묶음 이름만 받는다', () => {
    expect(isStageGroup('LABEL')).toBe(true);
    expect(isStageGroup('RECEIPT')).toBe(true);
    expect(isStageGroup('RECEIPT_READY')).toBe(false);
    expect(isStageGroup('')).toBe(false);
  });
});

describe('발주의 진행 — 가장 뒤처진 묶음과 외 N', () => {
  it('수가 있는 묶음을 흐름 순서로 세고, 첫째가 앞선다', () => {
    expect(presentGroups({ PUTAWAY: 3, RECEIPT: 5, INSPECTION: 4, HELD: 0 })).toEqual([
      'INSPECTION',
      'RECEIPT',
      'PUTAWAY',
    ]);
    expect(stageLead({ PUTAWAY: 3, RECEIPT: 5, INSPECTION: 4 })).toEqual({
      group: 'INSPECTION',
      count: 4,
      others: 2,
    });
  });

  it('라벨 발행 대기가 흐름 맨 앞이다 — LOT 이 있어야 검사도 입고도 한다', () => {
    expect(stageLead({ LABEL: 2, INSPECTION: 4, RECEIPT: 1 })).toEqual({
      group: 'LABEL',
      count: 2,
      others: 2,
    });
  });

  it('칩 줄은 서버가 센 묶음만 0 까지 세운다 — 앞선 서버(라벨 발행 대기 키 없음)는 그 칩만 빠진다', () => {
    expect(countedGroups({ INSPECTION: 0, HELD: 0, RECEIPT: 0, PUTAWAY: 0 })).toEqual([
      'INSPECTION',
      'HELD',
      'RECEIPT',
      'PUTAWAY',
    ]);
    expect(countedGroups({ PUTAWAY: 1, LABEL: 0, INSPECTION: 0, HELD: 0, RECEIPT: 0 })).toEqual([
      'LABEL',
      'INSPECTION',
      'HELD',
      'RECEIPT',
      'PUTAWAY',
    ]);
  });

  it('묶음이 하나뿐이면 외 0, 하나도 없으면 null', () => {
    expect(stageLead({ RECEIPT: 2 })).toEqual({ group: 'RECEIPT', count: 2, others: 0 });
    expect(stageLead({})).toBeNull();
    expect(stageLead({ INSPECTION: 0 })).toBeNull();
  });

  it('「진행」 열은 한 줄에라도 묶음 수가 실렸을 때만 선다 — 앞선 서버는 열이 없다', () => {
    expect(hasStageCounts([orderSummary(), orderSummary({ purchaseOrderId: 7102 })])).toBe(false);
    expect(
      hasStageCounts([
        orderSummary(),
        orderSummary({ purchaseOrderId: 7102, inboundStageCounts: {} }),
      ]),
    ).toBe(true);
  });
});

describe('라인 아래 LOT 줄', () => {
  const lines = [scheduleLine(), scheduleLine({ purchaseOrderLineId: 7302, lineNo: 2 })];

  it('LOT 을 라인별로 묶고, 한 라인 안은 입하 일시 → LOT 번호 순이다', () => {
    const byLine = progressByLine(progressFixtures);

    expect([...byLine.keys()]).toEqual([7301, 7302]);
    expect(byLine.get(7301)?.map((lot) => lot.lotNo)).toEqual([
      'SAMPLE|LOT|0004',
      'SAMPLE|LOT|0001',
      'SAMPLE|LOT|0002',
      'SAMPLE|LOT|0003',
    ]);
    expect(byLine.get(7302)?.map((lot) => lot.lotNo)).toEqual(['SAMPLE|LOT|0005']);
  });

  it('펼친 라인 아래에 LOT 줄이 서고 마지막 줄만 isLast — 접은 라인은 라인만 남는다', () => {
    const byLine = progressByLine(progressFixtures);
    const open = toLineTableRows(lines, byLine, new Set());

    expect(open.map((row) => row.kind)).toEqual([
      'line',
      'lot',
      'lot',
      'lot',
      'lot',
      'line',
      'lot',
    ]);
    expect(open.filter((row) => row.kind === 'lot').map((row) => row.isLast)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(open[0]?.kind === 'line' && open[0].isExpanded).toBe(true);

    const folded = toLineTableRows(lines, byLine, new Set([7301]));

    expect(folded.map((row) => row.kind)).toEqual(['line', 'line', 'lot']);
    expect(folded[0]?.kind === 'line' && folded[0].isExpanded).toBe(false);
  });

  it('진행 자료가 없으면(앞선 서버) 라인만 선다 — LOT 없는 라인은 펼침 상태가 아니다', () => {
    const rows = toLineTableRows(lines, undefined, new Set());

    expect(rows.map((row) => row.kind)).toEqual(['line', 'line']);
    expect(rows.every((row) => row.kind === 'line' && !row.isExpanded)).toBe(true);
  });

  it('줄 키는 라인 번호, LOT 줄은 라인 번호에 LOT 번호를 붙인다', () => {
    const [first, second] = toLineTableRows(
      [scheduleLine()],
      progressByLine([lotProgress({ lotId: 7777 })]),
      new Set(),
    );

    expect(first !== undefined && lineTableRowId(first)).toBe('7301');
    expect(second !== undefined && lineTableRowId(second)).toBe('7301:lot:7777');
  });

  it('라벨 미부착 줄(LOT 없음)도 라인 아래에 서고, 입하 일시 순으로 끼며 키는 입하 라인으로 가린다', () => {
    const pending = [
      labelPendingProgress({
        inboundReceiptLineId: 7607,
        receiptDatetime: '2026-10-22T08:00:00+09:00',
      }),
      labelPendingProgress({
        inboundReceiptLineId: 7606,
        receiptDatetime: '2026-10-22T08:00:00+09:00',
      }),
    ];
    const byLine = progressByLine([...pending, lotProgress()]);

    expect(byLine.get(7301)?.map((lot) => lot.lotNo ?? lot.inboundReceiptLineId)).toEqual([
      'SAMPLE|LOT|0001',
      7606,
      7607,
    ]);

    const rows = toLineTableRows([scheduleLine()], byLine, new Set());

    expect(rows.map((row) => lineTableRowId(row))).toEqual([
      '7301',
      '7301:lot:7701',
      '7301:receipt-line:7606',
      '7301:receipt-line:7607',
    ]);
    expect(hasLot(lotProgress())).toBe(true);
    expect(hasLot(labelPendingProgress())).toBe(false);
  });

  it('「모두 접기」의 대상은 LOT 이 딸린 라인만이다', () => {
    const byLine = progressByLine([lotProgress()]);

    expect(linesWithLots(lines, byLine)).toEqual([7301]);
    expect(linesWithLots(lines, undefined)).toEqual([]);
  });
});
