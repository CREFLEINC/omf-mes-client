import { describe, expect, it } from 'vitest';

import { itemFixtures } from '../item-extended-attrs/fixtures';
import {
  buildLotIssue,
  buildTagIssue,
  canMatchIdentificationCount,
  judgeLotScan,
  missingIdentificationCount,
  requiresIdentificationTag,
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
});
