import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { BatchResultView } from './batch-result';
import { BatchRetryDialog } from './batch-retry-dialog';

const renderDialog = (props: Partial<Parameters<typeof BatchRetryDialog>[0]> = {}) => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(
    <BatchRetryDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      selectedCount={3}
      isSaving={false}
      result={null}
      banner={null}
      {...props}
    />,
  );

  return { onClose, onConfirm, user: userEvent.setup() };
};

const resultView = (overrides: Partial<BatchResultView> = {}): BatchResultView => ({
  summary: '2건을 다시 보냈습니다. 1건은 보내지 못했습니다.',
  failed: [{ label: 'SAMPLE-KEY-0003', reasons: ['상태가 맞지 않습니다'] }],
  isAllSucceeded: false,
  ...overrides,
});

describe('BatchRetryDialog — 확인 단계', () => {
  it('고른 건수와 부분 실패 가능성을 함께 밝힌다', () => {
    renderDialog();

    expect(screen.getByText('선택한 3건을 다시 보낼까요?')).toBeInTheDocument();
    expect(
      screen.getByText('일부만 성공할 수 있습니다. 결과를 건별로 알려 드립니다.'),
    ).toBeInTheDocument();
  });

  it('확인을 누르면 보낸다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '선택 일괄 재처리' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('보내는 중에는 확인이 잠긴다 — 연타해도 두 번 나가지 않는다', () => {
    renderDialog({ isSaving: true });

    expect(screen.getByRole('button', { name: '선택 일괄 재처리' })).toBeDisabled();
  });

  it('바깥 어둠을 눌러도 닫히지 않는다', async () => {
    const { onClose, user } = renderDialog();

    await user.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('BatchRetryDialog — 결과 단계', () => {
  it('부분 실패면 성공 건수와 실패 건별 사유를 함께 낸다', () => {
    renderDialog({ result: resultView() });

    expect(screen.getByText('재처리 결과')).toBeInTheDocument();
    expect(screen.getByText('2건을 다시 보냈습니다. 1건은 보내지 못했습니다.')).toBeInTheDocument();

    const failedList = screen.getByRole('region', { name: '보내지 못한 건' });
    expect(within(failedList).getByText('SAMPLE-KEY-0003')).toBeInTheDocument();
    expect(within(failedList).getByText('상태가 맞지 않습니다')).toBeInTheDocument();
  });

  it('전건 실패면 성공 안내가 나오지 않는다', () => {
    renderDialog({
      result: resultView({
        summary: null,
        failed: [
          { label: 'SAMPLE-KEY-0001', reasons: ['사유를 받지 못했습니다.'] },
          { label: '어느 건인지 알 수 없습니다.', reasons: ['상태가 맞지 않습니다'] },
        ],
      }),
    });

    expect(screen.queryByText(/다시 보냈습니다/)).not.toBeInTheDocument();
    expect(screen.getByText('어느 건인지 알 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('사유를 받지 못했습니다.')).toBeInTheDocument();
  });

  it('되짚지 못한 건도 목록에서 사라지지 않는다', () => {
    renderDialog({
      result: resultView({
        failed: [{ label: '어느 건인지 알 수 없습니다.', reasons: ['사유를 받지 못했습니다.'] }],
      }),
    });

    expect(
      within(screen.getByRole('region', { name: '보내지 못한 건' })).getByText(
        '어느 건인지 알 수 없습니다.',
      ),
    ).toBeInTheDocument();
  });

  it('결과 단계에서는 보내는 수단이 사라지고 닫기만 남는다', () => {
    renderDialog({ result: resultView() });

    expect(screen.queryByRole('button', { name: '선택 일괄 재처리' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '닫기' }).length).toBeGreaterThan(0);
  });

  it('결과 단계에서도 바깥 어둠으로 닫히지 않는다 — 건별 사유가 이 창에만 있다', async () => {
    const { onClose, user } = renderDialog({ result: resultView() });

    await user.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('BatchRetryDialog — 요청 자체가 실패', () => {
  it('건별 결과가 아니라 요청이 실패했으면 그 표시를 창 안에 낸다', () => {
    renderDialog({ banner: <p>보내지 못했습니다</p> });

    expect(screen.getByText('보내지 못했습니다')).toBeInTheDocument();
    // 실패했어도 확인 단계에 머문다 — 사유를 보고 다시 시도할 수 있어야 한다.
    expect(screen.getByRole('button', { name: '선택 일괄 재처리' })).toBeInTheDocument();
  });
});
