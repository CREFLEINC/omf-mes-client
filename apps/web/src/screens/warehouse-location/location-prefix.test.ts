import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateLocationPrefix, isValidLocationPrefix } from './location-prefix';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateLocationPrefix', () => {
  it('헷갈리는 글자(I · L · O · 0 · 1) 없이 대문자 · 숫자 4자를 짓는다', () => {
    for (let index = 0; index < 200; index += 1) {
      const code = generateLocationPrefix();

      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/u);
      expect(isValidLocationPrefix(code)).toBe(true);
    }
  });

  it('글자 수의 배수를 넘는 바이트(248 이상)는 버린다 — 앞 글자로 치우치지 않는다', () => {
    const batches = [
      [248, 255, 0, 250, 1, 249, 2, 251],
      [3, 0, 0, 0, 0, 0, 0, 0],
    ];
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint8Array).set(batches.shift() ?? []);
      return array;
    });

    expect(generateLocationPrefix()).toBe('ABCD');
  });
});

describe('isValidLocationPrefix', () => {
  it('대문자 · 숫자 2~6자만 받는다', () => {
    expect(isValidLocationPrefix('K7')).toBe(true);
    expect(isValidLocationPrefix('ABC123')).toBe(true);
    expect(isValidLocationPrefix('K')).toBe(false);
    expect(isValidLocationPrefix('ABCDEFG')).toBe(false);
    expect(isValidLocationPrefix('k7pm')).toBe(false);
    expect(isValidLocationPrefix('K7-P')).toBe(false);
  });
});
