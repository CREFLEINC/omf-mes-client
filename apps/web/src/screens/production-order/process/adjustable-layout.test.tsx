import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdjustableLayout } from './adjustable-layout';

const key = 'test:work-planning:layout';
const Workspace = () => (
  <AdjustableLayout storageKey={key} label="계획·편집" initial="stack">
    <section>계획 목록</section>
    <input aria-label="생산량" defaultValue="120" />
  </AdjustableLayout>
);

describe('작업계획 배치와 영역 크기', () => {
  beforeEach(() => localStorage.clear());
  it('배치를 바꿔도 입력을 유지하고 다음 진입에 고른 배치를 복원한다', async () => {
    const user = userEvent.setup();
    const view = render(<Workspace />);
    await user.clear(screen.getByRole('textbox', { name: '생산량' }));
    await user.type(screen.getByRole('textbox', { name: '생산량' }), '250');
    await user.click(screen.getByRole('button', { name: '좌우 배치' }));
    expect(screen.getByRole('textbox', { name: '생산량' })).toHaveValue('250');
    expect(localStorage.getItem(key)).toBe('side');
    const separator = screen.getByRole('separator', { name: '계획·편집 너비 조절' });
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(Number(localStorage.getItem(`${key}:ratio`))).toBeGreaterThan(0.5);
    view.unmount();
    render(<Workspace />);
    expect(screen.getByRole('button', { name: '좌우 배치' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('상하 영역 높이는 키보드로 조절하고 저장한다', () => {
    render(<Workspace />);
    fireEvent.keyDown(screen.getByRole('separator', { name: '계획·편집 높이 조절' }), {
      key: 'ArrowDown',
    });
    expect(Number(localStorage.getItem(`${key}:height:list-height`))).toBeGreaterThanOrEqual(140);
  });
});
