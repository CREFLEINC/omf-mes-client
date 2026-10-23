import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScanZone } from './scan-zone';

const field = { ref: () => undefined };

describe('스캔 구역', () => {
  it('칸은 이름으로 찾히고 지시를 자리표시로 세운다', () => {
    render(<ScanZone field={field} label="LOT 번호" prompt="스캐너 단추를 누르세요" />);

    expect(screen.getByLabelText('LOT 번호')).toHaveAttribute(
      'placeholder',
      '스캐너 단추를 누르세요',
    );
  });

  /* 무엇이 틀렸는지가 칸에 묶여야 낭독기도 칸과 함께 읽는다. */
  it('받을 수 없는 값은 칸의 설명으로 묶어 아래 한 줄에 보인다', () => {
    render(
      <ScanZone
        field={field}
        label="LOT 번호"
        prompt="스캐너 단추를 누르세요"
        hint="제품코드 | 수량"
        error="자재 LOT 번호 형식이 아닙니다"
      />,
    );

    const input = screen.getByLabelText('LOT 번호');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('자재 LOT 번호 형식이 아닙니다');
  });

  /* 받은 뒤에는 다음 단계가 주인공이다 - 형식 안내까지 세우면 대기 줄이 다시 커진다. */
  it('대기 줄에는 형식 안내를 세우지 않는다', () => {
    render(
      <ScanZone
        field={field}
        label="LOT 번호"
        prompt="다른 라벨을 스캔하면 바꿀지 묻습니다"
        hint="제품코드 | 수량"
        standby
      />,
    );

    expect(screen.queryByText('제품코드 | 수량')).toBeNull();
  });

  it('스캐너가 쓰는 칸에 ref 를 건다', () => {
    let attached: HTMLInputElement | null = null;
    render(
      <ScanZone
        field={{
          ref: (node) => {
            attached = node;
          },
        }}
        label="LOT 번호"
        prompt="스캐너 단추를 누르세요"
      />,
    );

    expect(attached).toBe(screen.getByLabelText('LOT 번호'));
  });
});
