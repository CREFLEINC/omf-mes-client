import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { listUrl, renderScreen, WORK_ORDER } from './screen-harness';

const t = messages.workOrderProgress;

describe('WorkOrderProgressScreen', () => {
  it('제목과 위치를 보인다', () => {
    renderScreen();

    expect(screen.getByRole('heading', { name: t.title })).toBeInTheDocument();
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

  describe('요약', () => {
    /* L-1 — 서버가 센 「전체」다. 화면이 페이지를 받아 센 수가 아니다. */
    it('필터 전체 건수를 서버가 준 값으로 보인다', async () => {
      renderScreen({ total: 128 });

      await waitFor(() => {
        expect(screen.getByRole('group', { name: t.summary.total })).toHaveTextContent('128');
      });
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
  });
});
