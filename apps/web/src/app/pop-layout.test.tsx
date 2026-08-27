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

  /**
   * ⚠ **글자 하나를 막는 것으로는 부족하다.** 「단말」이라는 낱말만 막으면 정작 금지 대상인
   * 지어낸 값(단말 이름·사번)은 그 낱말을 포함하지 않아 그대로 통과한다 — 실측으로 확인했다.
   * 그래서 머리에 들어갈 것을 **화이트리스트로 고정한다.**
   */
  it('머리에 프로그램 이름 말고 아무것도 두지 않는다 — 없는 값을 지어내지 않는다', () => {
    renderLayout('POP 본문');

    expect(screen.getByRole('banner')).toHaveTextContent(/^OMF-MES POP$/u);
  });
});
