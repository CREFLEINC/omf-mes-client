import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setLocale } from '@omf-mes/i18n';

import { OutboxProvider } from '../patterns/outbox';
import { WorkerSessionProvider } from '../patterns/worker-session';

const HANGUL = /[가-힣]/;

/**
 * 화면 뼈대의 이름은 문구 묶음 밖에 있다. 디자인 시스템이 기본값을 한국어로 들고 있어,
 * 넘겨주지 않으면 문구를 다 옮겨도 본문·건너뛰기·알림 자리만 한국어로 남는다.
 *
 * 실기기 순회에서 실제로 이 셋이 남아 있었다. 문구 묶음만 보는 감지기는 이것을 못 본다.
 */
describe('베트남어 셸', () => {
  beforeEach(() => {
    setLocale('vi');
  });

  afterEach(() => {
    setLocale('ko');
  });

  it('뼈대의 이름에 한국어가 남지 않는다', async () => {
    /* 뼈대가 문구를 모듈 최상위에서 붙잡으므로 언어를 정한 뒤에 싣는다. */
    const { AppLayout } = await import('./layout');

    const { container } = render(
      <MemoryRouter>
        <OutboxProvider send={async () => ({ ok: true })}>
          <WorkerSessionProvider>
            <AppLayout>
              <p>noi dung</p>
            </AppLayout>
          </WorkerSessionProvider>
        </OutboxProvider>
      </MemoryRouter>,
    );

    const offenders: string[] = [];

    for (const element of container.querySelectorAll('*')) {
      for (const name of ['aria-label', 'title', 'alt', 'placeholder']) {
        const value = element.getAttribute(name);

        if (value !== null && HANGUL.test(value)) {
          offenders.push(`${element.tagName}[${name}] — ${value}`);
        }
      }

      for (const node of element.childNodes) {
        const text = node.nodeType === node.TEXT_NODE ? (node.textContent ?? '').trim() : '';

        if (text !== '' && HANGUL.test(text)) {
          offenders.push(`${element.tagName} — ${text}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
