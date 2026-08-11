import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HistoryPane } from './history-pane';

const t = messages.stocktaking;

const historyRegion = (): HTMLElement => screen.getByRole('group', { name: t.history.label });

const historyButton = (): HTMLElement =>
  within(historyRegion()).getByRole('button', { name: t.history.action });

describe('HistoryPane — 자리만 두고 비활성', () => {
  /*
   * **착수 이슈 §4 · 완료 조건 C49** — 범용 이력 테이블의 사용 규약이 없어 무엇을 어떻게
   * 보일지 정해지지 않았다(`omf-mes#68`). 구획 자체를 만들지 않으면 「이력이 없다」로 읽히고,
   * 활성으로 두면 눌러도 아무 일이 없다 — **자리와 사유를 함께** 두는 것이 지금 사실을 가장
   * 정확히 옮긴다.
   */
  it('버튼이 비활성이고 사유가 함께 보인다', () => {
    render(<HistoryPane />);

    expect(historyButton()).toBeDisabled();
    expect(within(historyRegion()).getByText(t.actionReasons.historyPending)).toBeInTheDocument();
  });

  /*
   * **배치 규범 4** — 잠긴 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더
   * 사용자가 사유에 닿을 수 없다. `aria-describedby`로 이어야 읽힌다.
   */
  it('사유가 버튼에 이어져 있다', () => {
    render(<HistoryPane />);

    const describedBy = historyButton().getAttribute('aria-describedby');

    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      t.actionReasons.historyPending,
    );
  });

  /*
   * **비활성 표현에 `Chip`을 쓰지 않는다**(계획 §5.2 — 디자인 시스템 갭).
   * 설치본의 `StatusChipProps`에 `disabled`가 없어(실측) 비활성이 표현되지 않는다 —
   * 걸릴 자리를 만들지 않는 것으로 피한다. 낼 수 있는 것은 `Button`의 `disabled`와 사유뿐이다.
   */
  it('구획에 두는 컨트롤이 비활성 버튼 하나뿐이다', () => {
    render(<HistoryPane />);

    expect(within(historyRegion()).getAllByRole('button')).toHaveLength(1);
    expect(within(historyRegion()).queryAllByRole('link')).toHaveLength(0);
    expect(within(historyRegion()).queryAllByRole('combobox')).toHaveLength(0);
  });
});
