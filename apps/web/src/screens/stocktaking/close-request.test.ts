import { describe, expect, it } from 'vitest';

import { toCountClose } from './close-request';
import { toBusinessDate } from './line-replace-request';

/**
 * **고정 시각을 주입해 검사한다**(W-01-03·W-01-10이 세운 형태). 함수 안에서 `new Date()`를
 * 부르면 순수하지 않아 자정 경계를 잴 수 없다 — 그 경계가 이 파일의 요점이다.
 */
describe('toCountClose — 마감 본문', () => {
  /*
   * **완료 조건 C56** — 보내는 것이 `businessDate` **하나**다. 계약의
   * `InventoryCountClose`에 다른 필드가 없다(실측) — 하나라도 더 실으면 서버가 거절한다.
   */
  it('본문이 영업일 하나다', () => {
    expect(toCountClose(new Date(2026, 7, 11, 14, 30))).toEqual({ businessDate: '2026-08-11' });
  });

  /*
   * **영업일은 실행 시각의 날짜로 파생한다**(계획 §6.4). 산출 규칙(야간조 경계 등)이 어디에도
   * 정의돼 있지 않고, 별도 입력칸을 두는 대안은 **사용자가 무엇을 넣어야 하는지 화면이 설명할
   * 수 없어** 택하지 않았다.
   */
  it.each<[string, Date, string]>([
    ['자정 직전', new Date(2026, 7, 11, 23, 59, 59), '2026-08-11'],
    ['자정 직후', new Date(2026, 7, 12, 0, 0, 0), '2026-08-12'],
    ['한 자리 달·일', new Date(2026, 0, 5, 9, 0), '2026-01-05'],
  ])('%s의 영업일이 그날의 지역 날짜다', (_label, at, expected) => {
    expect(toCountClose(at).businessDate).toBe(expected);
  });

  /*
   * **`toISOString`을 쓰지 않는다** — UTC로 옮겨 버려 자정 경계에서 날짜가 하루 어긋난다.
   * 위 두 경계가 어느 시간대에서든 그 뒤집힘을 잡는다(UTC보다 앞선 곳에서는 「자정 직후」가,
   * 뒤진 곳에서는 「자정 직전」이 걸린다).
   */
  it('영업일 파생을 치환과 한 곳에서 함께 쓴다', () => {
    for (const at of [
      new Date(2026, 7, 11, 23, 59, 59),
      new Date(2026, 7, 12, 0, 0, 0),
      new Date(2026, 11, 31, 22, 15),
    ]) {
      expect(toCountClose(at).businessDate).toBe(toBusinessDate(at));
    }
  });
});
