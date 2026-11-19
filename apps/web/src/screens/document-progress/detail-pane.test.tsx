import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DetailPane } from './detail-pane';
import { documentProgress, documentProgressDetail } from './fixtures';
import { SCREEN_ROUTES, type ScreenRouteTable } from './screen-routes';

const t = messages.documentProgress;

const filledRoutes: ScreenRouteTable = { 'SYN-SCREEN-01': '/logistics/synthetic-document' };

const noop = (): void => undefined;

const summaryOf = (): HTMLElement =>
  screen.getByRole('group', { name: t.detail.summary('SYN-GR-2026-0001') });

const NAMES = { statusName: (code: string) => code, subTypeName: (code: string) => code };

describe('DetailPane — 요약', () => {
  /**
   * ⭐ **요약의 근거는 상세 응답의 `progress`다**(C2-4). 목록 행을 그대로 다시 그리면 두 조회의
   * 시점이 갈려 같은 화면의 위아래가 서로 다른 값을 말한다. 픽스처의 상태 코드가 목록과 다른
   * 값(`SYN_STATUS_DETAIL`)인 것이 그 축을 잰다.
   */
  it('상세 응답의 값을 그린다', () => {
    render(
      <DetailPane
        detail={documentProgressDetail()}
        routes={SCREEN_ROUTES}
        onOpen={noop}
        {...NAMES}
      />,
    );

    const summary = summaryOf();

    expect(within(summary).getByText('SYN_STATUS_DETAIL')).toBeInTheDocument();
    expect(within(summary).getByText('SYN-GR-2026-0001')).toBeInTheDocument();
    expect(within(summary).getByText('입고')).toBeInTheDocument();
    expect(within(summary).getByText('2026-08-06')).toBeInTheDocument();
  });

  it('수량 셋이 함께 보인다', () => {
    render(
      <DetailPane
        detail={documentProgressDetail({
          progress: documentProgress({ plannedQty: 1200, processedQty: 800, remainingQty: 400 }),
        })}
        routes={SCREEN_ROUTES}
        onOpen={noop}
        {...NAMES}
      />,
    );

    const summary = summaryOf();

    expect(within(summary).getByText(t.detail.plannedQty)).toBeInTheDocument();
    expect(within(summary).getByText('1200')).toBeInTheDocument();
    expect(within(summary).getByText('800')).toBeInTheDocument();
    expect(within(summary).getByText('400')).toBeInTheDocument();
  });

  /* 세부구분이 없이 오는 문서가 실재한다 — 빈 칸으로 두면 화면이 빠뜨린 것과 구분되지 않는다. */
  it('세부구분이 없으면 값 없음 표식을 낸다', () => {
    render(
      <DetailPane
        detail={documentProgressDetail({
          progress: documentProgress({ documentSubTypeCode: null }),
        })}
        routes={SCREEN_ROUTES}
        onOpen={noop}
        {...NAMES}
      />,
    );

    expect(within(summaryOf()).getAllByText(t.values.empty).length).toBeGreaterThan(0);
  });

  /* 내부 번호는 화면에 나오지 않는다(omf-mes#44). */
  it('내부 번호가 화면에 나오지 않는다', () => {
    render(
      <DetailPane
        detail={documentProgressDetail()}
        routes={SCREEN_ROUTES}
        onOpen={noop}
        {...NAMES}
      />,
    );

    expect(screen.queryByText('9001')).not.toBeInTheDocument();
    expect(screen.queryByText('SYN-SCREEN-01')).not.toBeInTheDocument();
  });
});

describe('DetailPane — 문서 열기', () => {
  /**
   * ⭐ **화면 ID 표가 비어 있는 동안 열기 단추가 없다**(C-4 · 사용자 지시 2026-11-19 — 구현되지 않은 기능은
   * 걷는다). 잠긴 단추도, 열 수 없는 사유를 적던 안내 줄도 두지 않는다.
   */
  it('표가 비어 있으면 열기 단추도 안내 줄도 없다', () => {
    const { container } = render(
      <DetailPane
        detail={documentProgressDetail()}
        routes={SCREEN_ROUTES}
        onOpen={noop}
        {...NAMES}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('p.field-note')).toBeNull();
  });

  /* ⭐ 표에 줄이 생기면 그것만으로 열기가 살아난다. */
  it('표를 채우면 열기가 서고 주소를 화면에 넘긴다', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <DetailPane
        detail={documentProgressDetail()}
        routes={filledRoutes}
        onOpen={onOpen}
        {...NAMES}
      />,
    );

    await user.click(screen.getByRole('button', { name: t.actions.openDocument }));

    expect(onOpen).toHaveBeenCalledWith('/logistics/synthetic-document');
  });

  /* 화면 ID가 오지 않은 문서도 실재한다 — 표를 채워도 열 수 없다. */
  it('화면 ID가 오지 않으면 표를 채워도 열기 단추가 없다', () => {
    render(
      <DetailPane
        detail={documentProgressDetail({ screenId: null })}
        routes={filledRoutes}
        onOpen={noop}
        {...NAMES}
      />,
    );

    expect(screen.queryByRole('button', { name: t.actions.openDocument })).not.toBeInTheDocument();
  });
});

describe('DetailPane — 아래 두 구획', () => {
  /* 처리 경과와 후속이 **한 구획에 함께** 선다 — 「어디까지 갔는가」와 「무엇이 걸려 있는가」다. */
  it('처리 경과와 후속 목록을 함께 낸다', () => {
    render(
      <DetailPane
        detail={documentProgressDetail()}
        routes={SCREEN_ROUTES}
        onOpen={noop}
        {...NAMES}
      />,
    );

    expect(screen.getByRole('table', { name: t.steps.caption })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: t.successors.caption })).toBeInTheDocument();
  });

  it('후속이 0건이어도 두 구획이 모두 선다', () => {
    render(
      <DetailPane
        detail={documentProgressDetail({ successors: [] })}
        routes={SCREEN_ROUTES}
        onOpen={noop}
        {...NAMES}
      />,
    );

    expect(screen.getByRole('table', { name: t.steps.caption })).toBeInTheDocument();
    expect(screen.getByText(t.successors.emptyTitle)).toBeInTheDocument();
  });
});
