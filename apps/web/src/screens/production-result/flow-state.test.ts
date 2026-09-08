import { describe, expect, it } from 'vitest';

import { itemFixtures } from '../item-extended-attrs/fixtures';
import {
  appliedGoodQty,
  buildLotIssue,
  buildTagIssue,
  canMatchIdentificationCount,
  chunkTargets,
  completedLotPageBoundary,
  hasSucceededIdentificationPrint,
  judgeLotScan,
  missingIdentificationCount,
  requiresIdentificationTag,
  nextBatchCount,
} from './flow-state';

describe('P-02-04 통합 흐름 판정', () => {
  it('품목의 시리얼 관리 값으로만 인식표 영역을 가른다', () => {
    const plain = itemFixtures[0];
    const serialized = itemFixtures[2];

    expect(plain === undefined || serialized === undefined).toBe(false);
    if (plain === undefined || serialized === undefined) return;

    expect(requiresIdentificationTag(plain)).toBe(false);
    expect(requiresIdentificationTag(serialized)).toBe(true);
  });

  it('실제 생산수량과 기존 개체 수를 중복 합산하지 않는다', () => {
    expect(missingIdentificationCount(12, 5)).toBe(7);
    expect(missingIdentificationCount(12, 12)).toBe(0);
    expect(missingIdentificationCount(12, 14)).toBe(0);
    expect(canMatchIdentificationCount(12, 12)).toBe(true);
    expect(canMatchIdentificationCount(12, 11)).toBe(false);
  });

  it('인식표와 생산 LOT 라벨의 대상 유형을 섞지 않는다', () => {
    expect(
      buildTagIssue([
        {
          serialNumberId: 31,
          serialNo: 'SN-31',
          itemId: 1,
          lotId: 7,
          statusCode: 'ACTIVE',
        },
      ]),
    ).toEqual({
      documentTypeCode: 'IDENTIFICATION_TAG',
      targets: [{ targetTypeCode: 'SERIAL_NUMBER', targetId: 31, lotId: 7 }],
    });

    expect(buildLotIssue(7, 'LP-01')).toEqual({
      documentTypeCode: 'PRODUCTION_LOT_LABEL',
      targets: [{ targetTypeCode: 'LOT', targetId: 7, lotId: 7 }],
      printerName: 'LP-01',
    });

    expect(
      buildTagIssue(
        [
          {
            serialNumberId: 31,
            serialNo: 'SN-31',
            itemId: 1,
            lotId: 7,
            statusCode: 'ACTIVE',
          },
        ],
        { reissueReasonCode: 'PRINT_FAILURE', printerName: 'LP-01' },
      ),
    ).toEqual({
      documentTypeCode: 'IDENTIFICATION_TAG',
      targets: [{ targetTypeCode: 'SERIAL_NUMBER', targetId: 31, lotId: 7 }],
      reissueReasonCode: 'PRINT_FAILURE',
      printerName: 'LP-01',
    });
  });

  it('현재 LOT 번호와 완전히 일치할 때만 자동 마감을 연다', () => {
    expect(judgeLotScan('', 'LOT-1')).toBe('empty');
    expect(judgeLotScan('LOT-2', 'LOT-1')).toBe('mismatch');
    expect(judgeLotScan(' LOT-1 ', 'LOT-1')).toBe('match');
  });

  it('서버 적용 실적은 LOT 진행 누계로만 복구한다', () => {
    expect(appliedGoodQty(undefined)).toBeNull();
    expect(appliedGoodQty({ progress: { goodQty: 0 } })).toBeNull();
    expect(appliedGoodQty({ progress: { goodQty: 12.5 } })).toBe(12.5);
  });

  it('발번과 대상 요청을 계약 상한 1000에서 정확히 나눈다', () => {
    expect(nextBatchCount(1000)).toEqual({ quantity: 1000, remaining: 0 });
    expect(nextBatchCount(1001)).toEqual({ quantity: 1000, remaining: 1 });
    expect(nextBatchCount(1)).toEqual({ quantity: 1, remaining: 0 });
    expect(chunkTargets(Array.from({ length: 1001 }, (_, index) => index))).toHaveLength(2);
    expect(chunkTargets(Array.from({ length: 1001 }, (_, index) => index))[0]).toHaveLength(1000);
    expect(chunkTargets(Array.from({ length: 1001 }, (_, index) => index))[1]).toHaveLength(1);
  });

  it('발행 횟수만으로는 인쇄 성공으로 판정하지 않는다', () => {
    expect(
      hasSucceededIdentificationPrint({
        targetTypeCode: 'SERIAL_NUMBER',
        targetId: 1,
        issueCount: 1,
        lastPrintOutcome: 'PENDING',
      }),
    ).toBe(false);
    expect(
      hasSucceededIdentificationPrint({
        targetTypeCode: 'SERIAL_NUMBER',
        targetId: 1,
        issueCount: 1,
        lastPrintOutcome: 'FAILED',
      }),
    ).toBe(false);
    expect(
      hasSucceededIdentificationPrint({
        targetTypeCode: 'SERIAL_NUMBER',
        targetId: 1,
        issueCount: 1,
        lastPrintOutcome: 'SUCCEEDED',
      }),
    ).toBe(true);
  });

  it('마감 LOT 페이지의 위·아래 경계를 서버 메타로 판정한다', () => {
    expect(completedLotPageBoundary({ page: 1, size: 20, total: 21 })).toEqual({
      page: 1,
      totalPages: 2,
      canPageUp: false,
      canPageDown: true,
    });
    expect(completedLotPageBoundary({ page: 2, size: 20, total: 21 })).toEqual({
      page: 2,
      totalPages: 2,
      canPageUp: true,
      canPageDown: false,
    });
  });
});
