import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TextArea } from '@omf-mes/ui';

const describedText = (control: HTMLElement): string[] =>
  (control.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent ?? '');

describe('TextArea', () => {
  it('표준 textarea 속성과 ref를 실제 컨트롤에 전달한다', () => {
    const ref = createRef<HTMLTextAreaElement>();
    const onBlur = vi.fn();

    render(
      <TextArea
        ref={ref}
        label="판정 사유"
        name="transitionReason"
        placeholder="사유를 입력하세요"
        rows={5}
        maxLength={200}
        defaultValue="초기 사유"
        onBlur={onBlur}
      />,
    );

    const control = screen.getByRole('textbox', { name: '판정 사유' });
    expect(control).toHaveValue('초기 사유');
    expect(control).toHaveAttribute('name', 'transitionReason');
    expect(control).toHaveAttribute('placeholder', '사유를 입력하세요');
    expect(control).toHaveAttribute('rows', '5');
    expect(control).toHaveAttribute('maxlength', '200');
    expect(ref.current).toBe(control);
    fireEvent.blur(control);
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it('제어형 값을 바꾸고 표준 change 이벤트를 전달한다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const ControlledTextArea = () => {
      const [value, setValue] = useState('보류');

      return (
        <TextArea
          aria-label="상태 사유"
          value={value}
          onChange={(event) => {
            onChange(event.currentTarget.value);
            setValue(event.currentTarget.value);
          }}
        />
      );
    };

    render(<ControlledTextArea />);

    const control = screen.getByRole('textbox', { name: '상태 사유' });
    await user.clear(control);
    await user.type(control, '정상 전환');

    expect(control).toHaveValue('정상 전환');
    expect(onChange).toHaveBeenLastCalledWith('정상 전환');
  });

  it('오류가 비활성 사유와 도움말보다 앞서고 접근성 설명으로 연결된다', () => {
    render(
      <>
        <p id="shared-description">공통 설명</p>
        <TextArea
          label="판정 사유"
          disabled
          helperText="처리 근거를 적으세요"
          disabledReason="처리 중에는 바꿀 수 없습니다"
          error="판정 사유를 입력하세요"
          aria-describedby="shared-description"
        />
      </>,
    );

    const control = screen.getByRole('textbox', { name: '판정 사유' });
    expect(describedText(control)).toEqual(['공통 설명', '판정 사유를 입력하세요']);
    expect(screen.queryByText('처리 중에는 바꿀 수 없습니다')).not.toBeInTheDocument();
    expect(screen.queryByText('처리 근거를 적으세요')).not.toBeInTheDocument();
    expect(control).toHaveAttribute('aria-invalid', 'true');
  });

  it('오류가 없으면 비활성 컨트롤에만 비활성 사유를 연결한다', () => {
    const { rerender } = render(
      <TextArea
        label="판정 사유"
        disabled
        helperText="처리 근거를 적으세요"
        disabledReason="처리 중에는 바꿀 수 없습니다"
      />,
    );

    let control = screen.getByRole('textbox', { name: '판정 사유' });
    expect(describedText(control)).toEqual(['처리 중에는 바꿀 수 없습니다']);
    expect(screen.queryByText('처리 근거를 적으세요')).not.toBeInTheDocument();

    rerender(
      <TextArea
        label="판정 사유"
        helperText="처리 근거를 적으세요"
        disabledReason="처리 중에는 바꿀 수 없습니다"
      />,
    );

    control = screen.getByRole('textbox', { name: '판정 사유' });
    expect(describedText(control)).toEqual(['처리 근거를 적으세요']);
    expect(screen.queryByText('처리 중에는 바꿀 수 없습니다')).not.toBeInTheDocument();
  });

  it('필수·비활성·읽기 전용 의미를 textarea에 보존한다', () => {
    render(
      <>
        <TextArea label="필수 사유" required />
        <TextArea label="잠긴 사유" disabled disabledReason="저장 중입니다" />
        <TextArea label="읽기 전용 사유" readOnly helperText="조회만 할 수 있습니다" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: '필수 사유' })).toBeRequired();
    expect(screen.getByRole('textbox', { name: '필수 사유' })).toHaveAttribute(
      'aria-required',
      'true',
    );
    expect(screen.getByRole('textbox', { name: '잠긴 사유' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: '읽기 전용 사유' })).toHaveAttribute('readonly');
    expect(describedText(screen.getByRole('textbox', { name: '읽기 전용 사유' }))).toEqual([
      '조회만 할 수 있습니다',
    ]);
  });

  it('시각적 라벨 없이 소비자가 접근 가능한 이름을 제공할 수 있다', () => {
    render(
      <>
        <TextArea aria-label="직접 이름" />
        <span id="external-label">외부 이름</span>
        <TextArea aria-labelledby="external-label" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: '직접 이름' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '외부 이름' })).toBeInTheDocument();
  });

  it('전체 폭과 크기 조절 방향을 DOM 계약으로 드러낸다', () => {
    render(<TextArea label="판정 사유" fullWidth resize="horizontal" />);

    const control = screen.getByRole('textbox', { name: '판정 사유' });
    expect(control).toHaveAttribute('data-resize', 'horizontal');
    expect(control.closest('.omf-text-area')).toHaveAttribute('data-full-width', 'true');
  });
});
