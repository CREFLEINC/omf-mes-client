import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TargetPane } from './target-pane';

const t = messages.approvalInbox;

const renderPane = (
  props: Partial<React.ComponentProps<typeof TargetPane>> = {},
): { onOpen: ReturnType<typeof vi.fn> } => {
  const onOpen = vi.fn();

  render(
    <TargetPane
      name="합성 대상 문서 가"
      openState={{ kind: 'open', path: '/synthetic/target' }}
      onOpen={onOpen}
      {...props}
    />,
  );

  return { onOpen };
};

describe('TargetPane', () => {
  it('서버가 만든 표시명을 그대로 낸다', () => {
    renderPane();

    expect(screen.getByText('합성 대상 문서 가')).toBeVisible();
  });

  it('여기서 대상 내용을 읽는 자리가 아님을 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.target.note)).toBeVisible();
  });

  it('열 수 있으면 그 경로를 들고 부른다', async () => {
    const user = userEvent.setup();
    const { onOpen } = renderPane();

    const open = screen.getByRole('button', { name: t.target.open });

    expect(open).toBeEnabled();

    await user.click(open);

    expect(onOpen).toHaveBeenCalledExactlyOnceWith('/synthetic/target');
  });

  it('열 수 있는 대상에는 잠긴 사유가 붙지 않는다', () => {
    renderPane();

    expect(screen.queryByText(t.target.blockedNotOpenable)).not.toBeInTheDocument();
    expect(screen.queryByText(t.target.blockedNoScreenId)).not.toBeInTheDocument();
    expect(screen.queryByText(t.target.blockedUnmapped)).not.toBeInTheDocument();
  });

  it.each([
    ['notOpenable' as const, t.target.blockedNotOpenable],
    ['noScreenId' as const, t.target.blockedNoScreenId],
    ['unmapped' as const, t.target.blockedUnmapped],
  ])('%s 갈래는 잠기고 그 갈래의 사유가 버튼의 설명이 된다', async (kind, reason) => {
    const user = userEvent.setup();
    const { onOpen } = renderPane({ openState: { kind } });

    const open = screen.getByRole('button', { name: t.target.open });

    expect(open).toBeDisabled();
    expect(open).toHaveAccessibleDescription(reason);
    expect(screen.getByText(reason)).toBeVisible();

    await user.click(open);

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('잠긴 갈래여도 표시명은 그대로 보인다 — 무엇에 대한 결재인지가 사라지면 안 된다', () => {
    renderPane({ openState: { kind: 'notOpenable' } });

    expect(screen.getByText('합성 대상 문서 가')).toBeVisible();
  });

  it('표시명이 없으면 그 사실을 적는다 — 번호도 유형 코드도 대신 내지 않는다', () => {
    renderPane({ name: t.values.unknownTarget });

    const pane = screen.getByRole('group', { name: t.panes.target });

    expect(screen.getByText(t.values.unknownTarget)).toBeVisible();
    expect(pane.textContent).not.toContain('9401');
    expect(pane.textContent).not.toContain('SAMPLE-TARGET');
  });

  it('대상 유형으로 이름을 지어내지 않는다 — 받은 이름 하나만 낸다', () => {
    renderPane({ name: '합성 대상 문서 나' });

    const pane = screen.getByRole('group', { name: t.panes.target });

    /* 짝 방향 — 받은 이름은 실제로 그려진다. */
    expect(screen.getByText('합성 대상 문서 나')).toBeVisible();
    expect(pane.textContent).not.toContain('합성 대상 문서 가');
  });
});
