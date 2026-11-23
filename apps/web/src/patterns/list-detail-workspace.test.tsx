import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { HUB_ACTIONS_ID } from './hub-actions';
import { ListDetailWorkspace, type ListDetailWorkspaceProps } from './list-detail-workspace';

const STORAGE_KEY = 'test:list-detail';

const renderWorkspace = (props: Partial<ListDetailWorkspaceProps> = {}) =>
  render(
    <ListDetailWorkspace
      storageKey={STORAGE_KEY}
      filter={{ label: '합성 조회 조건', content: <input aria-label="합성 검색어" /> }}
      list={{ label: '합성 목록', title: '합성 목록', count: 1234, content: <p>목록 내용</p> }}
      detail={{ label: '합성 상세', content: <input aria-label="합성 메모" /> }}
      {...props}
    />,
  );

const split = (): HTMLElement => document.querySelector<HTMLElement>('.list-detail-split')!;
const listTab = (): HTMLElement | null => split().querySelector<HTMLElement>('.po-board-list-tab');

afterEach(() => {
  window.localStorage.clear();
  document.getElementById(HUB_ACTIONS_ID)?.remove();
});

describe('ListDetailWorkspace — 목록 제목 줄 · 접기(#350)', () => {
  it('목록 맨 위에 이름 · 건수(앱 공통 「N건」 · 쉼표 없음) · 「목록 접기」가 선다', () => {
    renderWorkspace();
    const list = screen.getByRole('region', { name: '합성 목록' });

    expect(within(list).getByRole('heading', { name: '합성 목록' })).toBeInTheDocument();
    expect(list).toHaveTextContent('1234건');
    expect(within(list).getByRole('button', { name: '목록 접기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(split()).not.toHaveAttribute('data-left-collapsed');
    expect(listTab()).toBeNull();
  });

  it('「목록 접기」로 접으면 「목록 N건」 탭이 서고, 탭을 누르면 다시 펼친다 — 접힘은 브라우저에 남는다', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWorkspace();

    await user.click(screen.getAllByRole('button', { name: '목록 접기' })[0]!);
    expect(split()).toHaveAttribute('data-left-collapsed', 'true');
    expect(listTab()).toHaveTextContent('목록1234건');
    expect(window.localStorage.getItem(`${STORAGE_KEY}:split:collapsed`)).toBe('1');

    /* 다시 열어도 접힌 채다. */
    unmount();
    renderWorkspace();
    expect(split()).toHaveAttribute('data-left-collapsed', 'true');

    await user.click(listTab()!);
    expect(split()).not.toHaveAttribute('data-left-collapsed');
    expect(listTab()).toBeNull();
    expect(window.localStorage.getItem(`${STORAGE_KEY}:split:collapsed`)).toBe('0');
  });

  it('접었다 펴도 목록 · 상세에 적어 둔 값이 그대로다', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.type(screen.getByRole('textbox', { name: '합성 메모' }), '메모');

    await user.click(screen.getAllByRole('button', { name: '목록 접기' })[0]!);
    expect(screen.getByRole('textbox', { name: '합성 메모' })).toHaveValue('메모');
    await user.click(listTab()!);
    expect(screen.getByRole('textbox', { name: '합성 메모' })).toHaveValue('메모');
  });

  it('제목이 빈 글이면 건수 · 「목록 접기」만 서고, 건수가 없으면 건수도 두지 않는다', () => {
    const { unmount } = renderWorkspace({
      list: { label: '합성 목록', title: '', count: 3, content: <p>목록 내용</p> },
    });
    const list = screen.getByRole('region', { name: '합성 목록' });

    expect(within(list).queryByRole('heading')).toBeNull();
    expect(list).toHaveTextContent('3건');
    expect(within(list).getByRole('button', { name: '목록 접기' })).toBeInTheDocument();

    unmount();
    renderWorkspace({
      list: { label: '합성 목록', title: '합성 목록', content: <p>목록 내용</p> },
    });
    expect(screen.getByRole('region', { name: '합성 목록' })).not.toHaveTextContent('건');
  });
});

describe('ListDetailWorkspace — 배치 · 탭 줄(#350)', () => {
  it('셸 탭 줄이 없으면 칩 · 「⋯」이 조회 조건 위 한 줄에 서고, 있으면 「⋯」이 탭 줄로 간다', async () => {
    const { unmount } = renderWorkspace({ toolbar: <span>합성 칩</span> });
    const toolbar = document.querySelector('.list-detail-toolbar');

    expect(toolbar).toContainElement(screen.getByText('합성 칩'));
    expect(toolbar).toContainElement(screen.getByRole('button', { name: '더보기' }));
    expect(screen.getByRole('region', { name: '합성 조회 조건' })).toBeInTheDocument();

    unmount();
    const slot = document.createElement('div');
    slot.id = HUB_ACTIONS_ID;
    document.body.append(slot);
    renderWorkspace();

    expect(slot).toContainElement(await screen.findByRole('button', { name: '더보기' }));
    expect(document.querySelector('.list-detail-toolbar')).toBeNull();
  });

  it('상하 배치를 고르면 쌓이고, 같은 orientationKey 를 쓰는 다른 화면도 그 배치로 열린다', async () => {
    const user = userEvent.setup();
    const shared = 'test:shared-orientation';
    const { unmount } = renderWorkspace({ orientationKey: shared });
    expect(split()).not.toHaveClass('is-stacked');

    await user.click(screen.getByRole('button', { name: '더보기' }));
    await user.click(screen.getByRole('button', { name: '상하 배치' }));
    expect(split()).toHaveClass('is-stacked');
    expect(window.localStorage.getItem(shared)).toBe('column');
    expect(window.localStorage.getItem(`${STORAGE_KEY}:split-orientation`)).toBeNull();

    unmount();
    render(
      <ListDetailWorkspace
        storageKey="test:other-screen"
        orientationKey={shared}
        list={{ label: '다른 목록', title: '다른 목록', content: <p>다른 내용</p> }}
        detail={{ label: '다른 상세', content: <p>다른 상세</p> }}
      />,
    );
    expect(split()).toHaveClass('is-stacked');
  });

  it('orientationKey 가 없으면 화면 열쇠 몫으로 배치를 남긴다', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole('button', { name: '더보기' }));
    await user.click(screen.getByRole('button', { name: '상하 배치' }));
    expect(window.localStorage.getItem(`${STORAGE_KEY}:split-orientation`)).toBe('column');
  });

  it('상세가 bare 면 상자를 씌우지 않고 이름 붙은 구획으로만 선다', () => {
    renderWorkspace({
      detail: { label: '합성 상세', bare: true, content: <p>상세 내용</p> },
    });
    const detail = screen.getByRole('region', { name: '합성 상세' });

    expect(detail).toHaveClass('list-detail-detail', 'is-bare');
    expect(detail).not.toHaveClass('pane');
  });
});
