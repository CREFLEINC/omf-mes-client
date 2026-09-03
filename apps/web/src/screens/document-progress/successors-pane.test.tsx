import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { documentSuccessor, documentSuccessorFixtures } from './fixtures';
import { SCREEN_ROUTES, type ScreenRouteTable } from './screen-routes';
import {
  buildSuccessorColumns,
  SuccessorsPane,
  SUCCESSORS_TABLE_MIN_WIDTH_PX,
} from './successors-pane';

const t = messages.documentProgress;

const filledRoutes: ScreenRouteTable = { 'SYN-SCREEN-02': '/logistics/synthetic-successor' };

/** 부품은 주소를 모른다 — 어디로 갈지는 화면이 정한다(전례 `approval-inbox/target-pane`). */
const noop = (): void => undefined;

describe('buildSuccessorColumns — 열 구성과 폭', () => {
  const columns = buildSuccessorColumns(SCREEN_ROUTES, noop);

  it('네 열이다 — 유형 · 문서번호 · 수량 · 열기', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'successorTypeCode',
      'successorNo',
      'qty',
      'open',
    ]);
  });

  it('모든 열이 폭을 지정하고 합이 표 하한 이상이다', () => {
    expect(columns.filter((column) => column.width === undefined)).toHaveLength(0);

    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(fixed).toBe(928);
    expect(fixed).toBeGreaterThanOrEqual(SUCCESSORS_TABLE_MIN_WIDTH_PX);
  });

  /**
   * ⭐ **이 표에서 화면이 소유한 문면은 「열기」 버튼 하나다** — 나머지 칸은 전부 서버가 정하는
   * 문자열·숫자라 i18n으로 하한을 세울 수 없다. 그 하나만은 우리가 소유하므로 **문면에서
   * 계산해** 견준다: 문면이 길어지거나 열이 좁아지면 이 자리가 깨진다.
   */
  it('열기 열이 자기 손잡이 문면을 담는다', () => {
    const CHAR_WIDTH_PX = 7.5;
    const CELL_PADDING_PX = 32;
    /* `sm` 버튼의 좌우 안쪽 여백. 글자만으로는 버튼이 담기지 않는다. */
    const BUTTON_PADDING_PX = 24;
    const openColumn = columns.find((column) => column.key === 'open');

    expect(Number.parseInt(openColumn?.width ?? '0px', 10)).toBeGreaterThanOrEqual(
      t.successors.open.length * CHAR_WIDTH_PX + BUTTON_PADDING_PX + CELL_PADDING_PX,
    );
  });

  /* 수량은 오른쪽으로 정렬돼야 자릿수가 맞아 눈으로 견줄 수 있다. */
  it('수량이 우측 정렬이다', () => {
    expect(columns.filter((column) => column.align === 'end').map((column) => column.key)).toEqual([
      'qty',
    ]);
  });

  it('선언한 폭이 렌더 산출물의 열 폭과 같다', () => {
    const { container } = render(
      <SuccessorsPane
        successors={documentSuccessorFixtures}
        routes={SCREEN_ROUTES}
        onOpen={noop}
      />,
    );
    const rendered = [...container.querySelectorAll('col')].map((col) => col.style.width);

    expect(rendered).toEqual(columns.map((column) => column.width ?? ''));
  });
});

describe('SuccessorsPane', () => {
  it('유형·번호·수량이 보인다', () => {
    render(
      <SuccessorsPane
        successors={documentSuccessorFixtures}
        routes={SCREEN_ROUTES}
        onOpen={noop}
      />,
    );

    expect(screen.getByText('SYN-GI-2026-0101')).toBeInTheDocument();
    expect(screen.getAllByText('GOODS_RECEIPT')).toHaveLength(2);
    expect(screen.getByText('400')).toBeInTheDocument();
  });

  /* 내부 번호는 화면에 나오지 않는다(omf-mes#44) — 행 열쇠로만 쓰인다. */
  it('후속의 내부 번호가 화면에 나오지 않는다', () => {
    render(
      <SuccessorsPane
        successors={documentSuccessorFixtures}
        routes={SCREEN_ROUTES}
        onOpen={noop}
      />,
    );

    expect(screen.queryByText('9101')).not.toBeInTheDocument();
    expect(screen.queryByText('SYN-SCREEN-02')).not.toBeInTheDocument();
  });

  /**
   * ⭐ **0건은 정상이고 좋은 소식이다** — 후속이 없어야 이 문서를 취소할 수 있다.
   * 그래서 경고 톤을 쓰지 않는다: 배너도, 경고 변형도 두지 않는다.
   */
  it('0건은 경고 톤이 아닌 문면으로 말한다', () => {
    render(<SuccessorsPane successors={[]} routes={SCREEN_ROUTES} onOpen={noop} />);

    expect(screen.getByText(t.successors.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(t.successors.emptyDescription)).toBeInTheDocument();
    /*
     * ⛔ 경고 배너가 아니다. 디자인 시스템 `AlertBanner`는 `error`·`warning`에서 `role="alert"`로
     * 렌더되므로(설치본 실측), 0건을 경고로 바꾸는 순간 이 단언이 문다.
     */
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /**
   * ⭐ **화면 ID 표가 비어 있는 동안 열기 손잡이가 서지 않는다.**
   * 그럴듯한 주소를 지어 넣으면 사용자가 「열었더니 그 문서가 아닌」 자리에 도착한다.
   */
  it('표가 비어 있으면 열기 손잡이가 서지 않고 사유가 보인다', () => {
    render(
      <SuccessorsPane
        successors={documentSuccessorFixtures}
        routes={SCREEN_ROUTES}
        onOpen={noop}
      />,
    );

    /* ⛔ 잠긴 버튼도 두지 않는다 — 「손잡이가 서지 않는다」는 **아예 없다**는 뜻이다. */
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    /*
     * ⭐ **두 갈래가 한 표 안에 섞여 오는 것이 실제 형태다** — 첫 후속은 화면 ID가 왔는데 표에
     * 없고(`unmapped`), 둘째는 화면 ID 자체가 오지 않았다(`noScreenId`). 갈래마다 한 줄씩 선다.
     */
    expect(screen.getByText(t.successors.openBlocked.unmapped)).toBeInTheDocument();
    expect(screen.getByText(t.successors.openBlocked.noScreenId)).toBeInTheDocument();
  });

  /**
   * 줄의 **차례가 정해져 있다.** 갈래 표(`BLOCK_KIND_ORDER`)가 차례를 값으로 정하므로, 표의 키
   * 순서가 바뀌거나 갈래가 늘어도 화면의 차례는 그 값이 정한 대로다 — 차례를 재는 자리가 없으면
   * 그 값이 아무 일도 하지 않는 상수가 된다.
   *
   * 앞이 「화면 ID가 오지 않았다」인 이유: 그쪽이 **서버가 값을 채워야 풀리는** 갈래라 사용자가
   * 먼저 알아야 할 사정이다.
   */
  it('두 갈래가 섞여 오면 줄의 차례가 정해져 있다', () => {
    render(
      <SuccessorsPane
        successors={documentSuccessorFixtures}
        routes={SCREEN_ROUTES}
        onOpen={noop}
      />,
    );

    const notes = screen
      .getAllByText(
        (_, element) =>
          element?.textContent === t.successors.openBlocked.noScreenId ||
          element?.textContent === t.successors.openBlocked.unmapped,
      )
      .filter((element) => element.tagName === 'P')
      .map((element) => element.textContent);

    expect(notes).toEqual([t.successors.openBlocked.noScreenId, t.successors.openBlocked.unmapped]);
  });

  /* ⭐ 표에 줄이 생기면 **그것만으로** 열기가 살아난다 — 다른 자리는 바뀌지 않는다. */
  it('표를 채우면 그 후속만 열기가 선다', () => {
    render(
      <SuccessorsPane successors={documentSuccessorFixtures} routes={filledRoutes} onOpen={noop} />,
    );

    expect(
      screen.getByRole('button', { name: t.actions.openSuccessor('SYN-GI-2026-0101') }),
    ).toBeInTheDocument();
    /* 화면 ID가 오지 않은 둘째 후속은 그대로 잠긴다 — 표를 채운다고 없는 값이 생기지 않는다. */
    expect(
      screen.queryByRole('button', { name: t.actions.openSuccessor('SYN-GI-2026-0102') }),
    ).not.toBeInTheDocument();
    /* 남은 잠금은 **화면 ID가 오지 않은 쪽 하나뿐**이다 — 표를 채워 풀린 갈래는 사라진다. */
    expect(screen.getByText(t.successors.openBlocked.noScreenId)).toBeInTheDocument();
    expect(screen.queryByText(t.successors.openBlocked.unmapped)).not.toBeInTheDocument();
  });

  /** 부품은 주소를 모른다 — **표가 정한 주소**를 그대로 화면에 넘긴다. */
  it('열기를 누르면 표가 정한 주소를 화면에 넘긴다', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <SuccessorsPane
        successors={documentSuccessorFixtures}
        routes={filledRoutes}
        onOpen={onOpen}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: t.actions.openSuccessor('SYN-GI-2026-0101') }),
    );

    expect(onOpen).toHaveBeenCalledWith('/logistics/synthetic-successor');
  });

  /* 전건이 열리면 잠긴 사유를 낼 것이 없다 — 늘 떠 있는 안내는 읽히지 않는다. */
  it('전건이 열리면 잠김 사유를 내지 않는다', () => {
    render(
      <SuccessorsPane successors={[documentSuccessor()]} routes={filledRoutes} onOpen={noop} />,
    );

    expect(screen.queryByText(t.successors.openBlocked.noScreenId)).not.toBeInTheDocument();
    expect(screen.queryByText(t.successors.openBlocked.unmapped)).not.toBeInTheDocument();
  });

  /**
   * 행 열쇠 — **번호만으로는 가릴 수 없다.** 유형이 다르면 같은 번호가 다른 문서다.
   * 미지정이면 인덱스가 React key가 되어 앞 줄이 사라질 때 뒷줄의 DOM 노드가 대신 지워진다.
   */
  it('앞 줄이 사라져도 뒷줄의 DOM 노드가 그대로 남는다', () => {
    const { rerender } = render(
      <SuccessorsPane
        successors={documentSuccessorFixtures}
        routes={SCREEN_ROUTES}
        onOpen={noop}
      />,
    );
    const kept = screen.getByRole('row', { name: /SYN-GI-2026-0102/ });

    rerender(
      <SuccessorsPane
        successors={documentSuccessorFixtures.slice(1)}
        routes={SCREEN_ROUTES}
        onOpen={noop}
      />,
    );

    expect(screen.getByRole('row', { name: /SYN-GI-2026-0102/ })).toBe(kept);
  });

  /* 유형이 다르고 번호가 같은 두 후속은 서로 다른 행이다. */
  it('번호가 같아도 유형이 다르면 다른 행이다', () => {
    const { rerender } = render(
      <SuccessorsPane
        successors={[
          documentSuccessor({ successorTypeCode: 'GOODS_RECEIPT', successorId: 9101 }),
          documentSuccessor({ successorTypeCode: 'SYN_DOC_TYPE_D', successorId: 9101 }),
        ]}
        routes={SCREEN_ROUTES}
        onOpen={noop}
      />,
    );
    const kept = screen.getByRole('row', { name: /SYN_DOC_TYPE_D/ });

    rerender(
      <SuccessorsPane
        successors={[documentSuccessor({ successorTypeCode: 'SYN_DOC_TYPE_D', successorId: 9101 })]}
        routes={SCREEN_ROUTES}
        onOpen={noop}
      />,
    );

    expect(screen.getByRole('row', { name: /SYN_DOC_TYPE_D/ })).toBe(kept);
  });
});
