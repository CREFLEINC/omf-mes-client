import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TargetPane } from './target-pane';

const t = messages.approvalInbox;

const renderPane = (
  props: Partial<ComponentProps<typeof TargetPane>> = {},
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

  /* 늘 펼쳐 두지 않고 대상 제목 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */
  it('여기서 대상 내용을 읽는 자리가 아님을 제목 옆 ⓘ 로 밝힌다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: t.target.note })).toBeVisible();
    expect(screen.queryByText(t.target.note)).toBeNull();
  });

  it('열 수 있으면 그 경로를 들고 부른다', async () => {
    const user = userEvent.setup();
    const { onOpen } = renderPane();

    const open = screen.getByRole('button', { name: t.target.open });

    expect(open).toBeEnabled();

    await user.click(open);

    expect(onOpen).toHaveBeenCalledExactlyOnceWith('/synthetic/target');
  });

  it.each(['notOpenable' as const, 'noScreenId' as const, 'unmapped' as const])(
    '%s 갈래는 「열기」를 두지 않는다(#361)',
    (kind) => {
      renderPane({ openState: { kind } });

      expect(screen.queryByRole('button', { name: t.target.open })).toBeNull();
    },
  );

  it('잠긴 갈래여도 표시명은 그대로 보인다 — 무엇에 대한 결재인지가 사라지면 안 된다', () => {
    renderPane({ openState: { kind: 'notOpenable' } });

    expect(screen.getByText('합성 대상 문서 가')).toBeVisible();
  });

  it('표시명이 없으면 그 사실을 적는다 — 번호도 유형 코드도 대신 내지 않는다', () => {
    renderPane({ name: t.values.unknownTarget });

    const pane = screen.getByRole('group', { name: t.panes.target });

    expect(screen.getByText(t.values.unknownTarget)).toBeVisible();
    expect(pane.textContent).not.toContain('9401');
    expect(pane.textContent).not.toContain('INBOUND_LOT');
  });

  it('대상 유형으로 이름을 지어내지 않는다 — 받은 이름 하나만 낸다', () => {
    renderPane({ name: '합성 대상 문서 나' });

    const pane = screen.getByRole('group', { name: t.panes.target });

    /* 짝 방향 — 받은 이름은 실제로 그려진다. */
    expect(screen.getByText('합성 대상 문서 나')).toBeVisible();
    expect(pane.textContent).not.toContain('합성 대상 문서 가');
  });
});
