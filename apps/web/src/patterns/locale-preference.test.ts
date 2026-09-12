import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LOCALE_STORAGE_KEY,
  rememberLocale,
  startingLocale,
  storedLocale,
} from './locale-preference';

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  globalThis.localStorage.clear();
  vi.restoreAllMocks();
});

/** 브라우저가 주는 선호 언어표를 갈아 끼운다. jsdom 의 기본값은 `en-US` 한 줄이다. */
const withBrowserLanguages = (languages: readonly string[]): void => {
  vi.spyOn(globalThis.navigator, 'languages', 'get').mockReturnValue(languages);
};

describe('화면 언어 기억', () => {
  it('고른 적이 없으면 없다고 답한다', () => {
    expect(storedLocale()).toBeNull();
  });

  it('고른 값을 남기고 그대로 읽는다', () => {
    rememberLocale('vi');

    expect(globalThis.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('vi');
    expect(storedLocale()).toBe('vi');
  });

  /**
   * ⛔ **모르는 값을 그대로 쓰지 않는다.** 저장값은 사람이 손으로 고칠 수 있는 자리라, 검사 없이
   * 넘기면 없는 묶음을 고르게 되어 문구가 통째로 `undefined` 가 된다.
   */
  it('모르는 값이 남아 있으면 없는 것으로 본다', () => {
    globalThis.localStorage.setItem(LOCALE_STORAGE_KEY, 'jp');

    expect(storedLocale()).toBeNull();
  });

  /**
   * ⚠ **저장소에 닿는 것만으로 던지는 브라우저가 있다**(사생활 보호 모드·저장 차단). 여기서
   * 던지면 진입점이 멈춰 **화면이 아예 서지 않는다.**
   */
  it('저장소가 던져도 화면을 세운다', () => {
    vi.spyOn(globalThis.Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('저장소가 막혔습니다');
    });
    vi.spyOn(globalThis.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('저장소가 막혔습니다');
    });

    expect(storedLocale()).toBeNull();
    expect(() => {
      rememberLocale('vi');
    }).not.toThrow();
  });
});

describe('이번 판을 세울 언어', () => {
  /**
   * ⭐ **고른 값이 기기 언어를 이긴다.** 공용 PC 의 크롬 기본값은 그 자리에 앉은 사람의 언어가
   * 아니다 — 한 번 고른 사람에게 매번 남의 기본값을 다시 들이대지 않는다.
   */
  it('고른 값이 있으면 기기 언어를 보지 않는다', () => {
    withBrowserLanguages(['ko-KR']);
    rememberLocale('vi');

    expect(startingLocale()).toBe('vi');
  });

  it('고른 적이 없는 첫 방문만 기기 언어를 본다', () => {
    withBrowserLanguages(['vi-VN', 'en-US']);

    expect(startingLocale()).toBe('vi');
  });

  /** 아는 언어가 하나도 없으면 한국어다 — 모르는 언어를 빈 화면으로 두지 않는다. */
  it('모르는 기기 언어뿐이면 한국어로 선다', () => {
    withBrowserLanguages(['fr-FR']);

    expect(startingLocale()).toBe('ko');
  });

  it('기기가 선호 언어를 하나도 주지 않아도 선다', () => {
    withBrowserLanguages([]);

    expect(startingLocale()).toBe('ko');
  });
});
