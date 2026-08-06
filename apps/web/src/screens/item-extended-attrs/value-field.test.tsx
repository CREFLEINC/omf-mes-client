import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ValueField } from './value-field';

describe('ValueField', () => {
  it('라벨과 값을 잇는다 — 무엇의 값인지 보조기술이 읽을 수 있다', () => {
    render(<ValueField label="품목코드" value="SYN-ITEM-01" />);

    expect(screen.getByLabelText('품목코드')).toHaveTextContent('SYN-ITEM-01');
  });

  /*
   * 값 표기는 **폼 컨트롤이 아니다.** 잠긴 입력칸은 「언젠가 열린다」는 뜻이 되는데
   * 이 화면의 원본 열에는 계약에 그 경로가 없다.
   */
  it('입력칸이 아니다', () => {
    render(<ValueField label="품목코드" value="SYN-ITEM-01" />);

    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
