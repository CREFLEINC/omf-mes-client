import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PlanActionBanner } from './plan-action-banner';

describe('PlanActionBanner', () => {
  it('오류가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<PlanActionBanner error={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  /* 서버가 코드만 주고 문구를 비워 보내는 일이 실제로 있다 — 그때도 안내가 남아야 한다. */
  it('확정 버전 필요 코드는 서버 문구가 비어도 화면 안내를 낸다', () => {
    render(
      <PlanActionBanner
        error={{
          kind: 'validation',
          errors: [{ scope: 'screen', code: 'CONFIRMED_VERSION_REQUIRED', message: '' }],
        }}
      />,
    );

    expect(
      screen.getByText('승인은 확정된 버전이 있어야 할 수 있습니다. 버전을 먼저 확정하세요.'),
    ).toBeInTheDocument();
  });

  it('검사 항목 필요 코드도 화면 안내를 낸다', () => {
    render(
      <PlanActionBanner
        error={{
          kind: 'validation',
          errors: [{ scope: 'screen', code: 'LINE_REQUIRED', message: '' }],
        }}
      />,
    );

    expect(screen.getByText('확정은 검사 항목을 1건 이상 저장해야 할 수 있습니다.')).toBeInTheDocument();
  });

  /* 삼키면 어디에도 보이지 않는 오류가 된다. */
  it('서버가 함께 준 문구도 덧붙인다', () => {
    render(
      <PlanActionBanner
        error={{
          kind: 'validation',
          errors: [
            { scope: 'screen', code: 'CONFIRMED_VERSION_REQUIRED', message: '확정 버전이 없습니다.' },
          ],
        }}
      />,
    );

    expect(
      screen.getByText('승인은 확정된 버전이 있어야 할 수 있습니다. 버전을 먼저 확정하세요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('확정 버전이 없습니다.')).toBeInTheDocument();
  });

  it('아는 코드가 아니면 서버 문구를 그대로 낸다', () => {
    render(
      <PlanActionBanner
        error={{
          kind: 'validation',
          errors: [{ scope: 'screen', code: 'STANDARD', message: '알 수 없는 사유입니다.' }],
        }}
      />,
    );

    expect(screen.getByText('알 수 없는 사유입니다.')).toBeInTheDocument();
  });

  it('권한 없음은 공통 안내로 낸다', () => {
    render(<PlanActionBanner error={{ kind: 'http', status: 403 }} />);

    expect(
      screen.getByText('이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.'),
    ).toBeInTheDocument();
  });

  it('충돌이면 원인 문구와 「최신 불러오기」를 낸다', async () => {
    const onReload = vi.fn<() => void>();
    render(
      <PlanActionBanner error={{ kind: 'conflict', cause: 'user', message: '' }} onReload={onReload} />,
    );

    expect(
      screen.getByText('다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.'),
    ).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: '최신 불러오기' }));

    expect(onReload).toHaveBeenCalled();
  });

  /* 재조회로 풀리지 않는 오류에 「최신 불러오기」를 내면 헛수고를 시킨다. */
  it('상태 잠김에는 「최신 불러오기」를 내지 않는다', () => {
    render(
      <PlanActionBanner
        error={{
          kind: 'stateLocked',
          errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '' }],
        }}
        onReload={() => undefined}
      />,
    );

    expect(screen.getByText('지금은 저장할 수 없는 상태입니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });
});
