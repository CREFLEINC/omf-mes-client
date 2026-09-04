import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { LOT_A_ID, LOT_B_ID, LOT_A_NO, makeContent } from './fixtures';
import { applySummary, buildTargets, needsReason } from './targets';
import { DOCUMENT_TYPE_CODES, TARGET_TYPE_CODES, type PackingContentRow } from './types';

const t = messages.packingLabelReprint.targets;

const row = (lotId: number, lotNo: string | null): PackingContentRow => ({
  handlingUnitContentId: 70000 + lotId,
  lotId,
  itemId: makeContent(lotId).itemId,
  qty: 100,
  lotNo,
  itemCode: 'ABC-123',
  uomCode: 'EA',
});

describe('재출력 대상 산출', () => {
  it('내용물 한 줄에서 포장 라벨과 인식표 두 줄이 선다', () => {
    const targets = buildTargets([row(LOT_A_ID, LOT_A_NO)]);

    expect(targets).toHaveLength(2);
    expect(targets[0]?.documentTypeCode).toBe(DOCUMENT_TYPE_CODES.packingLabel);
    expect(targets[1]?.documentTypeCode).toBe(DOCUMENT_TYPE_CODES.identificationTag);
  });

  it('포장 라벨의 대상은 LOT 이고 참조 키가 소속 LOT 과 같다', () => {
    const [label] = buildTargets([row(LOT_A_ID, LOT_A_NO)]);

    expect(label?.targetTypeCode).toBe(TARGET_TYPE_CODES.lot);
    expect(label?.targetId).toBe(LOT_A_ID);
    expect(label?.lotId).toBe(LOT_A_ID);
  });

  it('인식표 줄은 고를 수 없고 사유가 붙는다', () => {
    const targets = buildTargets([row(LOT_A_ID, LOT_A_NO)]);

    expect(targets[0]?.disabledReason).toBeNull();
    expect(targets[1]?.disabledReason).toBe(t.serialUnavailable);
  });

  it('LOT 번호를 못 받았으면 번호를 지어내지 않는다', () => {
    const [label] = buildTargets([row(LOT_A_ID, null)]);

    expect(label?.displayName).toBe(t.unknownLot);
    expect(label?.displayName).not.toContain(String(LOT_A_ID));
  });

  it('요약을 얹으면 해당 유형·대상에만 회차가 붙는다', () => {
    const targets = buildTargets([row(LOT_A_ID, LOT_A_NO)]);
    const applied = applySummary(targets, [
      {
        targetTypeCode: TARGET_TYPE_CODES.lot,
        targetId: LOT_A_ID,
        issueCount: 2,
        lastIssuedAt: '2026-09-02T09:12:30Z',
      },
    ]);

    expect(applied[0]?.issueCount).toBe(2);
    /* 개체 줄은 같은 참조 키를 갖지만 유형이 달라 얹히지 않는다 */
    expect(applied[1]?.issueCount).toBeNull();
  });

  it('요약이 아직 없으면 회차를 0 으로 채우지 않는다', () => {
    const applied = applySummary(buildTargets([row(LOT_A_ID, LOT_A_NO)]), undefined);

    expect(applied[0]?.issueCount).toBeNull();
  });
});

describe('재발행 사유 필요 판정', () => {
  const targets = (counts: (number | null)[]) =>
    counts.map((issueCount, index) => ({
      ...buildTargets([row(index === 0 ? LOT_A_ID : LOT_B_ID, LOT_A_NO)])[0]!,
      issueCount,
    }));

  it('발행 이력이 없는 대상만 고르면 사유가 필요 없다', () => {
    expect(needsReason(targets([0, 0]))).toBe(false);
  });

  it('하나라도 이미 발행됐으면 사유가 필요하다', () => {
    expect(needsReason(targets([0, 1]))).toBe(true);
  });

  it('회차를 모르는 대상이 섞이면 사유를 받는다', () => {
    expect(needsReason(targets([0, null]))).toBe(true);
  });

  it('아무것도 고르지 않으면 사유가 필요 없다', () => {
    expect(needsReason([])).toBe(false);
  });
});
