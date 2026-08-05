import { ToastProvider } from '@crefle/web-ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { WarehouseLocationScreen } from './screen';

const renderScreen = (search = '?demo=default') => {
  const router = createMemoryRouter(
    [{ path: '/master-data/warehouse-location', element: <WarehouseLocationScreen /> }],
    { initialEntries: [`/master-data/warehouse-location${search}`] },
  );

  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
};

describe('WarehouseLocationScreen (데모 컨테이너)', () => {
  it('예시 데이터 안내 배너를 항상 보인다', () => {
    renderScreen();

    expect(screen.getByText('예시 데이터로 배치를 확인하는 화면입니다')).toBeInTheDocument();
  });

  it('demo=default에서 창고 3건이 목록에 보인다', () => {
    renderScreen();

    expect(screen.getByRole('button', { name: 'WH-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WH-02' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WH-03' })).toBeInTheDocument();
  });

  it('Location 탭으로 전환하면 보이는 패널 안에서 Location 계층이 조회된다', async () => {
    const user = userEvent.setup();
    renderScreen();

    // 전환 전에는 창고 정보 패널이 보인다.
    expect(within(screen.getByRole('tabpanel')).getByLabelText('창고코드')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Location' }));

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: 'A-01' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'A-01-01' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'B-01' })).toBeInTheDocument();
  });

  it('demo=empty에서는 빈 상태 문구를 낸다', () => {
    renderScreen('?demo=empty');

    expect(screen.getByText('아직 등록된 창고가 없습니다')).toBeInTheDocument();
  });

  it('demo=loading에서는 스켈레톤을 낸다', () => {
    renderScreen('?demo=loading');

    expect(screen.getByRole('status', { name: '창고 목록을 불러오는 중' })).toBeInTheDocument();
  });

  it('demo=error에서는 입력 오류가 인라인으로 보인다', () => {
    renderScreen('?demo=error');

    const panel = screen.getByRole('tabpanel');
    expect(
      within(panel).getByText('이미 사용 중인 코드입니다. 다른 코드를 입력하세요.'),
    ).toBeInTheDocument();
  });

  it('demo=conflict에서는 저장 충돌 배너와 최신 불러오기 액션이 보인다', () => {
    renderScreen('?demo=conflict');

    const panel = screen.getByRole('tabpanel');
    expect(
      within(panel).getByText(
        '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
  });

  it('저장을 누르면 다음 단계에서 연결된다는 안내가 뜬다 — 무반응이 아니다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const panel = screen.getByRole('tabpanel');
    await user.type(within(panel).getByLabelText('창고명'), '가');
    await user.click(within(panel).getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('레이아웃 확인 단계입니다 — 저장은 다음 단계에서 연결됩니다.'),
    ).toBeInTheDocument();
  });

  it('사용 중지를 누르면 안내가 뜬다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      within(screen.getByRole('tabpanel')).getByRole('button', { name: '사용 중지' }),
    );

    expect(
      await screen.findByText('레이아웃 확인 단계입니다 — 저장은 다음 단계에서 연결됩니다.'),
    ).toBeInTheDocument();
  });

  it('Location 계층의 접기 버튼이 실제로 동작한다', async () => {
    const user = userEvent.setup();
    renderScreen('?tab=location');

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: 'A-01-01' })).toBeInTheDocument();

    await user.click(within(panel).getAllByRole('button', { name: '하위 접기' })[0]!);

    expect(
      within(screen.getByRole('tabpanel')).queryByRole('button', { name: 'A-01-01' }),
    ).not.toBeInTheDocument();
  });

  it('최상위 추가를 누르면 Location 입력 다이얼로그가 열린다', async () => {
    const user = userEvent.setup();
    renderScreen('?tab=location');

    await user.click(
      within(screen.getByRole('tabpanel')).getByRole('button', { name: '최상위 추가' }),
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByLabelText('위치코드')).toBeInTheDocument();
  });
});
