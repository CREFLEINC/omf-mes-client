import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { listUrl, renderScreen, WORK_ORDER } from './screen-harness';

const t = messages.workOrderProgress;

describe('WorkOrderProgressScreen', () => {
  /* 화면 제목 줄(경로 · 큰 제목)과 「조회 조건」 구획 제목은 두지 않는다(#360). 구획은 이름으로 읽힌다. */
  it('화면 제목과 조회 조건 구획 제목을 세우지 않는다', () => {
    renderScreen();

    expect(screen.queryByRole('heading', { name: t.title })).not.toBeInTheDocument();
    const region = screen.getByRole('region', { name: t.filters.legend });
    expect(within(region).queryByRole('heading')).not.toBeInTheDocument();
  });

  /*
   * L-3 — 기간을 비운 채로 들어와도 조건 없는 조회를 만들지 않는다. 기본값은 최근 한 달이고,
   * 그 값을 주소에도 적어야 지금 보고 있는 화면을 그대로 공유할 수 있다.
   */
  it('⛔ 기간 없이 들어와도 조건 없는 조회를 내지 않는다', async () => {
    const { urls } = renderScreen();

    expect(await listUrl(urls)).toContain('plannedStartFrom=2026-06-16');
  });

  it('⛔ 실적 누계를 함께 받는다 — 양품·달성률이 거기서 온다', async () => {
    const { urls } = renderScreen();

    expect(await listUrl(urls)).toContain('withProgress=true');
  });

  describe('전체 건수', () => {
    /* L-1 — 서버가 센 「전체」다. 요약 상자 대신 쪽 이동이 「128건 중 …」으로 보인다(관리웹 정리 시안 A). */
    it('필터 전체 건수를 서버가 준 값으로 보인다', async () => {
      renderScreen({ total: 128 });

      expect(
        await screen.findByText(messages.screenPatterns.pageNav.total(128)),
      ).toBeInTheDocument();
    });
  });

  describe('목록', () => {
    it('받은 W/O 를 보인다', async () => {
      renderScreen();

      expect(await screen.findByText(/SYN-WO-0007/)).toBeInTheDocument();
    });

    it('⛔ 품목 식별자 대신 이름을 보인다', async () => {
      renderScreen();

      expect(await screen.findByRole('cell', { name: /합성 품목/ })).toBeInTheDocument();
    });

    it('상태를 마스터의 표시명으로 보인다', async () => {
      renderScreen();

      expect(await screen.findByRole('cell', { name: '진행중' })).toBeInTheDocument();
    });

    /*
     * ⛔ 기준 시각이 흐르지 않으면 지연 판정이 통째로 틀린다. 계획 종료가 지난 W/O 가
     * 「지연」으로 서는지로 그것을 본다.
     */
    it('⛔ 계획 종료가 지난 W/O 를 지연으로 판정한다', async () => {
      renderScreen();

      expect(await screen.findByRole('cell', { name: t.list.delayed })).toBeInTheDocument();
    });

    it('아직 계획 종료가 오지 않았으면 지연이 아니다', async () => {
      renderScreen({
        workOrders: [{ ...WORK_ORDER, plannedEndAt: '2026-12-31T18:00:00+09:00' }],
      });

      await screen.findByText(/SYN-WO-0007/);
      expect(screen.queryByRole('cell', { name: t.list.delayed })).not.toBeInTheDocument();
    });

    it('목록을 받지 못하면 그 사실을 알린다', async () => {
      renderScreen({ listStatus: 500 });

      expect(await screen.findByText(t.list.loadError)).toBeInTheDocument();
    });

    /*
     * ⛔ 「0건」이라고 **단언하게 된다** — 실제로는 몇 건인지 모른다. 실패를 「결과 없음」으로
     * 바꿔 읽게 만드는 자리다.
     */
    it('⛔ 목록을 받지 못했으면 쪽 이동을 세우지 않는다', async () => {
      renderScreen({ listStatus: 500 });

      await screen.findByText(t.list.loadError);
      expect(screen.queryByRole('navigation', { name: t.page.label })).not.toBeInTheDocument();
    });

    it('받았으면 쪽 이동을 세운다', async () => {
      renderScreen();

      expect(await screen.findByRole('navigation', { name: t.page.label })).toBeInTheDocument();
    });
  });

  describe('요약과 상태 칩', () => {
    const SUMMARY = {
      totalCount: 128,
      statusCounts: { SYN_RUN: 100, SYN_DONE: 28 },
      goodQty: 8050,
      defectQty: 92,
      achievementRate: 0.614,
      delayedCount: 4,
    };

    /* 요약은 조건 전체 기준이고 목록과 같은 트랜잭션에서 온다 — 따로 묻지 않는다. */
    it('요약 집계를 목록과 함께 받아 표 위에 보인다', async () => {
      const { urls } = renderScreen({ summary: SUMMARY });

      const region = await screen.findByRole('region', { name: t.summary.label });
      expect(within(region).getByText('8,050')).toBeInTheDocument();
      expect(within(region).getByText('61.4%')).toBeInTheDocument();
      expect(await listUrl(urls)).toContain('withSummary=true');
    });

    it('요약의 상태별 건수로 칩을 놓는다 — 이름은 마스터의 표시명이다', async () => {
      renderScreen({ summary: SUMMARY });

      const group = screen.getByRole('group', { name: t.summary.statusLabel });
      expect(
        await within(group).findByRole('button', { name: t.summary.statusChip('진행중', 100) }),
      ).toBeInTheDocument();
      expect(
        within(group).getByRole('button', { name: t.summary.statusChip(t.summary.statusAll, 128) }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    /* 상태 칩은 조회 조건이다 — 누르면 [조회]와 같은 길로 걸린다(주소 · 첫 쪽 · 고른 W/O 놓기). */
    it('상태 칩을 누르면 그 상태로 다시 조회한다', async () => {
      const { urls, user } = renderScreen({ summary: SUMMARY });

      await user.click(
        await screen.findByRole('button', { name: t.summary.statusChip('진행중', 100) }),
      );

      await waitFor(() => {
        expect(screen.getByTestId('location')).toHaveTextContent('st=SYN_RUN');
      });
      await waitFor(() => {
        expect(urls.some((url) => url.includes('statusCode=SYN_RUN'))).toBe(true);
      });
    });

    /* 상태를 고른 채로 받은 요약은 그 상태만 센다 — 다른 칩의 건수는 상태를 뺀 요약에서 받는다. */
    it('⛔ 상태를 골라도 다른 상태 칩이 사라지지 않는다 — 상태를 뺀 건수를 따로 받는다', async () => {
      const { urls } = renderScreen({
        route: '/production/work-order-progress?from=2026-07-01&to=2026-07-31&st=SYN_RUN',
        summary: SUMMARY,
      });

      await waitFor(() => {
        expect(
          urls.some(
            (url) =>
              url.startsWith('/production/work-orders?') &&
              url.includes('size=1') &&
              !url.includes('statusCode='),
          ),
        ).toBe(true);
      });
      expect(
        await screen.findByRole('button', { name: t.summary.statusChip('SYN_DONE', 28) }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: t.summary.statusChip('진행중', 100) }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    it('⛔ 상태를 고르지 않았으면 건수를 따로 묻지 않는다', async () => {
      const { urls } = renderScreen({ summary: SUMMARY });

      await screen.findByRole('button', { name: t.summary.statusChip('진행중', 100) });
      expect(urls.filter((url) => url.startsWith('/production/work-orders?'))).toHaveLength(1);
    });

    /* ⛔ 요약을 못 받았으면 빈 요약 줄을 세우지 않는다 — 빈 칸은 0 으로 읽힌다. */
    it('⛔ 요약이 오지 않으면 요약 줄을 그리지 않는다', async () => {
      renderScreen();

      await screen.findByText(/SYN-WO-0007/);
      expect(screen.queryByRole('region', { name: t.summary.label })).not.toBeInTheDocument();
    });
  });

  describe('보기 전환', () => {
    const view = () => screen.getByRole('group', { name: t.view.label });

    it('처음에는 표다', async () => {
      renderScreen();

      expect(await screen.findByRole('region', { name: t.list.title })).toBeInTheDocument();
      expect(within(view()).getByRole('button', { name: t.view.table })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('「일정」을 누르면 같은 결과를 날짜 축으로 보이고 주소에 적는다', async () => {
      const { user } = renderScreen();

      await user.click(within(view()).getByRole('button', { name: t.view.timeline }));

      expect(await screen.findByRole('region', { name: t.timeline.title })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: t.list.title })).not.toBeInTheDocument();
      expect(screen.getByTestId('location')).toHaveTextContent('view=timeline');
    });

    /* 날짜 축은 왼쪽에서 오른쪽으로 읽는다 — 줄도 계획 시작이 이른 것부터다. */
    it('일정 보기는 계획 시작 순으로 받는다 — 표에서 고른 정렬은 주소에 남는다', async () => {
      const { urls } = renderScreen({
        route:
          '/production/work-order-progress?from=2026-07-01&to=2026-07-31&view=timeline&sort=workOrderNo,desc',
      });

      expect(decodeURIComponent(await listUrl(urls))).toContain('sort=plannedStartAt,asc');
      expect(screen.getByTestId('location')).toHaveTextContent('sort=workOrderNo,desc');
    });

    it('일정 보기에서도 줄을 눌러 같은 상세 창을 연다', async () => {
      const { user } = renderScreen({
        route: '/production/work-order-progress?from=2026-07-01&to=2026-07-31&view=timeline',
      });

      await user.click(
        await screen.findByRole('button', { name: t.list.select(WORK_ORDER.workOrderNo) }),
      );

      await waitFor(() => {
        expect(screen.getByTestId('location')).toHaveTextContent('workOrderId=7001');
      });
    });
  });
});
