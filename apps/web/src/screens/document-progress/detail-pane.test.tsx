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

describe('DetailPane — 요약', () => {
  /**
   * ⭐ **요약의 근거는 상세 응답의 `progress`다**(C2-4). 목록 행을 그대로 다시 그리면 두 조회의
   * 시점이 갈려 같은 화면의 위아래가 서로 다른 값을 말한다. 픽스처의 상태 코드가 목록과 다른
   * 값(`SYN_STATUS_DETAIL`)인 것이 그 축을 잰다.
   */
  it('상세 응답의 값을 그린다', () => {
    render(<DetailPane detail={documentProgressDetail()} routes={SCREEN_ROUTES} onOpen={noop} />);

    const summary = summaryOf();

    expect(within(summary).getByText('SYN_STATUS_DETAIL')).toBeInTheDocument();
    expect(within(summary).getByText('SYN-GR-2026-0001')).toBeInTheDocument();
    expect(within(summary).getByText('GOODS_RECEIPT')).toBeInTheDocument();
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
      />,
    );

    expect(within(summaryOf()).getAllByText(t.values.empty).length).toBeGreaterThan(0);
  });

  /* 위아래가 다른 값을 말할 수 있다는 사실을 감추지 않는다. */
  it('요약이 상세 조회 결과임을 밝힌다', () => {
    render(<DetailPane detail={documentProgressDetail()} routes={SCREEN_ROUTES} onOpen={noop} />);

    expect(screen.getByText(t.detail.summaryNote)).toBeInTheDocument();
  });

  /* 내부 번호는 화면에 나오지 않는다(omf-mes#44). */
  it('내부 번호가 화면에 나오지 않는다', () => {
    render(<DetailPane detail={documentProgressDetail()} routes={SCREEN_ROUTES} onOpen={noop} />);

    expect(screen.queryByText('9001')).not.toBeInTheDocument();
    expect(screen.queryByText('SYN-SCREEN-01')).not.toBeInTheDocument();
  });
});

describe('DetailPane — 문서 열기', () => {
  /**
   * ⭐ **화면 ID 표가 비어 있는 동안 열기 손잡이가 서지 않는다**(C2-8).
   * ⛔ 잠긴 버튼도 두지 않는다 — 사유만 글자로 밝힌다.
   */
  it('표가 비어 있으면 열기 손잡이가 서지 않고 사유가 보인다', () => {
    render(<DetailPane detail={documentProgressDetail()} routes={SCREEN_ROUTES} onOpen={noop} />);

    expect(screen.queryByRole('button', { name: t.actions.openDocument })).not.toBeInTheDocument();
    /* ⭐ **화면은 아는데 이 프로그램에 그 화면이 없다** — 이 저장소가 풀 수 있는 쪽이다. */
    expect(screen.getByText(t.detail.openBlocked.unmapped)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.openBlocked.noScreenId)).not.toBeInTheDocument();
  });

  /* ⭐ 표에 줄이 생기면 그것만으로 열기가 살아난다. */
  it('표를 채우면 열기가 서고 주소를 화면에 넘긴다', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(<DetailPane detail={documentProgressDetail()} routes={filledRoutes} onOpen={onOpen} />);

    await user.click(screen.getByRole('button', { name: t.actions.openDocument }));

    expect(onOpen).toHaveBeenCalledWith('/logistics/synthetic-document');
    expect(screen.queryByText(t.detail.openBlocked.unmapped)).not.toBeInTheDocument();
    expect(screen.queryByText(t.detail.openBlocked.noScreenId)).not.toBeInTheDocument();
  });

  /**
   * 화면 ID가 오지 않은 문서도 실재한다 — 표를 채워도 열 수 없다.
   *
   * ⭐ **사유가 앞 갈래와 다른 글자다.** 풀 수 있는 사람이 다르기 때문이다 — 이쪽은 서버가
   * 값을 채워야 하고, 앞쪽은 이 프로그램에 화면이 생기면 풀린다. 한 문면으로 뭉개면 사용자가
   * 담당자에게 물어야 할지 기다려야 할지 가릴 수 없다.
   */
  it('화면 ID가 오지 않으면 표를 채워도 열리지 않는다', () => {
    render(
      <DetailPane
        detail={documentProgressDetail({ screenId: null })}
        routes={filledRoutes}
        onOpen={noop}
      />,
    );

    expect(screen.queryByRole('button', { name: t.actions.openDocument })).not.toBeInTheDocument();
    expect(screen.getByText(t.detail.openBlocked.noScreenId)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.openBlocked.unmapped)).not.toBeInTheDocument();
  });
});

describe('DetailPane — 아래 두 구획', () => {
  /* 처리 경과와 후속이 **한 구획에 함께** 선다 — 「어디까지 갔는가」와 「무엇이 걸려 있는가」다. */
  it('처리 경과와 후속 목록을 함께 낸다', () => {
    render(<DetailPane detail={documentProgressDetail()} routes={SCREEN_ROUTES} onOpen={noop} />);

    expect(screen.getByRole('table', { name: t.steps.caption })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: t.successors.caption })).toBeInTheDocument();
  });

  it('후속이 0건이어도 두 구획이 모두 선다', () => {
    render(
      <DetailPane
        detail={documentProgressDetail({ successors: [] })}
        routes={SCREEN_ROUTES}
        onOpen={noop}
      />,
    );

    expect(screen.getByRole('table', { name: t.steps.caption })).toBeInTheDocument();
    expect(screen.getByText(t.successors.emptyTitle)).toBeInTheDocument();
  });
});
