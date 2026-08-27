import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PopLayout } from './pop-layout';

const renderLayout = (children: string) => render(<PopLayout>{children}</PopLayout>);

describe('PopLayout', () => {
  it('본문을 그린다', () => {
    renderLayout('POP 본문');

    expect(screen.getByRole('main', { name: '본문' })).toHaveTextContent('POP 본문');
  });

  it('POP 프로그램임을 머리에 밝힌다 — 관리웹과 같은 코드에서 나오므로 구분이 필요하다', () => {
    renderLayout('POP 본문');

    expect(screen.getByRole('banner')).toHaveTextContent('OMF-MES POP');
  });

  it('사이드바를 두지 않는다 — 키오스크에는 화면을 고르는 조작이 없다', () => {
    renderLayout('POP 본문');

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('단말·사용자 자리를 지어내지 않는다 — 받을 경로가 아직 없다', () => {
    renderLayout('POP 본문');

    expect(screen.getByRole('banner')).not.toHaveTextContent('단말');
  });
});
