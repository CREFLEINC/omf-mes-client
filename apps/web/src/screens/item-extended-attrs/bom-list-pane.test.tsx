import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BomListPane } from './bom-list-pane';
import { bomFixtures } from './fixtures';

const renderPane = (overrides: Partial<Parameters<typeof BomListPane>[0]> = {}) => {
  const onRequestSetDefault = vi.fn<(bom: (typeof bomFixtures)[number]) => void>();

  render(
    <BomListPane
      boms={bomFixtures}
      isLoading={false}
      loadError={null}
      onRequestSetDefault={onRequestSetDefault}
      {...overrides}
    />,
  );

  return { onRequestSetDefault, user: userEvent.setup() };
};

const pane = (): HTMLElement => screen.getByRole('region', { name: '자재 명세서 목록' });

const rowCount = (): number => within(pane()).getAllByRole('row').length - 1;

describe('BomListPane — 원본을 고치는 수단이 없다', () => {
  /**
   * 헤더는 전 필드가 ERP 정본이다(계약: 「전 필드 읽기 전용 — QA #3」).
   * 계약에 `PUT /planning/boms/{bomId}`가 **아예 없어** 고치는 경로 자체가 없다 —
   * 잠긴 입력칸을 두면 「언젠가 열린다」는 뜻이 되는데 그 경로가 없다.
   */
  it('표에 입력칸이 하나도 없다', () => {
    renderPane();

    const region = pane();
    expect(within(region).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(region).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(region).queryAllByRole('switch')).toHaveLength(0);
    expect(within(region).queryAllByRole('checkbox')).toHaveLength(0);
  });

  /** 추가·수정·삭제가 계약에 없다 — 그 액션을 두면 누를 수 없는 버튼이 남는다. */
  it('기본 지정 밖의 액션이 없다', () => {
    renderPane();

    const labels = within(pane())
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);

    for (const label of labels) {
      expect(label).toMatch(/기본으로 지정$/);
    }
  });
});

describe('BomListPane — 표기', () => {
  it('받은 줄을 모두 낸다', () => {
    renderPane();

    expect(rowCount()).toBe(2);
    expect(within(pane()).getByText('SYN-BOM-01')).toBeInTheDocument();
    expect(within(pane()).getByText('SYN-BOM-02')).toBeInTheDocument();
  });

  /* 값 목록이 확정되지 않아 이름을 지어내지 않는다 — 품목유형과 같은 처리다. */
  it('상태 코드를 이름으로 바꾸지 않는다', () => {
    renderPane();

    expect(within(pane()).getByText('SYN-BOM-STATUS-A')).toBeInTheDocument();
  });

  it('기본인 줄에만 표식이 붙는다', () => {
    renderPane();

    const rows = within(pane()).getAllByRole('row');
    // 첫 줄은 머리글이라 건너뛴다. 표식은 자료 줄에서만 센다.
    expect(within(rows[1]!).queryByText('기본')).toBeNull();
    expect(within(rows[2]!).getByText('기본')).toBeInTheDocument();
  });

  /* 유효 종료를 비우면 무기한이다 — 빈 칸으로 두면 빠뜨린 것으로 읽힌다. */
  it('유효 종료가 없으면 값 없음 표기를 낸다', () => {
    renderPane();

    expect(within(pane()).getByText('2026-01-01 ~ 2026-12-31')).toBeInTheDocument();
    expect(within(pane()).getByText('2026-03-01 ~ —')).toBeInTheDocument();
  });

  it('빈 목록에 안내를 낸다', () => {
    renderPane({ boms: [] });

    expect(screen.getByText('등록된 자재 명세서가 없습니다')).toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 자리표시를 낸다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '자재 명세서를 불러오는 중' })).toBeInTheDocument();
    expect(within(pane()).queryAllByRole('row')).toHaveLength(0);
  });

  /* 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  it('조회 실패는 표를 밀어낸다', () => {
    renderPane({ loadError: <p>조회에 실패했습니다</p>, isLoading: true });

    expect(screen.getByText('조회에 실패했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: '자재 명세서를 불러오는 중' })).toBeNull();
  });
});

/**
 * M22 — **이미 기본인 줄의 지정 액션을 감추지 않는다.**
 *
 * 감추면 그 줄에만 액션이 없는 이유를 알 수 없다. 사유 없는 비활성도 같다 —
 * 배치 규범 4는 사유를 보이는 텍스트로 렌더하고 `aria-describedby`로 잇기를 요구한다.
 */
describe('BomListPane — 기본 지정 (M22)', () => {
  it('기본이 아닌 줄에서 확인 창을 요청한다', async () => {
    const { onRequestSetDefault, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'SYN-BOM-01 · Rev 1 기본으로 지정' }));

    expect(onRequestSetDefault).toHaveBeenCalledTimes(1);
    expect(onRequestSetDefault.mock.calls[0]?.[0].bomId).toBe(2001);
  });

  /**
   * **줄마다 지정 액션이 하나씩 있다.** 기본인 줄에서 액션을 지우면 그 줄에만 아무것도 없는
   * 이유를 알 수 없다 — 감추는 대신 사유를 붙여 비활성으로 둔다.
   */
  it('두 줄 모두 지정 액션을 갖고 하나만 비활성이다', () => {
    renderPane();

    const actions = within(pane()).getAllByRole('button', { name: /기본으로 지정$/ });

    expect(actions).toHaveLength(2);
    expect(actions.filter((button) => button.hasAttribute('disabled'))).toHaveLength(1);
  });

  it('이미 기본인 줄의 지정은 비활성이고 사유가 컨트롤에 이어진다', () => {
    renderPane();

    const disabled = within(pane()).getByRole('button', { name: '기본으로 지정' });
    expect(disabled).toBeDisabled();

    const describedBy = disabled.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();

    const reason = document.getElementById(describedBy ?? '');
    expect(reason?.textContent).toBe(
      '기본 지정은 이 자재 명세서가 이미 기본이라 할 수 없습니다. 기본을 옮기려면 다른 줄에서 지정하세요.',
    );
  });

  /* 사유는 감추지 않고 항상 보이는 DOM 텍스트여야 한다 — 비활성 컨트롤은 포커스를 받지 못한다. */
  it('사유가 화면에 보이는 텍스트다', () => {
    renderPane();

    expect(screen.getByText(/기본을 옮기려면 다른 줄에서 지정하세요/)).toBeInTheDocument();
  });
});
