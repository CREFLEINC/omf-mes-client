import { beforeEach, describe, expect, it } from 'vitest';

import {
  forgetSentDefects,
  rememberSentDefects,
  SENT_DEFECTS_STORAGE_KEY,
  storedSentDefects,
} from './sent-defects';

describe('sent-defects', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('LOT 별로 기억하고, 마감하면 지운다', () => {
    rememberSentDefects(7, [{ label: '외관 › 찍힘', qty: '2' }]);
    rememberSentDefects(8, []);

    expect(storedSentDefects(7)).toEqual([{ label: '외관 › 찍힘', qty: '2' }]);
    expect(storedSentDefects(8)).toEqual([]);
    expect(storedSentDefects(9)).toBeNull();

    forgetSentDefects(7);
    expect(storedSentDefects(7)).toBeNull();
    expect(storedSentDefects(8)).toEqual([]);
  });

  it('깨진 값은 모른다로 본다', () => {
    globalThis.localStorage.setItem(SENT_DEFECTS_STORAGE_KEY, '{not json');
    expect(storedSentDefects(1)).toBeNull();

    globalThis.localStorage.setItem(SENT_DEFECTS_STORAGE_KEY, JSON.stringify({ 1: [{ qty: 2 }] }));
    expect(storedSentDefects(1)).toBeNull();
  });

  it('30 LOT 을 넘으면 오래된 LOT 부터 버린다', () => {
    for (let lotId = 1; lotId <= 31; lotId += 1) {
      rememberSentDefects(lotId, [{ label: 'A', qty: '1' }]);
    }

    expect(storedSentDefects(1)).toBeNull();
    expect(storedSentDefects(2)).not.toBeNull();
    expect(storedSentDefects(31)).not.toBeNull();
  });
});
