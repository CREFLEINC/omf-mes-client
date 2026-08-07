import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER_ASN_STATUS_CODES,
  distinctStatusCodes,
  toStatusOptions,
  withCurrentValue,
} from './status-options';
import type { AsnView } from './types';

const row = (statusCode: string): AsnView => ({
  asnId: 7001,
  asnNo: 'SAMPLE-ASN-0001',
  supplierId: 8101,
  plantId: 8201,
  expectedArrivalDate: '2026-08-10',
  deliveryNoteNo: null,
  statusCode,
  remarks: null,
});

describe('PLACEHOLDER_ASN_STATUS_CODES', () => {
  /*
   * **값을 지어내지 않는다.** 공통코드 등록 전이라 값 집합이 없다(이슈 #20 §4 · omf-mes#64).
   * 비어 있어도 자리를 남기는 이유는, 확정됐을 때 고칠 곳이 한눈에 보이게 하기 위해서다.
   */
  it('자리표시 상수가 비어 있다', () => {
    expect(PLACEHOLDER_ASN_STATUS_CODES).toEqual([]);
  });
});

describe('distinctStatusCodes', () => {
  it('결과에 나온 코드를 중복 없이 오름차순으로 낸다', () => {
    expect(
      distinctStatusCodes([row('SAMPLE_STATUS_B'), row('SAMPLE_STATUS_A'), row('SAMPLE_STATUS_B')]),
    ).toEqual(['SAMPLE_STATUS_A', 'SAMPLE_STATUS_B']);
  });

  it('빈 코드는 선택지로 삼지 않는다', () => {
    expect(distinctStatusCodes([row(''), row('SAMPLE_STATUS_A')])).toEqual(['SAMPLE_STATUS_A']);
  });

  it('결과가 없으면 선택지도 없다', () => {
    expect(distinctStatusCodes([])).toEqual([]);
  });
});

describe('withCurrentValue', () => {
  /*
   * **지금 걸린 값이 목록에 없으면 맨 앞에 남긴다.** 남기지 않으면 조건을 바꿨을 때
   * 고른 값이 선택칸에서 사라져 **해제할 방법이 없어진다.**
   */
  it('걸린 값이 목록에 없으면 맨 앞에 남긴다', () => {
    expect(withCurrentValue(['SAMPLE_STATUS_A'], 'SAMPLE_STATUS_Z')).toEqual([
      'SAMPLE_STATUS_Z',
      'SAMPLE_STATUS_A',
    ]);
  });

  it('걸린 값이 이미 목록에 있으면 그대로 둔다', () => {
    expect(withCurrentValue(['SAMPLE_STATUS_A'], 'SAMPLE_STATUS_A')).toEqual(['SAMPLE_STATUS_A']);
  });

  it('걸린 값이 없으면 목록 그대로다', () => {
    expect(withCurrentValue(['SAMPLE_STATUS_A'], '')).toEqual(['SAMPLE_STATUS_A']);
  });
});

describe('toStatusOptions', () => {
  it('자리표시 상수와 관측한 코드를 한 목록으로 합친다', () => {
    expect(
      toStatusOptions(['SAMPLE_PLACEHOLDER'], [row('SAMPLE_STATUS_A'), row('SAMPLE_STATUS_A')], ''),
    ).toEqual(['SAMPLE_PLACEHOLDER', 'SAMPLE_STATUS_A']);
  });

  it('같은 값이 양쪽에 있으면 한 번만 남는다', () => {
    expect(toStatusOptions(['SAMPLE_STATUS_A'], [row('SAMPLE_STATUS_A')], '')).toEqual([
      'SAMPLE_STATUS_A',
    ]);
  });

  it('지금 걸린 값이 결과에 없어도 목록에 남는다', () => {
    expect(toStatusOptions([], [row('SAMPLE_STATUS_A')], 'SAMPLE_STATUS_Z')).toEqual([
      'SAMPLE_STATUS_Z',
      'SAMPLE_STATUS_A',
    ]);
  });

  /* 자리표시가 빈 배열인 지금은 결과에서 관측한 값이 선택지의 전부다. */
  it('자리표시가 비어 있으면 관측한 값만 선택지가 된다', () => {
    expect(toStatusOptions(PLACEHOLDER_ASN_STATUS_CODES, [row('SAMPLE_STATUS_A')], '')).toEqual([
      'SAMPLE_STATUS_A',
    ]);
  });
});
