import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResultPane } from './result-pane';
import type { ResultView } from './types';

const t = messages.stocktaking;

const OPENED: ResultView = { kind: 'opened', countNo: 'IC-2026-900014' };

const renderPane = (result: ResultView = OPENED) => render(<ResultPane result={result} />);

const resultRegion = (): HTMLElement => screen.getByRole('status', { name: t.result.label });

describe('ResultPane — 개시 갈래', () => {
  /* **C29** — 만들어진 실사의 **업무 번호**를 낸다. 그것이 사용자가 나중에 찾을 때 쓰는 값이다. */
  it('만들어진 실사번호를 낸다', () => {
    renderPane();

    expect(within(resultRegion()).getByText(t.result.openedNo)).toBeInTheDocument();
    expect(within(resultRegion()).getByText('IC-2026-900014')).toBeInTheDocument();
  });

  /*
   * **#44** — 결과 구획 어디에도 내부 번호가 없다. 받는 타입에 자리 자체가 없어 낼 값이 없다 —
   * `inventoryCountNo`는 사용자 대면 업무 번호라 내는 것이 맞고, 그 구분을 여기서 고정한다.
   */
  it('내부 번호를 내지 않는다', () => {
    const { container } = renderPane();

    /* 짝 방향 — 업무 번호는 실제로 보인다(아무것도 안 그려서 통과하는 것이 아니다). */
    expect(within(resultRegion()).getByText('IC-2026-900014')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9001');
    expect(container.textContent ?? '').not.toContain('9101');
  });

  /*
   * **사용자가 부르지 않은 시점에 나타나는 내용**이라 살아 있는 영역으로 알린다.
   * 알리지 않으면 화면을 보지 않는 사용자에게는 아무 일도 일어나지 않은 것이 된다.
   */
  it('살아 있는 영역으로 알린다', () => {
    renderPane();

    expect(resultRegion()).toBeInTheDocument();
  });

  /*
   * **성공을 단정하는 말을 쓰지 않는다.** 화면이 증거를 갖는 것은 응답이 준 실사번호뿐이고,
   * 진행 요약은 아래 구획이 상세 조회로 따로 받는다 — 그 사실을 안내가 밝힌다.
   */
  it('진행 요약을 어디서 보는지 밝힌다', () => {
    renderPane();

    expect(within(resultRegion()).getByText(t.result.openedNote)).toBeInTheDocument();
  });
});
