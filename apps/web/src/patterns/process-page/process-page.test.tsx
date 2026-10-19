import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EffectList } from './effect-list';
import { ProcessPage } from './process-page';

const t = messages.common.processPage;

const STEPS = [
  { key: 'a', label: '라인 선택' },
  { key: 'b', label: '입고 정보' },
  { key: 'c', label: '확정 확인' },
];

const renderPage = (currentStep: number, isLocked = false) => {
  const onStepSelect = vi.fn();
  const onBack = vi.fn();

  render(
    <ProcessPage
      backLabel="작업함"
      onBack={onBack}
      isLocked={isLocked}
      title="IR-1"
      summary="공급사 · 일시"
      steps={STEPS}
      currentStep={currentStep}
      onStepSelect={onStepSelect}
      previousSummary="1번 줄"
      remaining="창고를 고르세요."
      remainingId="remaining"
      actions={<Button aria-describedby="remaining">다음</Button>}
    >
      <p>본문</p>
    </ProcessPage>,
  );

  return { onStepSelect, onBack, user: userEvent.setup() };
};

describe('ProcessPage (T-W-C)', () => {
  it('처리 머리·단계·지난 단계 요약·본문·하단 바를 그린다', () => {
    renderPage(1);

    expect(screen.getByRole('heading', { name: 'IR-1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '작업함' })).toBeInTheDocument();
    expect(screen.getByLabelText(t.previousSummary)).toHaveTextContent('1번 줄');
    expect(screen.getByText('본문')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: t.actionBar })).toHaveTextContent('창고를 고르세요.');
  });

  it('완료한 단계만 눌러 돌아갈 수 있다', async () => {
    const { onStepSelect, user } = renderPage(1);

    await user.click(screen.getByRole('button', { name: t.returnToStep('라인 선택') }));

    expect(onStepSelect).toHaveBeenCalledWith(0);
    expect(screen.queryByRole('button', { name: t.returnToStep('확정 확인') })).toBeNull();
  });

  it('보내는 중에는 단계와 작업함으로 돌아가지 않는다', () => {
    renderPage(2, true);

    expect(screen.queryByRole('button', { name: t.returnToStep('라인 선택') })).toBeNull();
    expect(screen.getByRole('button', { name: '작업함' })).toBeDisabled();
  });
});

describe('EffectList', () => {
  it('빠지는 반영 사항을 지운 줄과 경고로 보인다', () => {
    render(
      <EffectList
        title="입고 처리 시 반영 사항"
        items={[
          { key: 'a', label: '입고 전표 생성' },
          { key: 'b', label: 'ERP 송신', excludedReason: '한도승인 건은 송신하지 않습니다.' },
        ]}
        irreversibleNote="확정 후에는 수정할 수 없습니다"
      />,
    );

    expect(screen.getByText('ERP 송신').tagName).toBe('DEL');
    expect(screen.getByText(/한도승인 건은/)).toBeInTheDocument();
    expect(screen.getByText('확정 후에는 수정할 수 없습니다')).toBeInTheDocument();
  });
});
