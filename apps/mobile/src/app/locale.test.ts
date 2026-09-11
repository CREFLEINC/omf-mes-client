import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  LOCALES,
  activeLocale,
  ko,
  messages,
  resolveLocale,
  setLocale,
  type Messages,
} from '@omf-mes/i18n';

/**
 * 고른 언어가 화면까지 닿는가.
 *
 * 화면 33곳이 문구 슬라이스를 모듈 최상위에서 붙잡는다. 고르는 자리를 둬도 그 값이 화면이
 * 읽는 자리로 흘러가지 않으면 아무것도 바뀌지 않는다 - 실기기에서 기기 언어를 베트남어로
 * 바꿔도 한국어가 그대로 남던 자리다.
 *
 * 실제 번역값으로 재면 문구를 고칠 때마다 이 시험이 함께 깨진다. 여기서 재는 것은 문구가
 * 아니라 고른 것이 흘러가는가라, 구별되는 가짜 문구를 잠깐 끼워 재고 되돌린다.
 */
describe('언어 고르기', () => {
  const registry = LOCALES as unknown as Record<string, Messages>;
  const real = registry.vi;

  /* ko 는 as const 라 문자열이 리터럴로 굳는다. 표식을 실으려면 그 자리를 넓혀야 한다. */
  const marked = (label: string): Messages =>
    ({ ...ko, shellHome: { ...ko.shellHome, label } }) as unknown as Messages;

  beforeEach(() => {
    setLocale('ko');
  });

  afterEach(() => {
    registry.vi = real as Messages;
    setLocale('ko');
  });

  it('고른 언어의 묶음이 화면이 읽는 자리로 나온다', () => {
    registry.vi = marked('VI-표식');

    setLocale('vi');

    expect(activeLocale()).toBe('vi');
    expect(messages.shellHome.label).toBe('VI-표식');
  });

  /* 웹·POP 은 고르는 자리를 부르지 않는다. 기본이 흔들리면 1,540개 파일이 함께 흔들린다. */
  it('고르지 않은 채로 두면 한국어를 낸다', () => {
    registry.vi = marked('VI-표식');

    expect(activeLocale()).toBe('ko');
    expect(messages.shellHome.label).toBe(ko.shellHome.label);
    expect(messages.common).toBe(ko.common);
  });

  /* 되돌린 뒤에도 고른 언어를 따라간다. 첫 회차의 값을 굳혀 두면 두 번째가 조용히 한국어다. */
  it('고른 언어를 바꾸면 그때마다 따라간다', () => {
    registry.vi = marked('VI-표식');

    setLocale('vi');
    expect(messages.shellHome.label).toBe('VI-표식');

    setLocale('ko');
    expect(messages.shellHome.label).toBe(ko.shellHome.label);
  });

  describe('기기가 주는 언어표를 묶음으로 옮긴다', () => {
    it('지역까지 붙은 표를 받는다', () => {
      expect(resolveLocale(['vi-VN'])).toBe('vi');
      expect(resolveLocale(['ko-KR'])).toBe('ko');
    });

    it('대소문자를 가리지 않는다', () => {
      expect(resolveLocale(['VI-vn'])).toBe('vi');
    });

    /* 기기는 선호 순서대로 여럿을 준다. 아는 것이 나올 때까지 앞에서부터 본다. */
    it('아는 것이 나올 때까지 앞에서부터 본다', () => {
      expect(resolveLocale(['en-US', 'vi-VN', 'ko-KR'])).toBe('vi');
    });

    /* in 은 프로토타입까지 본다. 막지 않으면 없는 묶음을 골라 화면이 통째로 빈다. */
    it('프로토타입에 있는 이름을 언어로 보지 않는다', () => {
      expect(resolveLocale(['constructor'])).toBe('ko');
    });

    /* 모르는 언어를 빈 화면으로 두지 않는다. 읽을 수 있는 것이 낫다. */
    it('아는 것이 하나도 없으면 한국어로 둔다', () => {
      expect(resolveLocale(['en-US', 'ja-JP'])).toBe('ko');
      expect(resolveLocale([])).toBe('ko');
    });
  });
});
