import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DisabledAction } from './disabled-action';

describe('DisabledAction', () => {
  it('컨트롤이 잠기고 그 이름이 보인다', () => {
    render(<DisabledAction label="열기" reason="열기: 이 대상은 열 수 있는 화면이 없습니다" />);

    expect(screen.getByRole('button', { name: '열기' })).toBeDisabled();
  });

  /**
   * **사유를 감추지 않는다**(배치 규범 4). 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는
   * 키보드·스크린리더 사용자가 닿을 수 없다 — 항상 보이는 글자로 세우고 `aria-describedby`로 잇는다.
   */
  it('사유가 보이는 글자로 서고 컨트롤에 이어진다', () => {
    const reason = '열기: 이 대상은 열 수 있는 화면이 없습니다';

    render(<DisabledAction label="열기" reason={reason} />);

    const button = screen.getByRole('button', { name: '열기' });
    const note = screen.getByText(reason);

    expect(note).toBeVisible();
    expect(button.getAttribute('aria-describedby')).toBe(note.id);
    expect(note.id).not.toBe('');
  });

  /** 사유가 바뀌면 이어진 글자도 바뀐다 — 잇는 자리를 상수로 굳히면 지난 사유가 남는다. */
  it('사유가 여럿 서도 각자 자기 컨트롤에 이어진다', () => {
    render(
      <>
        <DisabledAction label="열기" reason="열기: 첫째 사유" />
        <DisabledAction label="닫기" reason="닫기: 둘째 사유" />
      </>,
    );

    expect(screen.getByRole('button', { name: '열기' }).getAttribute('aria-describedby')).toBe(
      screen.getByText('열기: 첫째 사유').id,
    );
    expect(screen.getByRole('button', { name: '닫기' }).getAttribute('aria-describedby')).toBe(
      screen.getByText('닫기: 둘째 사유').id,
    );
  });
});
