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

  describe('아직 받을 수 없는 칸', () => {
    it.each([
      ['대기', t.waiting],
      ['진행중', t.running],
      ['완료', t.done],
      ['마감', t.closed],
      ['지연', t.delayed],
      ['양품', t.goodQty],
      ['불량', t.defectQty],
      ['손실', t.lossQty],
      ['달성률', t.achievementRate],
    ])('%s 칸은 비운 채 둔다 — 숫자를 지어내지 않는다', (_name, label) => {
      const region = renderPane();

      expect(valueOf(region, label)).toBe(t.unavailableMark);
    });

    /* ⛔ 감추면 「이 화면엔 원래 없다」로 읽힌다. 칸은 제자리에 있어야 한다. */
    it('⛔ 칸 자체를 없애지 않는다 — 열 개가 모두 자리에 있다', () => {
      const region = renderPane();

      for (const label of [
        t.total,
        t.waiting,
        t.running,
        t.done,
        t.closed,
        t.delayed,
        t.goodQty,
        t.defectQty,
        t.lossQty,
        t.achievementRate,
      ]) {
        expect(within(region).getByRole('group', { name: label })).toBeInTheDocument();
      }
    });
  });

  /*
   * ⛔ 「집계를 못 받습니다」로만 적으면 옆의 「전체 128」까지 못 믿을 값으로 읽힌다.
   * 무엇이 정확하고 무엇이 없는지를 한 문장에 담는다.
   */
  it('⛔ 비운 이유를 적되, 전체 건수는 정확하다는 것도 함께 말한다', () => {
    const region = renderPane();
    const notice = within(region).getByText(t.unavailable);

    expect(notice).toHaveTextContent('서버가 아직 내려 주지 않습니다');
    expect(notice).toHaveTextContent('전체 건수만 정확합니다');
  });

  it('⛔ 이 구획에 컨트롤을 두지 않는다 — 읽는 자리다', () => {
    const region = renderPane();

    for (const role of ['button', 'checkbox', 'combobox', 'textbox', 'link'] as const) {
      expect(within(region).queryAllByRole(role)).toHaveLength(0);
    }
  });
});
