import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { InspectionSteps } from './inspection-steps';

const hub = messages.common.inspectionHub;

const Harness = ({
  attention = false,
  showAll = false,
}: {
  attention?: boolean;
  showAll?: boolean;
}) => {
  const [value, setValue] = useState('');
  return (
    <InspectionSteps
      showAll={showAll}
      steps={[
        {
          title: '수량',
          done: value !== '',
          summary: `수량 ${value}`,
          attention,
          render: (confirm) => (
            <>
              <input
                aria-label="수량 칸"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button type="button" onClick={confirm}>
                다음
              </button>
            </>
          ),
        },
        { title: '판정', done: false, render: () => <p>판정 칸</p> },
      ]}
    />
  );
};

/** 검사 입력 단계(PQC · OQC · #197) — IQC 와 같은 흐름. */
describe('InspectionSteps', () => {
  it('처음에는 첫 단계만 펼치고, 뒤 단계는 [확정] 전에는 그리지 않는다', () => {
    render(<Harness />);

    expect(screen.getByLabelText('수량 칸')).toBeInTheDocument();
    expect(screen.queryByText('판정 칸')).toBeNull();
    expect(screen.queryByRole('button', { name: /^판정/ })).toBeNull();
  });

  it('적는 동안 단계가 채워져도 저절로 넘어가지 않고, [확정]으로 다음 단계를 편다', async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText('수량 칸'), '5');
    expect(screen.getByLabelText('수량 칸')).toBeInTheDocument();
    expect(screen.queryByText('판정 칸')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText('판정 칸')).toBeInTheDocument();
    /* 마친 단계는 요약 + 「펼쳐서 수정」으로 접힌다. */
    const head = screen.getByRole('button', { name: /^수량/ });
    expect(head).toHaveTextContent('수량 5');
    expect(head).toHaveTextContent(hub.stepChange);

    await userEvent.click(head);
    expect(screen.getByLabelText('수량 칸')).toHaveValue('5');
  });

  it('서버가 짚은 단계는 접혀 있어도 펼친다', () => {
    render(<Harness attention />);

    expect(screen.getByLabelText('수량 칸')).toBeInTheDocument();
  });

  it('잠긴 회차는 단계를 모두 펼쳐 보이고 접는 단추가 없다', () => {
    render(<Harness showAll />);

    expect(screen.getByLabelText('수량 칸')).toBeInTheDocument();
    expect(screen.getByText('판정 칸')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^수량/ })).toBeNull();
  });
});
