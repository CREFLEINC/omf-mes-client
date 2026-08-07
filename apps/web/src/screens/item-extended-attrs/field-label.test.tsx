import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FieldLabel } from './field-label';

const renderLabel = (required: boolean) =>
  render(
    <>
      <FieldLabel htmlFor="target" label="유효기한(일)" required={required} />
      <input id="target" />
    </>,
  );

describe('FieldLabel', () => {
  it('라벨이 컨트롤을 가리킨다', () => {
    renderLabel(false);

    expect(screen.getByLabelText('유효기한(일)')).toHaveAttribute('id', 'target');
  });

  /*
   * `*`를 `<label>` 안에 넣으면 접근성 이름이 「이름 *」이 되어 라벨 조회가 깨진다.
   * 배치 규범 3이 정한 처리다.
   */
  it('필수 표시가 접근성 이름을 흐리지 않는다', () => {
    renderLabel(true);

    expect(screen.getByLabelText('유효기한(일)')).toBeInTheDocument();
  });
});
