import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { makeCalibration } from './fixtures';
import { byRecentFirst, historyLimitNote } from './calibration-history';

const t = messages.gaugeMaster.history;

describe('이력이 전부인가', () => {
  it('전체 건수를 알고 더 있으면 몇 건 중 몇 건인지 말한다', () => {
    expect(historyLimitNote(20, 42, 20)).toBe(t.truncated(20, 42));
  });

  it('전체 건수를 알고 다 받았으면 아무 말도 하지 않는다', () => {
    expect(historyLimitNote(3, 3, 20)).toBeNull();
  });

  it('받은 것이 전체보다 많다고 나와도 더 있다고 말하지 않는다', () => {
    expect(historyLimitNote(5, 3, 20)).toBeNull();
  });

  /*
   * ⛔ **꽉 찬 쪽을 「다 받았다」로 읽지 않는다.** 침묵하면 사용자는 이력이 이게 전부라고 믿는다.
   * 계약이 전체 건수를 «선택»으로 두어 실제로 안 올 수 있다.
   */
  it('전체 건수를 모르는데 한 쪽이 꽉 찼으면 더 있을 수 있다고 말한다', () => {
    expect(historyLimitNote(20, null, 20)).toBe(t.mayHaveMore(20));
  });

  it('전체 건수를 모르고 한 쪽이 덜 찼으면 아무 말도 하지 않는다', () => {
    expect(historyLimitNote(7, null, 20)).toBeNull();
  });

  it('모르는 채 비어 있으면 아무 말도 하지 않는다', () => {
    expect(historyLimitNote(0, null, 20)).toBeNull();
  });

  /* 「모른다」와 「안다」의 문장이 다르다 — 같으면 어느 쪽인지 구분할 수 없다. */
  it('아는 경우와 모르는 경우가 다른 말이다', () => {
    expect(t.truncated(20, 42)).not.toBe(t.mayHaveMore(20));
  });
});

describe('읽기 차례', () => {
  const older = makeCalibration(9001, '2025-10-05');
  const newer = makeCalibration(9002, '2026-01-05');

  it('실시일이 늦은 것이 위로 온다', () => {
    expect(byRecentFirst([older, newer]).map((item) => item.calibrationId)).toEqual([9002, 9001]);
  });

  it('이미 늦은 것이 위면 그대로 둔다', () => {
    expect(byRecentFirst([newer, older]).map((item) => item.calibrationId)).toEqual([9002, 9001]);
  });

  /* ⛔ 조회 캐시가 준 배열을 제자리에서 정렬하면 다른 소비처가 보는 차례까지 바뀐다. */
  it('원본을 뒤집지 않는다', () => {
    const original = [older, newer];

    byRecentFirst(original);

    expect(original.map((item) => item.calibrationId)).toEqual([9001, 9002]);
  });

  it('빈 목록도 다룬다', () => {
    expect(byRecentFirst([])).toEqual([]);
  });

  /*
   * ⛔ 문구가 「최근 N건」이라 말하면 그 N건이 최신이라고 단언하는 것이 된다.
   * 계약에 정렬 조건이 없어 **어느 N건을 받았는지 화면은 알 수 없다.**
   */
  it('문구가 「최근」이라 단언하지 않는다', () => {
    expect(t.truncated(20, 42)).not.toContain('최근');
    expect(t.mayHaveMore(20)).not.toContain('최근');
  });
});
