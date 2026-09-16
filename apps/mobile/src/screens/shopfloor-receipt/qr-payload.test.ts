import { describe, expect, it } from 'vitest';

import { parseScannedCode } from './qr-payload';

/**
 * M-01-09 가 **출고 QR 과 손으로 친 출고번호를 같은 칸으로** 받는다(설계 §5-6 — 스캔·직접 입력
 * 둘 다 상시 활성). 가르는 것은 접두어 하나다.
 *
 * ⚠ 이 양식은 POP 쪽(`apps/web/src/screens/goods-issue-qr/qr-payload.ts`)과 **같아야 한다.**
 *   양쪽이 같은 예시 문자열을 들고 있어, 한쪽만 고치면 여기가 걸린다.
 */

const PAYLOAD = 'OMF-GIL|17|GI-20260916-0001|1';

describe('스캔값 가르기', () => {
  it('출고 QR 이면 라인 식별자·출고번호·라인번호를 읽는다', () => {
    expect(parseScannedCode(PAYLOAD)).toEqual({
      kind: 'issueLine',
      goodsIssueLineId: 17,
      goodsIssueNo: 'GI-20260916-0001',
      lineNo: 1,
    });
  });

  /* 스캐너가 앞뒤 공백을 붙여 쏘는 일이 있다. */
  it('앞뒤 공백을 흘린다', () => {
    expect(parseScannedCode(`  ${PAYLOAD}  `)).toMatchObject({ goodsIssueLineId: 17 });
  });

  /*
   * ⭐ **접두어가 없으면 예전 길이다.** 사람이 전표 번호를 손으로 치는 경로를 그대로 둔다 —
   *    이것이 없으면 QR 이 상했을 때 입고를 할 방법이 사라진다.
   */
  it('접두어가 없으면 출고번호로 본다', () => {
    expect(parseScannedCode('GI-20260916-0001')).toEqual({
      kind: 'issueNo',
      goodsIssueNo: 'GI-20260916-0001',
    });
  });

  /* 자재 LOT QR 은 접두어 없이 LOT 번호 원문만 담는다 — 그 값도 이 길로 흘러 「못 찾음」이 된다. */
  it('자재 LOT 번호를 대면 출고번호 경로로 흘러간다', () => {
    expect(parseScannedCode('SEED-S230-0003')).toEqual({
      kind: 'issueNo',
      goodsIssueNo: 'SEED-S230-0003',
    });
  });

  /*
   * ⛔ **접두어만 맞고 내용이 깨진 값을 라인 축으로 받지 않는다.** 그 번호로 조회를 걸면 남의
   *    라인을 가리킬 수 있다. 함께 실린 출고번호로 되돌아간다 — 양식에 번호를 담은 까닭이다.
   */
  it('라인 식별자가 숫자가 아니면 출고번호로 되돌아간다', () => {
    expect(parseScannedCode('OMF-GIL|x|GI-20260916-0001|1')).toEqual({
      kind: 'issueNo',
      goodsIssueNo: 'GI-20260916-0001',
    });
  });

  it('라인 식별자가 0 이나 음수면 출고번호로 되돌아간다', () => {
    expect(parseScannedCode('OMF-GIL|0|GI-20260916-0001|1')).toMatchObject({ kind: 'issueNo' });
    expect(parseScannedCode('OMF-GIL|-3|GI-20260916-0001|1')).toMatchObject({ kind: 'issueNo' });
  });

  /* 라인번호는 사람이 읽는 값이라 없어도 조회는 선다. */
  it('라인번호가 없어도 라인 식별자로 받는다', () => {
    expect(parseScannedCode('OMF-GIL|17|GI-20260916-0001')).toEqual({
      kind: 'issueLine',
      goodsIssueLineId: 17,
      goodsIssueNo: 'GI-20260916-0001',
      lineNo: null,
    });
  });

  /* 구버전 라벨이나 다른 접두어 — 출고 QR 이 아니다. */
  it('다른 접두어는 출고 QR 이 아니다', () => {
    expect(parseScannedCode('L1|NEW|A5C1M50101|SEED-0001|100')).toMatchObject({ kind: 'issueNo' });
  });

  it('빈 값은 빈 출고번호가 된다', () => {
    expect(parseScannedCode('   ')).toEqual({ kind: 'issueNo', goodsIssueNo: '' });
  });
});
