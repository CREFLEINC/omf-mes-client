import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ADMIN_DOCUMENT_TITLE,
  POP_DOCUMENT_TITLE,
  syncDocumentTitle,
  titleForPath,
  type TitleSyncTarget,
} from './document-title';
import { popRoutes } from '../routes/pop';

const originalTitle = document.title;

afterEach(() => {
  document.title = originalTitle;
});

describe('주소로 제목 가르기', () => {
  it('POP 라우트 표의 «모든» 경로가 POP 제목을 받는다', () => {
    expect(popRoutes.length).toBeGreaterThan(0);

    for (const { path } of popRoutes) {
      expect(titleForPath(path ?? '')).toBe(POP_DOCUMENT_TITLE);
    }
  });

  it('질의 문자열이 붙어도 POP 이다 — 진입 컨텍스트를 주소에 싣는 화면이 있다', () => {
    expect(titleForPath('/pop/material-input')).toBe(POP_DOCUMENT_TITLE);
  });

  it('관리웹 주소는 그대로 관리웹이다', () => {
    expect(titleForPath('/')).toBe(ADMIN_DOCUMENT_TITLE);
    expect(titleForPath('/production/emergency-work-orders')).toBe(ADMIN_DOCUMENT_TITLE);
    expect(titleForPath('/login')).toBe(ADMIN_DOCUMENT_TITLE);
  });

  /* ⛔ 「pop」이 들어간 관리웹 주소가 POP 으로 읽히면 안 된다 — 앞머리로만 판정한다. */
  it('주소 «안»에 pop 이 들어간 관리웹 주소를 POP 으로 읽지 않는다', () => {
    expect(titleForPath('/production/popular')).toBe(ADMIN_DOCUMENT_TITLE);
  });
});

describe('주소가 바뀌면 제목도 바뀐다', () => {
  const fakeRouter = (
    pathname: string,
  ): TitleSyncTarget & { go: (next: string) => void; unsubscribed: boolean } => {
    const listeners: ((state: { location: { pathname: string } }) => void)[] = [];
    const target = {
      state: { location: { pathname } },
      unsubscribed: false,
      subscribe(listener: (state: { location: { pathname: string } }) => void) {
        listeners.push(listener);
        return () => {
          target.unsubscribed = true;
        };
      },
      go(next: string) {
        target.state = { location: { pathname: next } };
        for (const listener of listeners) listener(target.state);
      },
    };

    return target;
  };

  it('POP 주소로 «바로» 들어와도 첫 화면부터 POP 제목이다', () => {
    const router = fakeRouter('/pop/tool-usage');

    syncDocumentTitle(router);

    expect(document.title).toBe(POP_DOCUMENT_TITLE);
  });

  it('셸을 오갈 때마다 따라 바뀐다', () => {
    const router = fakeRouter('/');
    syncDocumentTitle(router);
    expect(document.title).toBe(ADMIN_DOCUMENT_TITLE);

    router.go('/pop/material-input');
    expect(document.title).toBe(POP_DOCUMENT_TITLE);

    router.go('/production/work-order-progress');
    expect(document.title).toBe(ADMIN_DOCUMENT_TITLE);
  });

  it('구독을 끊을 수 있다', () => {
    const router = fakeRouter('/');
    const stop = syncDocumentTitle(router);

    stop();

    expect(router.unsubscribed).toBe(true);
  });

  it('시험이 진짜 라우터에 붙어도 같은 모양이다', () => {
    /* 구현이 라우터에서 무엇을 쓰는지 시험이 임의로 정하지 않게, 실물 형태를 한 번 확인한다. */
    const stop = vi.fn();
    const router: TitleSyncTarget = {
      state: { location: { pathname: '/pop/emergency-work-orders' } },
      subscribe: () => stop,
    };

    expect(syncDocumentTitle(router)).toBe(stop);
    expect(document.title).toBe(POP_DOCUMENT_TITLE);
  });
});
