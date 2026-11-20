import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SummaryPane } from './summary-pane';

const t = messages.workOrderProgress.summary;

const renderPane = (total: number | null = 128): HTMLElement => {
  render(<SummaryPane total={total} />);

  return screen.getByRole('region', { name: t.title });
};

/**
 * 라벨이 붙은 카드의 값.
 *
 * 카드를 **이름으로** 집는다 — 라벨과 값이 «한 카드 안»에 있는지까지 함께 확인된다.
 * 화면에 같은 숫자가 딴 데 있어도 그것을 잘못 집지 않는다.
 */
const valueOf = (region: HTMLElement, label: string): string =>
  within(region).getByRole('group', { name: label }).textContent?.replace(label, '').trim() ?? '';

describe('SummaryPane', () => {
  it('요약을 제목이 있는 구획으로 구분한다', () => {
    const region = renderPane();

    expect(within(region).getByRole('heading', { level: 2, name: t.title })).toBeInTheDocument();
  });

  it('서버가 준 전체 건수를 보인다', () => {
    const region = renderPane(128);

    expect(valueOf(region, t.total)).toBe('128');
  });

  it('아직 받지 못했으면 전체도 비운다 — 0 으로 두지 않는다', () => {
    const region = renderPane(null);

    expect(valueOf(region, t.total)).toBe(t.unavailableMark);
    expect(valueOf(region, t.total)).not.toBe('0');
  });

  /*
   * ⛔ **L-1 — 화면이 목록을 받아 세면 안 된다.** 손에 쥔 것은 50건인데 요약이 답해야 하는
   * 질문은 「128건 중 몇 건인가」다. 모집단이 달라 근사값도 아니고 **다른 수**가 나온다.
   *
   * 이 구획은 목록을 **받지도 않는다** — 셀 재료가 없으면 셀 수 없다. 그 사실을 타입으로
   * 고정해 두는 것이 이 검사다.
   */
  it('⛔ 목록을 받지 않는다 — 셀 재료가 없으면 셀 수 없다', () => {
    const props = SummaryPane({ total: 128 }).props as Record<string, unknown>;

    expect(props).not.toHaveProperty('items');
  });

  /* 받을 수 없는 칸(상태별 건수 · 수량 합계 · 달성률)과 그 이유 문장은 세우지 않는다(C-4 · 관리웹 정리 시안 A). */
  it('받을 수 있는 「전체」 하나만 세우고 안내 문장을 두지 않는다', () => {
    const region = renderPane();

    expect(within(region).getAllByRole('group')).toHaveLength(1);
    expect(within(region).getByRole('group', { name: t.total })).toBeInTheDocument();
    expect(within(region).queryByRole('status')).toBeNull();
    expect(region).not.toHaveTextContent('서버가 아직 내려 주지 않습니다');
  });

  it('⛔ 이 구획에 컨트롤을 두지 않는다 — 읽는 자리다', () => {
    const region = renderPane();

    for (const role of ['button', 'checkbox', 'combobox', 'textbox', 'link'] as const) {
      expect(within(region).queryAllByRole(role)).toHaveLength(0);
    }
  });
});
