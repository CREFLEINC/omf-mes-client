import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScanZone } from './scan-zone';

const field = { ref: () => undefined };

describe('스캔 구역', () => {
  /*
   * 화면에는 「SCAN」 한 낱말만 선다(사용자 지시 2026-10-21). 무엇을 쏘는지는 단계 제목이 말하고,
   * 지시는 낭독기에 칸의 설명으로 준다.
   */
  it('칸은 이름으로 찾히고 SCAN 만 보이며 지시는 칸의 설명으로 준다', () => {
    render(<ScanZone field={field} label="LOT 번호" prompt="스캐너 단추를 누르세요" />);

    const input = screen.getByLabelText('LOT 번호');

    expect(input).toHaveAttribute('placeholder', 'SCAN');
    expect(input).toHaveAccessibleDescription('스캐너 단추를 누르세요');
  });

  /* 손으로 넣는 단추는 구역 안이 아니라 아래 따로 선다. */
  it('도구 단추는 구역 상자 밖 아래 줄에 선다', () => {
    render(
      <ScanZone
        field={field}
        label="LOT 번호"
        prompt="스캐너 단추를 누르세요"
        tools={<button type="button">직접 입력</button>}
      />,
    );

    const tool = screen.getByRole('button', { name: '직접 입력' });

    expect(tool.closest('.scan-zone__box')).toBeNull();
    expect(tool.parentElement).toHaveClass('scan-zone__tools');
  });

  /* 무엇이 틀렸는지가 칸에 묶여야 낭독기도 칸과 함께 읽는다. */
  it('받을 수 없는 값은 칸의 설명으로 묶어 아래 한 줄에 보인다', () => {
    render(
      <ScanZone
        field={field}
        label="LOT 번호"
        prompt="스캐너 단추를 누르세요"
        error="자재 LOT 번호 형식이 아닙니다"
      />,
    );

    const input = screen.getByLabelText('LOT 번호');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('자재 LOT 번호 형식이 아닙니다');
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
