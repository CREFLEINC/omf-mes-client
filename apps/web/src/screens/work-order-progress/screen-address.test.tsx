import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WORK_ORDER_PROGRESS_PATH } from './filters';
import { renderScreen } from './screen-harness';

const t = messages.workOrderProgress;

/** 주소에 무엇이 적혔는가 — 화면의 상태가 거기 있으므로 감지기가 볼 수 있어야 한다. */
const address = (): HTMLElement => screen.getByTestId('location');

/** 주소가 화면의 상태다 — 무엇이 바뀔 때 무엇을 비우는지를 여기서 묶는다. */
describe('WorkOrderProgressScreen — 주소 수명', () => {
  it('기본 기간을 주소에도 적는다 — 지금 화면을 그대로 공유할 수 있게', async () => {
    renderScreen();

    await waitFor(() => {
      expect(address()).toHaveTextContent('from=2026-06-16');
    });
  });

  /*
   * ⛔ 「주소에 값이 있는가」로 묻지 않는다. 비었거나 달력에 없는 값이 들어 있으면 화면은
   * 기본 기간으로 되돌리는데(L-3), 주소는 그 사실을 모른 채 남는다 — 그 링크를 받은 사람은
   * **주소와 다른 화면**을 보게 된다.
   */
  it.each([
    ['비어 있으면', '?from=&to='],
    ['달력에 없는 날이면', '?from=2026-13-45&to=2026-13-46'],
  ])('⛔ 주소의 기간이 %s 화면이 거는 기간으로 고쳐 적는다', async (_name, search) => {
    renderScreen({ route: `${WORK_ORDER_PROGRESS_PATH}${search}` });

    await waitFor(() => {
      expect(address()).toHaveTextContent('from=2026-06-16');
    });
    expect(address()).toHaveTextContent('to=2026-07-15');
  });

  /*
   * ⛔ 주소로 고른 W/O 를 받아 들어온 사용자에게서 선택을 빼앗지 않는다 — 기간을 채워 넣는
   * 일은 「조회를 다시 거는 것」이 아니다.
   */
  it('⛔ 기간을 채워 넣으면서 고른 W/O 를 지우지 않는다', async () => {
    renderScreen({ route: `${WORK_ORDER_PROGRESS_PATH}?workOrderId=7001` });

    await waitFor(() => {
      expect(address()).toHaveTextContent('from=');
    });
    expect(address()).toHaveTextContent('workOrderId=7001');
  });

  describe('조건과 쪽', () => {
    it('조회를 누르면 고친 조건이 주소에 걸린다', async () => {
      const { user } = renderScreen();

      await user.type(screen.getByLabelText(t.filters.keyword), 'SYN-WO');
      await user.click(screen.getByRole('button', { name: t.filters.search }));

      await waitFor(() => {
        expect(address()).toHaveTextContent('q=SYN-WO');
      });
    });

    /* ⛔ 조건이 바뀌면 그 W/O 는 결과에 없을 수 있다 — 목록에 없는 상세가 열린 채로 뜬다. */
    it('⛔ 조건이 바뀌면 고른 W/O 를 놓는다', async () => {
      const { user } = renderScreen({
        route: `${WORK_ORDER_PROGRESS_PATH}?from=2026-07-01&to=2026-07-31&workOrderId=7001`,
      });

      await user.click(screen.getByRole('button', { name: t.filters.search }));

      await waitFor(() => {
        expect(address()).not.toHaveTextContent('workOrderId');
      });
    });

    /* 상세를 여는 것은 보이는 줄을 바꾸지 않는다 — 쪽을 건드리지 않는다. */
    it('줄을 누르면 상세가 열리고 쪽은 그대로다', async () => {
      const { user } = renderScreen({
        route: `${WORK_ORDER_PROGRESS_PATH}?from=2026-07-01&to=2026-07-31&page=2`,
      });

      await user.click(await screen.findByRole('button', { name: t.list.select('SYN-WO-0007') }));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(address()).toHaveTextContent('page=2');
    });

    it('상세를 닫으면 주소에서도 놓는다', async () => {
      const { user } = renderScreen({
        route: `${WORK_ORDER_PROGRESS_PATH}?from=2026-07-01&to=2026-07-31&workOrderId=7001`,
      });

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: t.detail.close }));

      await waitFor(() => {
        expect(address()).not.toHaveTextContent('workOrderId');
      });
    });

    /*
     * ⛔ 조건이 좁아져 없는 쪽만 남았을 때, 되돌릴 길을 주지 않으면 사용자는 조건이 잘못된
     * 줄 알고 조건을 더 만지게 된다.
     */
    it('⛔ 없는 쪽을 가리키면 첫 쪽으로 되돌릴 길을 준다', async () => {
      const { user } = renderScreen({
        route: `${WORK_ORDER_PROGRESS_PATH}?from=2026-07-01&to=2026-07-31&page=9`,
        workOrders: [],
        total: 12,
      });

      expect(await screen.findByText(t.page.beyondLast)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: t.page.toFirst }));

      await waitFor(() => {
        expect(address()).not.toHaveTextContent('page=9');
      });
    });
  });

  describe('기준 시각과 새로고침', () => {
    /* L-5 — 화면에 보이는 수가 언제 것인지 모르면 그 수로 판단할 수 없다. */
    it('기준 시각을 상시 보인다', async () => {
      renderScreen();

      await screen.findByText(/SYN-WO-0007/);
      expect(screen.getByText(/^기준 /)).toBeInTheDocument();
    });

    /* L-6 — 스스로 새로워지지 않는다는 사실을 적지 않으면 최신인 줄 알고 본다. */
    it('⛔ 자동으로 갱신되지 않는다는 사실을 적는다', () => {
      renderScreen();

      expect(screen.getByText(t.basis.note)).toBeInTheDocument();
    });

    it('새로고침을 누르면 다시 조회한다', async () => {
      const { urls, user } = renderScreen();

      await screen.findByText(/SYN-WO-0007/);
      const before = urls.filter((url) => url.startsWith('/production/work-orders?')).length;
      await user.click(screen.getByRole('button', { name: t.basis.refresh }));

      await waitFor(() => {
        expect(
          urls.filter((url) => url.startsWith('/production/work-orders?')).length,
        ).toBeGreaterThan(before);
      });
    });
  });
});
