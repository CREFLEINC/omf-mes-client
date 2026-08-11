import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResultPane } from './result-pane';
import type { ResultView } from './types';

const t = messages.stocktaking;

const OPENED: ResultView = { kind: 'opened', countNo: 'IC-2026-900014' };

const SAVED: ResultView = {
  kind: 'saved',
  locationLabel: 'SAMPLE-LOC-01 · 합성 위치 가',
  replacedLineCount: 3,
};

const renderPane = (result: ResultView = OPENED) => render(<ResultPane result={result} />);

const resultRegion = (): HTMLElement => screen.getByRole('status', { name: t.result.label });

const savedRegion = (): HTMLElement => screen.getByRole('status', { name: t.result.savedLabel });

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

  /*
   * **어디로도 이동하지 않는다.** 만들어진 실사는 같은 화면의 아래 구획에서 이어 다루므로
   * 갈 곳이 없다 — 링크나 버튼을 두면 없는 화면으로 가는 경로가 생긴다. PR ④의 「조정 등록」이
   * 같은 규칙을 더 센 형태로 받으므로(이슈 §5 ⚠) 그 잣대를 여기서 미리 세워 둔다.
   */
  it('결과 구획에 이동 수단을 두지 않는다', () => {
    renderPane();

    /* 짝 방향 — 구획은 실제로 그려졌다. */
    expect(within(resultRegion()).getByText('IC-2026-900014')).toBeInTheDocument();
    expect(within(resultRegion()).queryAllByRole('link')).toHaveLength(0);
    expect(within(resultRegion()).queryAllByRole('button')).toHaveLength(0);
  });
});

describe('ResultPane — 저장 갈래', () => {
  /*
   * **계획 결정 14** — 한 자리에 갈래 하나만 보인다. 구획을 갈래마다 두면 「방금 개시했다」와
   * 「방금 저장했다」가 나란히 서서 사용자가 무엇이 지금 일어난 일인지 가릴 수 없다.
   * 라벨까지 갈리는 것이 그 규칙의 실물이다.
   */
  it('저장 갈래에는 개시 갈래가 보이지 않는다', () => {
    renderPane(SAVED);

    expect(savedRegion()).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    expect(screen.queryByText(t.result.openedNote)).not.toBeInTheDocument();
  });

  /** 무엇을 어디에 저장했는지 — **위치는 이름으로 온다**(#44). */
  it('치환한 위치를 이름으로 낸다', () => {
    renderPane(SAVED);

    expect(within(savedRegion()).getByText(t.result.savedLocation)).toBeInTheDocument();
    expect(within(savedRegion()).getByText('SAMPLE-LOC-01 · 합성 위치 가')).toBeInTheDocument();
  });

  /*
   * **서버가 되돌려 준 줄 수를 낸다** — 화면이 센 숫자가 아니다. 둘이 갈리면 그 자리가
   * 「보낸 것과 저장된 것이 다르다」는 사실을 드러낸다.
   */
  it('치환한 줄 수를 낸다', () => {
    renderPane(SAVED);

    expect(within(savedRegion()).getByText(t.result.savedLineCount)).toBeInTheDocument();
    expect(within(savedRegion()).getByText(t.result.savedCount(3))).toBeInTheDocument();
  });

  it('요약이 어디서 갱신됐는지 밝힌다', () => {
    renderPane(SAVED);

    expect(within(savedRegion()).getByText(t.result.savedNote)).toBeInTheDocument();
  });

  /** 저장 갈래에도 내부 번호가 없다 — 위치 번호(9701)가 이름으로 풀려 들어온다. */
  it('내부 번호를 내지 않는다', () => {
    const { container } = renderPane(SAVED);

    expect(within(savedRegion()).getByText('SAMPLE-LOC-01 · 합성 위치 가')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9701');
    expect(container.textContent ?? '').not.toContain('9401');
  });

  it('결과 구획에 이동 수단을 두지 않는다', () => {
    renderPane(SAVED);

    expect(within(savedRegion()).queryAllByRole('link')).toHaveLength(0);
    expect(within(savedRegion()).queryAllByRole('button')).toHaveLength(0);
  });
});
