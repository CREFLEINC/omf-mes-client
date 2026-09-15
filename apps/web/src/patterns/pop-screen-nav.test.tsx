import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';
import { PopScreenNavButton } from './pop-screen-nav';

const SESSION = {
  userId: 1001,
  loginId: 'pop.terminal',
  userName: '조립 1라인 단말',
  scopes: [{ businessUnitId: 1001 }],
};

const stub = (body: unknown, init: ResponseInit = {}) =>
  createStubFetch([
    {
      match: (request: Request) => request.url.endsWith('/app/sessions/current'),
      respond: () => jsonResponse(body, init),
    },
  ]);

/**
 * 지금 어느 주소인지 눈으로 확인할 자리 — 이동이 실제로 일어났는지 잰다.
 *
 * **인자까지 함께 낸다** — 작업지시를 실어 보내는지가 이 부품의 판정 하나이기 때문이다(D10).
 */
const Here = () => {
  const { pathname, search } = useLocation();

  return <p>지금: {`${pathname}${search}`}</p>;
};

const renderNav = (body: unknown, route = '/pop/work-start') =>
  renderWithProviders(
    <>
      <PopScreenNavButton />
      <Here />
    </>,
    { fetch: stub(body), route },
  );

describe('PopScreenNavButton — G-34 화면 이동', () => {
  it('권한 있는 화면만 후보로 보이고 고르면 즉시 이동한다', async () => {
    const user = userEvent.setup();

    renderNav({ ...SESSION, permissions: ['P-02-01', 'P-05-02'] });

    const trigger = await screen.findByRole('combobox', { name: '화면 이동' });
    await waitFor(() => {
      expect(trigger).toBeEnabled();
    });
    await user.click(trigger);

    expect(screen.getByRole('option', { name: '비가동 실적 입력' })).toBeInTheDocument();
    /* ⭐ 화면 코드는 목록에 보이지 않는다(사용자 지시 2026-09-15). */
    expect(screen.queryByText(/P-\d{2}-\d{2}/u)).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '출하 실적 등록' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: '비가동 실적 입력' }));

    expect(screen.getByText('지금: /pop/downtime')).toBeInTheDocument();
    expect(document.documentElement.dataset.popScreenNav).toBe('on');
  });

  /* 지금 서 있는 화면으로 가는 항목은 아무 일도 하지 않는다 — 후보에서 뺀다. */
  it('현재 화면은 후보에 담지 않는다', async () => {
    const user = userEvent.setup();

    renderNav({ ...SESSION, permissions: ['P-02-01', 'P-05-02'] });

    const trigger = await screen.findByRole('combobox', { name: '화면 이동' });
    await waitFor(() => {
      expect(trigger).toBeEnabled();
    });
    await user.click(trigger);

    expect(screen.queryByRole('option', { name: '작업 시작' })).not.toBeInTheDocument();
  });

  it('권한 목록을 못 받으면 비활성으로 두고 사유를 보인다', async () => {
    renderNav(SESSION);

    /* 사유는 머리줄에 늘어놓지 않고 버튼에 붙인다 — 머리줄에서 가장 긴 글이 되면 안 된다. */
    const trigger = await screen.findByTitle('이동할 수 있는 화면을 확인하지 못했습니다');

    expect(trigger).toBeDisabled();
    expect(document.body).not.toHaveTextContent('이동 가능 화면');
  });

  it('갈 수 있는 화면이 없으면 사유를 갈라 보인다', async () => {
    renderNav({ ...SESSION, permissions: [] });

    expect(await screen.findByTitle('이동할 수 있는 화면이 없습니다')).toBeDisabled();
    expect(document.body).not.toHaveTextContent('이동 가능 화면');
  });

  /*
   * ⭐ **작업지시 문맥은 주소 하나로만 흐른다**(사용자 승인 2026-09-15). 자재 투입에서 생산
   *    실적으로 가는 길이 여기뿐인데 인자를 싣지 않아, 그 길로 들어가면 「작업지시를 받지
   *    못했다」로 막히고 작업 시작 화면까지 되돌아가야 했다(WIP-CHAIN-01 D10).
   */
  it('작업지시를 받는 화면으로 갈 때는 지금 주소의 작업지시를 실어 준다', async () => {
    const user = userEvent.setup();

    renderNav(
      { ...SESSION, permissions: ['P-02-03', 'P-02-04'] },
      '/pop/material-input?workOrderId=7801',
    );

    const trigger = await screen.findByRole('combobox', { name: '화면 이동' });
    await waitFor(() => {
      expect(trigger).toBeEnabled();
    });
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: '생산 실적 등록' }));

    expect(
      screen.getByText('지금: /pop/production-result?workOrderId=7801'),
    ).toBeInTheDocument();
  });

  /*
   * ⛔ **받는다고 표기된 화면에만 싣는다.** 모르는 화면에 실으면 그 화면이 쓰지 않는 값이 주소에
   *    남고, 뒤에 같은 이름을 쓰게 되면 «남이 남긴 값»으로 조회가 선다.
   */
  it('작업지시를 받지 않는 화면에는 싣지 않는다', async () => {
    const user = userEvent.setup();

    renderNav(
      { ...SESSION, permissions: ['P-02-03', 'P-05-02'] },
      '/pop/material-input?workOrderId=7801',
    );

    const trigger = await screen.findByRole('combobox', { name: '화면 이동' });
    await waitFor(() => {
      expect(trigger).toBeEnabled();
    });
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: '비가동 실적 입력' }));

    expect(screen.getByText('지금: /pop/downtime')).toBeInTheDocument();
  });

  /* 진입 화면은 사번을 넣기 «전»이라 갈 곳을 물을 자리가 아니다. */
  it('진입 화면에서는 서지 않는다', async () => {
    renderNav({ ...SESSION, permissions: ['P-02-01'] }, '/pop/worker-assignment');

    await waitFor(() => {
      expect(screen.getByText('지금: /pop/worker-assignment')).toBeInTheDocument();
    });
    expect(screen.queryByRole('combobox', { name: '화면 이동' })).not.toBeInTheDocument();
  });
});
