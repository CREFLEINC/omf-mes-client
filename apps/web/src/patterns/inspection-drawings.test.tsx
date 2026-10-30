import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InspectionDrawingImages } from './inspection-drawings';

const altOf = (index: number) => `도면 ${String(index)}`;
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
      <InspectionDrawingImages drawings={[drawing(1), drawing(2)]} altOf={altOf} />,
    );
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('src'))).toEqual([
      'blob:test/1',
      'blob:test/2',
    ]);

    rerender(<InspectionDrawingImages drawings={[drawing(9)]} altOf={altOf} />);

    expect(screen.getAllByRole('img').map((img) => img.getAttribute('src'))).toEqual([
      'blob:test/3',
    ]);
    expect(screen.getByRole('img', { name: '도면 1' })).toBeInTheDocument();
    expect(revoke).toHaveBeenCalledWith('blob:test/1');
    expect(revoke).toHaveBeenCalledWith('blob:test/2');
    expect(revoke).not.toHaveBeenCalledWith('blob:test/3');
  });
});
