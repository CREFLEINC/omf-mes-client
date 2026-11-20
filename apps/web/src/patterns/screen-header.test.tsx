import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HUB_ACTIONS_ID } from './hub-actions';
import { PageHubContext } from './page-hub';
import { ScreenHeader } from './screen-header';

afterEach(() => {
  document.getElementById(HUB_ACTIONS_ID)?.remove();
});

const mountHubTarget = (): HTMLElement => {
  const target = document.createElement('div');
  target.id = HUB_ACTIONS_ID;
  document.body.append(target);
  return target;
};

describe('ScreenHeader — 탭 묶음 안에서는 머리를 세우지 않는다', () => {
  it('묶음 밖이면 경로와 제목을 세운다', () => {
    render(<ScreenHeader title="시험 화면" breadcrumb={<nav aria-label="탐색 경로">경로</nav>} />);

    expect(screen.getByRole('heading', { name: '시험 화면' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '탐색 경로' })).toBeInTheDocument();
  });

  it('묶음 안이면 제목과 경로가 없고, 머리의 단추는 탭 막대 오른쪽 자리로 간다', async () => {
    const target = mountHubTarget();
    render(
      <PageHubContext.Provider value={{ title: '시험 묶음' }}>
        <ScreenHeader
          title="시험 화면"
          breadcrumb={<nav aria-label="탐색 경로">경로</nav>}
          actions={<button type="button">다시 조회</button>}
        />
      </PageHubContext.Provider>,
    );

    expect(screen.queryByRole('heading', { name: '시험 화면' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: '탐색 경로' })).toBeNull();
    expect(await within(target).findByRole('button', { name: '다시 조회' })).toBeInTheDocument();
  });

  it('묶음 안이고 단추가 없으면 아무것도 그리지 않는다', () => {
    mountHubTarget();
    const { container } = render(
      <PageHubContext.Provider value={{ title: '시험 묶음' }}>
        <ScreenHeader title="시험 화면" />
      </PageHubContext.Provider>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
