import { describe, expect, it } from 'vitest';

import {
  type KeyInput,
  isAllowedNavigation,
  isBlockedKey,
  isMaintenanceExit,
  shouldLockKiosk,
} from './kiosk-lock';

const press = (key: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  type: 'keyDown',
  key,
  control: false,
  alt: false,
  shift: false,
  meta: false,
  ...mods,
});

describe('셸 밖으로 나가는 키를 삼킨다 — #901 로 올라온 실기 증상', () => {
  it('Alt+F4 로 앱이 닫히지 않는다', () => {
    expect(isBlockedKey(press('F4', { alt: true }))).toBe(true);
  });

  it('F11 로 전체 화면이 풀리지 않는다', () => {
    expect(isBlockedKey(press('F11'))).toBe(true);
  });

  it('Alt+Tab 으로 다른 창에 가지 않는다', () => {
    expect(isBlockedKey(press('Tab', { alt: true }))).toBe(true);
  });

  it('창을 닫는 나머지 길도 함께 막는다 — Ctrl+W · Alt+Space · Ctrl+Esc', () => {
    expect(isBlockedKey(press('w', { control: true }))).toBe(true);
    expect(isBlockedKey(press(' ', { alt: true }))).toBe(true);
    expect(isBlockedKey(press('Escape', { control: true }))).toBe(true);
  });

  it('Windows 키 단독으로 시작 메뉴를 열지 못한다', () => {
    expect(isBlockedKey(press('Meta'))).toBe(true);
  });

  it('대소문자가 어떻게 오든 같게 판정한다 — 조합키에 따라 표기가 갈린다', () => {
    expect(isBlockedKey(press('f4', { alt: true }))).toBe(true);
    expect(isBlockedKey(press('W', { control: true, shift: true }))).toBe(true);
  });

  it('뗄 때는 판정하지 않는다 — 누를 때 한 번만 삼킨다', () => {
    expect(isBlockedKey({ ...press('F11'), type: 'keyUp' })).toBe(false);
  });
});

describe('화면 안에서 쓰는 키는 건드리지 않는다', () => {
  it.each([
    ['숫자', press('7')],
    ['탭 이동', press('Tab')],
    ['엔터', press('Enter')],
    ['지우기', press('Backspace')],
    ['취소', press('Escape')],
    ['공백', press(' ')],
    ['F4 단독', press('F4')],
  ])('%s 는 그대로 통과한다', (_label, input) => {
    expect(isBlockedKey(input)).toBe(false);
  });
});

describe('정비용 탈출구 하나 — Ctrl+Alt+Shift+Q', () => {
  const exit = press('q', { control: true, alt: true, shift: true });

  it('네 손가락 조합이면 나간다', () => {
    expect(isMaintenanceExit(exit)).toBe(true);
  });

  it('삼켜지지 않는다 — 삼키면 탈출구가 없는 것과 같다', () => {
    expect(isBlockedKey(exit)).toBe(false);
  });

  it.each([
    ['Shift 빠짐', press('q', { control: true, alt: true })],
    ['Alt 빠짐', press('q', { control: true, shift: true })],
    ['Ctrl 빠짐', press('q', { alt: true, shift: true })],
    ['Q 단독', press('q')],
    ['다른 글쇠', press('a', { control: true, alt: true, shift: true })],
  ])('%s 은 탈출구가 아니다 — 작업 중 실수로 꺼지면 안 된다', (_label, input) => {
    expect(isMaintenanceExit(input)).toBe(false);
  });
});

describe('화면 안 링크 — 허용된 곳 밖으로 못 나간다', () => {
  const origin = 'pop://app';

  it.each([
    ['자기 자신', 'pop://app'],
    ['화면 경로', 'pop://app/pop/work-start'],
    ['질의 문자열', 'pop://app?tab=1'],
    ['해시', 'pop://app#/pop/work-start'],
  ])('%s 은 따라간다', (_label, url) => {
    expect(isAllowedNavigation(url, origin)).toBe(true);
  });

  it.each([
    ['앞자리만 같은 다른 곳', 'pop://appelsewhere/x'],
    ['바깥 웹', 'https://example.com/'],
    ['디스크', 'file:///etc/passwd'],
    ['스킴만 같은 다른 호스트', 'pop://other/x'],
  ])('%s 은 막는다', (_label, url) => {
    expect(isAllowedNavigation(url, origin)).toBe(false);
  });

  it('개발 서버를 물었을 때도 같은 경계로 잰다', () => {
    expect(isAllowedNavigation('http://localhost:5173/pop', 'http://localhost:5173')).toBe(true);
    expect(isAllowedNavigation('http://localhost:51730/', 'http://localhost:5173')).toBe(false);
  });

  it('허용값이 끝 슬래시로 와도 같게 판정한다 — 그 표기를 막는 곳이 없다', () => {
    expect(isAllowedNavigation('http://localhost:5173/pop', 'http://localhost:5173/')).toBe(true);
    expect(isAllowedNavigation('http://localhost:5173', 'http://localhost:5173/')).toBe(true);
    expect(isAllowedNavigation('http://localhost:51730/', 'http://localhost:5173/')).toBe(false);
  });
});

describe('언제 잠그는가', () => {
  it('배포본은 잠근다', () => {
    expect(shouldLockKiosk({ isDev: false })).toBe(true);
  });

  it('개발본은 잠그지 않는다 — 창을 못 닫으면 화면 작업이 막힌다', () => {
    expect(shouldLockKiosk({ isDev: true })).toBe(false);
  });

  it('개발본에서도 손잡이로 켤 수 있다 — 안 그러면 고쳤는지 확인할 길이 없다', () => {
    expect(shouldLockKiosk({ isDev: true, override: '1' })).toBe(true);
  });

  it('배포본에서도 손잡이로 끌 수 있다 — 확인용이다', () => {
    expect(shouldLockKiosk({ isDev: false, override: '0' })).toBe(false);
  });

  it('손잡이에 엉뚱한 값이 들어오면 무시한다 — 오타로 현장 단말이 풀리면 안 된다', () => {
    expect(shouldLockKiosk({ isDev: false, override: 'yes' })).toBe(true);
    expect(shouldLockKiosk({ isDev: false, override: '' })).toBe(true);
  });
});
