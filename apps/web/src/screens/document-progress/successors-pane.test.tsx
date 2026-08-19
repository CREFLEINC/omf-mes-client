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
    expect(screen.getAllByText('SYN_DOC_TYPE_B')).toHaveLength(2);
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
    expect(screen.getByText(t.successors.openBlocked)).toBeInTheDocument();
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
    expect(screen.getByText(t.successors.openBlocked)).toBeInTheDocument();
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

    expect(screen.queryByText(t.successors.openBlocked)).not.toBeInTheDocument();
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
          documentSuccessor({ successorTypeCode: 'SYN_DOC_TYPE_B', successorId: 9101 }),
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
