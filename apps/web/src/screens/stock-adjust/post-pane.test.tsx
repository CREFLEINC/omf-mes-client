import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { readPosting } from './approval-progress';
import { PostPane, type PostPaneProps } from './post-pane';

const t = messages.stockAdjust;

const DRAFT = { businessDate: '2026-08-18', occurredAtLocal: '2026-08-18T14:05' };

const renderPane = (overrides: Partial<PostPaneProps> = {}) => {
  const onToggle = vi.fn();
  const onChangeDraft = vi.fn();
  const onRequestPost = vi.fn();

  /** 같은 부품을 값만 갈아 다시 그린다 — 펼침 전이를 **한 인스턴스에서** 재려면 필요하다. */
  const element = (extra: Partial<PostPaneProps>) => (
    <PostPane
      inventoryAdjustmentNo="SAMPLE-IA-9301"
      isExpanded
      draft={DRAFT}
      errors={{}}
      fieldErrors={{}}
      isPosting={false}
      hasFailed={false}
      posting={readPosting(null)}
      blockReason={null}
      banner={null}
      onToggle={onToggle}
      onChangeDraft={onChangeDraft}
      onRequestPost={onRequestPost}
      {...overrides}
      {...extra}
    />
  );

  const view = render(element({}));

  return {
    onToggle,
    onChangeDraft,
    onRequestPost,
    user: userEvent.setup(),
    rerender: (extra: Partial<PostPaneProps>): void => {
      view.rerender(element(extra));
    },
  };
};

const pane = (): HTMLElement => screen.getByRole('region', { name: t.post.label });

const toggleButton = (): HTMLElement =>
  within(pane()).getByRole('button', { name: t.actions.togglePost });

const postButton = (): HTMLElement => within(pane()).getByRole('button', { name: t.actions.post });

/**
 * ⭐ **접힌 두 번째 선택지**(D-12) — 앞자리 주 버튼은 「조정 상신」이고 이 길은 펼쳐야 나온다.
 */
describe('PostPane — 접힌 두 번째 선택지', () => {
  it('접혀 있으면 두 칸과 전기 버튼이 없다', () => {
    renderPane({ isExpanded: false });

    /* 짝 양성 — 구획과 여는 손잡이는 실제로 섰다. */
    expect(toggleButton()).toHaveAttribute('aria-expanded', 'false');
    expect(within(pane()).queryByLabelText(t.post.businessDate)).not.toBeInTheDocument();
    expect(within(pane()).queryByLabelText(t.post.occurredAt)).not.toBeInTheDocument();
    expect(within(pane()).queryByRole('button', { name: t.actions.post })).not.toBeInTheDocument();
  });

  /**
   * **접혀 있는 동안에는 없는 요소를 가리키지 않는다**(리뷰 R-6).
   *
   * 본문이 조건부 렌더라 접히면 그 id를 가진 요소가 **DOM에 없다** — `aria-controls`는 존재하는
   * 요소를 가리켜야 하고, 없는 id를 가리키면 보조기술이 그 관계를 버린다. 펼치면 다시 가리킨다.
   */
  it('aria-controls가 펼쳤을 때만 본문을 가리킨다', () => {
    const { rerender } = renderPane({ isExpanded: false });

    expect(toggleButton()).not.toHaveAttribute('aria-controls');

    rerender({ isExpanded: true });

    const controls = toggleButton().getAttribute('aria-controls');

    expect(controls).not.toBeNull();
    expect(document.getElementById(controls ?? '')).not.toBeNull();
  });

  it('펼치면 두 칸과 전기 버튼이 선다', () => {
    renderPane();

    expect(toggleButton()).toHaveAttribute('aria-expanded', 'true');
    expect(within(pane()).getByLabelText(t.post.businessDate)).toHaveValue('2026-08-18');
    expect(within(pane()).getByLabelText(t.post.occurredAt)).toHaveValue('2026-08-18T14:05');
    expect(postButton()).toBeEnabled();
  });

  it('여는 손잡이를 누르면 화면에 알린다 — 부품이 스스로 펼치지 않는다', async () => {
    const { onToggle, user } = renderPane({ isExpanded: false });

    await user.click(toggleButton());

    expect(onToggle).toHaveBeenCalledTimes(1);
    /* 부품이 상태를 들지 않는다 — 눌러도 제 손으로 열리지 않는다(매임의 축이 전표다). */
    expect(toggleButton()).toHaveAttribute('aria-expanded', 'false');
  });

  /** 두 칸의 값은 **화면이 든다** — 부품은 고친 사실만 올려 보낸다. */
  it('칸을 고치면 그 값만 올려 보낸다', async () => {
    const { onChangeDraft, user } = renderPane();

    await user.clear(within(pane()).getByLabelText(t.post.businessDate));

    expect(onChangeDraft).toHaveBeenCalledWith({ businessDate: '' });
  });
});

/**
 * **잠갔으면 사유가 반드시 함께 선다** — 사유 없는 잠금은 죽은 버튼과 구분되지 않는다.
 */
describe('PostPane — 잠금과 사유', () => {
  it('잠긴 사유가 버튼에 이어져 보인다', () => {
    renderPane({ blockReason: t.actionReasons.postDraftInvalid });

    const reason = within(pane()).getByText(t.actionReasons.postDraftInvalid);

    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAttribute('aria-describedby', reason.id);
  });

  /** **열려 있으면 사유를 그리지 않는다** — 늘 서 있으면 읽히지 않는다. */
  it('열려 있으면 사유가 서지 않는다', () => {
    renderPane();

    expect(postButton()).toBeEnabled();
    expect(postButton()).not.toHaveAttribute('aria-describedby');
  });

  it('두 칸에 화면이 잡은 오류가 붙는다', () => {
    renderPane({
      errors: {
        businessDate: t.errors.businessDateRequired,
        occurredAt: t.errors.occurredAtRequired,
      },
    });

    expect(within(pane()).getByText(t.errors.businessDateRequired)).toBeVisible();
    expect(within(pane()).getByText(t.errors.occurredAtRequired)).toBeVisible();
  });

  /** 서버가 준 오류도 **같은 칸**에 붙는다 — 자리를 나누면 사용자가 두 곳을 살펴야 한다. */
  it('서버가 준 칸 오류가 같은 칸에 붙는다', () => {
    renderPane({ fieldErrors: { businessDate: '합성 영업일 거절', occurredAt: '합성 시각 거절' } });

    expect(within(pane()).getByText('합성 영업일 거절')).toBeVisible();
    expect(within(pane()).getByText('합성 시각 거절')).toBeVisible();
  });

  /** 나가는 중에는 칸도 함께 잠근다 — 보낸 값과 화면의 값이 갈리지 않게 한다. */
  it('나가는 중에는 두 칸이 잠긴다', () => {
    renderPane({ isPosting: true, blockReason: t.actionReasons.posting });

    expect(within(pane()).getByLabelText(t.post.businessDate)).toBeDisabled();
    expect(within(pane()).getByLabelText(t.post.occurredAt)).toBeDisabled();
  });

  it('실패 배너 자리가 버튼과 같은 구획에 있다', () => {
    renderPane({ banner: <p>합성 전기 거절</p>, hasFailed: true });

    expect(within(pane()).getByText('합성 전기 거절')).toBeVisible();
  });

  /**
   * ⭐ **전표는 남고 전기만 실패한 갈래를 정확히 말한다.**
   *
   * 통째로 실패라고 말하면 사용자가 처음부터 다시 만들어 **전표가 두 벌** 남는다.
   */
  it('실패해도 전표가 남았다는 사실을 말한다', () => {
    renderPane({ hasFailed: true });

    expect(within(pane()).getByText(t.post.failedTitle('SAMPLE-IA-9301'))).toBeVisible();
    /* 다시 전기할 수 있어야 한다 — 칸과 버튼이 남는다. */
    expect(postButton()).toBeEnabled();
  });
});

/**
 * ⭐ **전기 결과** — 화면이 받은 200이 근거다(C35).
 */
describe('PostPane — 전기 결과', () => {
  it('전기 시각은 공장 시각(UTC+7)으로, 전기 뒤 상태는 서버가 준 그대로 낸다', () => {
    renderPane({
      posting: readPosting({
        adjustedAt: '2026-08-18T14:05:00+09:00',
        statusCode: 'SAMPLE_IA_STATUS_B',
      }),
    });

    /* 성공 문장은 오른쪽 아래 알림으로 나가고 구획에는 서지 않는다(#360). */
    expect(
      within(pane()).queryByText(t.post.postedTitle('SAMPLE-IA-9301')),
    ).not.toBeInTheDocument();
    expect(within(pane()).getByText('2026-08-18 12:05')).toBeVisible();
    expect(within(pane()).getByText('SAMPLE_IA_STATUS_B')).toBeVisible();
  });

  /**
   * ⭐ **전기한 뒤에는 칸과 버튼을 두지 않는다.** 칠 수 있는데 보낼 수 없는 칸을 남기지 않는다.
   */
  it('전기한 뒤에는 두 칸과 버튼이 걷힌다', () => {
    renderPane({
      posting: readPosting({ adjustedAt: '2026-08-18T14:05:00+09:00', statusCode: 'SAMPLE_S_B' }),
    });

    /* 짝 양성 — 결과가 실제로 섰다. */
    expect(within(pane()).getByText(t.post.adjustedAt)).toBeVisible();
    expect(within(pane()).queryByLabelText(t.post.businessDate)).not.toBeInTheDocument();
    expect(within(pane()).queryByRole('button', { name: t.actions.post })).not.toBeInTheDocument();
  });

  /**
   * ⭐ **200은 왔는데 전기 시각이 비어 온 갈래**(계약이 nullable로 두었다).
   *
   * 빈 자리로 두면 「불러오지 못한 것」처럼 보이고, 지어내면 없는 사실을 말한다.
   */
  it('전기 시각이 오지 않으면 그 사실을 적는다', () => {
    renderPane({ posting: readPosting({ adjustedAt: null, statusCode: 'SAMPLE_S_B' }) });

    expect(within(pane()).getByText(t.post.adjustedAt)).toBeVisible();
    expect(within(pane()).getByText(t.post.adjustedAtUnknown)).toBeVisible();
  });

  /**
   * ⛔ **승인·반려 조작이 이 구획에 없다**(조심 ① · D-3) — 결재함(W-CO-09)이 소유한다.
   * 내부 번호도 그리지 않는다(`omf-mes#44`).
   */
  it('승인·반려 조작이 없고 내부 번호도 그리지 않는다', () => {
    renderPane({
      inventoryAdjustmentNo: 'SAMPLE-IA-A',
      posting: readPosting({ adjustedAt: '2026-08-18T14:05:00+09:00', statusCode: 'SAMPLE_S_B' }),
    });

    /* 짝 양성 — 결과가 실제로 섰다. */
    expect(within(pane()).getByText(t.post.adjustedAt)).toBeVisible();
    expect(within(pane()).getAllByRole('button')).toHaveLength(1);
    expect(pane().textContent ?? '').not.toContain('9301');
  });
});
