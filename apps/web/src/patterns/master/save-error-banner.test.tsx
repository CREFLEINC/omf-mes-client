import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SaveErrorBanner } from './save-error-banner';

const reloadName = messages.conflict.reloadAction;

describe('SaveErrorBanner', () => {
  it('오류가 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<SaveErrorBanner error={null} onReload={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('충돌 3원인이 서로 다른 문구를 낸다 — 대응 방법이 다르다', () => {
    const rendered = (['user', 'erpSync', 'workerLease'] as const).map((cause) => {
      const view = render(<SaveErrorBanner error={{ kind: 'conflict', cause, message: '' }} />);
      const text = view.getByRole('alert').textContent ?? '';
      view.unmount();
      return text;
    });

    expect(rendered[0]).toContain(messages.conflict.user);
    expect(rendered[1]).toContain(messages.conflict.erpSync);
    expect(rendered[2]).toContain(messages.conflict.workerLease);
    expect(new Set(rendered).size).toBe(3);
  });

  it('충돌에는 「최신 불러오기」와 입력이 사라진다는 안내가 함께 나온다', async () => {
    const onReload = vi.fn();
    render(
      <SaveErrorBanner
        error={{ kind: 'conflict', cause: 'user', message: '' }}
        onReload={onReload}
      />,
    );

    expect(screen.getByText(messages.conflict.reloadNote)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: reloadName }));

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('상태 잠김에는 「최신 불러오기」를 내지 않는다 — 재조회해도 풀리지 않는다', () => {
    render(
      <SaveErrorBanner
        error={{
          kind: 'stateLocked',
          errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '확정 상태' }],
        }}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByText(messages.stateLocked.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: reloadName })).not.toBeInTheDocument();
  });

  it('403은 권한 문구를 낸다', () => {
    render(<SaveErrorBanner error={{ kind: 'http', status: 403 }} onReload={vi.fn()} />);

    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: reloadName })).not.toBeInTheDocument();
  });

  it('403이 아닌 http 오류는 일반 문구와 서버가 준 문구를 함께 낸다', () => {
    render(<SaveErrorBanner error={{ kind: 'http', status: 500, message: '처리 지연' }} />);

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(messages.httpError.description);
    expect(banner).toHaveTextContent('처리 지연');
  });

  it('network는 연결을 확인하라는 문구를 낸다', () => {
    render(<SaveErrorBanner error={{ kind: 'network' }} />);

    expect(screen.getByText(messages.httpError.offline)).toBeInTheDocument();
  });

  it('화면 범위 검증 오류는 서버 문구를 그대로 나열한다 — 어디에도 안 보이는 오류를 만들지 않는다', () => {
    render(
      <SaveErrorBanner
        error={{
          kind: 'validation',
          errors: [
            { scope: 'screen', code: 'RULE', message: '사용 중지된 공장입니다' },
            { scope: 'field', field: '알 수 없는칸', code: 'REQUIRED', message: '값이 필요합니다' },
          ],
        }}
      />,
    );

    expect(screen.getByText('사용 중지된 공장입니다')).toBeInTheDocument();
    expect(screen.getByText('값이 필요합니다')).toBeInTheDocument();
  });

  it('배너는 아래 블록과의 이음매를 스스로 갖는다 — 배치하는 화면이 잊을 수 없다', () => {
    const { container } = render(<SaveErrorBanner error={{ kind: 'network' }} />);

    expect(container.querySelector('.banner-slot')).not.toBeNull();
  });
});
