import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ItemLabelLines } from './item-label-lines';

describe('ItemLabelLines', () => {
  it('splits 「코드 · 이름」 into a code line and a name line', () => {
    const { container } = render(<ItemLabelLines label="F534F50200 · SUB ASSY:DIVERTER SENSOR" />);

    expect(container.querySelector('.work-order-release-item-code')).toHaveTextContent(
      'F534F50200',
    );
    expect(container.querySelector('.work-order-release-item-name')).toHaveTextContent(
      'SUB ASSY:DIVERTER SENSOR',
    );
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it('keeps a status phrase on one line', () => {
    const { container } = render(<ItemLabelLines label="품목 표시명 없음" />);

    expect(container.querySelector('.work-order-release-item-code')).toBeNull();
    expect(screen.getByText('품목 표시명 없음')).toBeInTheDocument();
  });

  it('splits only at the first separator so names keeping 「 · 」 stay whole', () => {
    const { container } = render(<ItemLabelLines label="CODE-1 · 이름 · 뒷말" />);

    expect(container.querySelector('.work-order-release-item-name')).toHaveTextContent(
      '이름 · 뒷말',
    );
  });

  it('keeps each line to one line and offers the whole value on hover', () => {
    const label = 'F534F50200 · SUB ASSY:DIVERTER SENSOR';
    const { container } = render(<ItemLabelLines label={label} />);

    expect(container.querySelector('.work-order-release-item-label')).toHaveAttribute(
      'title',
      label,
    );
    expect(container.querySelectorAll('.work-order-release-item-label > span')).toHaveLength(2);
  });
});
