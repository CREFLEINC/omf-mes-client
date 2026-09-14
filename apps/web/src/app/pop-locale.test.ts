import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * POP 단말이 Windows 표시 언어를 따르는가.
 *
 * `pop-locale.ts` 는 불러 들이는 순간 언어를 정한다. 그래서 모듈을 매번 새로 싣고, 운영체제가
 * 주는 언어표(`navigator.languages`)를 바꿔 끼워 잰다. 모듈을 새로 실으면 문구 묶음도 새로
 * 실리므로, 잴 때도 그 새 묶음을 읽는다.
 */
const bootWith = async (languages: readonly string[]) => {
  vi.spyOn(globalThis.navigator, 'languages', 'get').mockReturnValue(languages);
  vi.resetModules();
  await import('./pop-locale');

  return import('@omf-mes/i18n');
};

describe('POP 언어 — 운영체제 표시 언어를 따른다', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = 'ko';
  });

  it('베트남어 Windows 면 POP 화면 문구가 베트남어다', async () => {
    const { activeLocale, ko, messages, vi: viMessages } = await bootWith(['vi-VN', 'en-US']);

    expect(activeLocale()).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
    expect(messages.workStart).toBe(viMessages.workStart);
    expect(messages.workStart).not.toBe(ko.workStart);
  });

  it('한국어 Windows 면 한국어다', async () => {
    const { activeLocale, ko, messages } = await bootWith(['ko-KR']);

    expect(activeLocale()).toBe('ko');
    expect(messages.workStart).toBe(ko.workStart);
  });

  /* 옮기지 않은 언어로 빈 화면을 내는 것보다 읽을 수 있는 한국어가 낫다. */
  it('모르는 언어면 한국어로 둔다', async () => {
    const { activeLocale } = await bootWith(['en-US', 'ja-JP']);

    expect(activeLocale()).toBe('ko');
    expect(document.documentElement.lang).toBe('ko');
  });
});
