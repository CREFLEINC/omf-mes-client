import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InspectionDrawingImages } from './inspection-drawings';

const altOf = (index: number) => `도면 ${String(index)}`;
const labels = { prev: '이전 도면', next: '다음 도면' };
const drawing = (attachmentId: number) => ({
  attachmentId,
  blob: new Blob([String(attachmentId)], { type: 'image/png' }),
});

describe('InspectionDrawingImages (omf-all-around#208)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('고른 버전이 바뀌면 이전 버전 그림이 남지 않고 그 주소를 거둔다', () => {
    let seq = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test/${String(++seq)}`);
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const { rerender } = render(
      <InspectionDrawingImages drawings={[drawing(1), drawing(2)]} altOf={altOf} labels={labels} />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:test/1');

    rerender(<InspectionDrawingImages drawings={[drawing(9)]} altOf={altOf} labels={labels} />);

    expect(screen.getByRole('img', { name: '도면 1' })).toHaveAttribute('src', 'blob:test/3');
    expect(revoke).toHaveBeenCalledWith('blob:test/1');
    expect(revoke).toHaveBeenCalledWith('blob:test/2');
    expect(revoke).not.toHaveBeenCalledWith('blob:test/3');
  });

  /* 한 장씩 보이고 화살표 · 점 · 화살표 키로 넘긴다(사용자 시안 · #208). */
  it('도면 3건이면 한 장씩 보이고 화살표 · 점 · 키보드로 넘긴다', async () => {
    let seq = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:three/${String(++seq)}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(
      <InspectionDrawingImages
        drawings={[drawing(1), drawing(2), drawing(3)]}
        altOf={altOf}
        labels={labels}
      />,
    );

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img')).toHaveAccessibleName('도면 1');
    expect(screen.getByRole('button', { name: '도면 1' })).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByRole('button', { name: '다음 도면' }));
    expect(screen.getByRole('img')).toHaveAccessibleName('도면 2');

    await user.click(screen.getByRole('button', { name: '도면 3' }));
    expect(screen.getByRole('img')).toHaveAccessibleName('도면 3');

    // 끝에서 다음은 처음으로, 처음에서 이전은 끝으로 돈다.
    await user.click(screen.getByRole('button', { name: '다음 도면' }));
    expect(screen.getByRole('img')).toHaveAccessibleName('도면 1');
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' });
    expect(screen.getByRole('img')).toHaveAccessibleName('도면 3');
  });

  it('도면이 한 장이면 화살표 · 점을 두지 않는다', () => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:one/1');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    render(<InspectionDrawingImages drawings={[drawing(1)]} altOf={altOf} labels={labels} />);

    expect(screen.getByRole('img')).toHaveAccessibleName('도면 1');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
