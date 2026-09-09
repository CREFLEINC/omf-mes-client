import { describe, expect, it } from 'vitest';

import { goodsIssueQrKeys } from './queries';
import { LINE_TARGET_TYPE_CODE, PALLET_TARGET_TYPE_CODE } from './types';

/**
 * 발행 요약을 담아 두는 칸의 이름.
 *
 * ⛔ **대상 유형이 이름에서 빠지면 라인과 파렛트가 같은 칸을 쓴다.** 둘은 같은 표를 유형으로
 * 가르는 사이라(스펙 §5-1), 칸이 겹치면 파렛트가 라인의 발행 횟수를 자기 것으로 읽어
 * **재발행인데 최초 발행으로 열린다** — 발행은 되돌릴 수 없다.
 *
 * ⚠ **화면 시험으로는 이 결함이 드러나지 않는다.** 대상 번호 목록까지 같아야 칸이 겹치는데,
 * 화면에서는 라인 목록과 파렛트 한 건이라 번호가 달라 우연히 갈린다. 그래서 이름 자체를
 * 여기서 못박는다.
 */
describe('goodsIssueQrKeys.summary — 대상 유형이 칸 이름에 남는다', () => {
  it('대상 번호가 같아도 유형이 다르면 다른 칸이다', () => {
    const line = goodsIssueQrKeys.summary(LINE_TARGET_TYPE_CODE, [1001]);
    const pallet = goodsIssueQrKeys.summary(PALLET_TARGET_TYPE_CODE, [1001]);

    expect(line).not.toEqual(pallet);
    expect(line).toContain(LINE_TARGET_TYPE_CODE);
    expect(pallet).toContain(PALLET_TARGET_TYPE_CODE);
  });
});
