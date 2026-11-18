import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../../test/api-harness';
import { ProposalReview } from './review';
import { previewProposals, previewResourceSource } from './preview';
import type { ReviewProposal } from './model';
const readyRow = (id: string) => ({
  ...structuredClone(previewProposals[0]!),
  id,
  number: `TEST-${id}`,
});
describe('#277 review integration', () => {
  it('requires revalidation before selection and shows per-W/O partial success', async () => {
    const user = userEvent.setup();
    const a = { ...readyRow('1'), live: true, validated: false };
    const b = readyRow('2');
    const revalidate = vi.fn(async (row: ReviewProposal) => ({ ...row, validated: true }));
    const confirm = vi.fn(async (row: ReviewProposal) => {
      if (row.id === '2') throw new Error('생산 라인을 확인하세요');
      return {
        ...row,
        outcome: 'CONFIRMED' as const,
        changed: false,
        plans: row.plans.map((plan) => ({ ...plan, source: '기존 확정 계획' as const })),
      };
    });
    renderWithProviders(
      <ProposalReview
        manualLayout={false}
        initialProposals={[a, b]}
        resourceSource={previewResourceSource}
        onClose={() => {}}
        onRevalidate={revalidate}
        onConfirmRow={confirm}
        errorText={(error) => String((error as Error).message)}
      />,
      { session: null },
    );
    expect(screen.getByRole('checkbox', { name: 'TEST-1 확정 선택' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '제안 재검증' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'TEST-1 확정 선택' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('checkbox', { name: 'TEST-1 확정 선택' }));
    await user.click(screen.getByRole('checkbox', { name: 'TEST-2 확정 선택' }));
    await user.click(screen.getByRole('button', { name: '선택 제안 확정' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^확정$/ }));
    expect(await screen.findByText('2건 중 1건 확정 완료 / 1건 확인 필요')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'TEST-1 확정 선택' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'TEST-2 확정 선택' })).toBeDisabled();
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it('does not silently choose draft replacement and requires acknowledgement', async () => {
    const user = userEvent.setup();
    const value = readyRow('3');
    value.existingDrafts = [
      {
        productionPlanId: 10,
        versionNo: 3,
        planNo: 'DRAFT-10',
        planDate: value.plans[0]!.date,
        plannedQty: 100,
        uomId: 1,
        plannedLineId: null,
        plannedLineCode: null,
        plannedLineName: null,
        statusCode: 'PLANNED',
        createdBy: null,
        createdByName: null,
        createdAt: '2026-11-18T00:00:00Z',
        updatedAt: '2026-11-18T00:00:00Z',
        createdAutomatically: false,
      },
    ];
    const choose = vi.fn(async (row: ReviewProposal, action: 'CONTINUE' | 'REPLACE') => ({
      ...row,
      existingDraftAction: action,
    }));
    renderWithProviders(
      <ProposalReview
        manualLayout={false}
        initialProposals={[value]}
        resourceSource={previewResourceSource}
        onClose={() => {}}
        onChooseDrafts={choose}
      />,
      { session: null },
    );
    expect(screen.getByRole('checkbox', { name: 'TEST-3 확정 선택' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '작성중 계획 1건 확인' }));
    await user.click(screen.getByRole('button', { name: '새 계획으로 대체' }));
    expect(choose).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: '작성중 계획 대체' });
    expect(dialog).toHaveTextContent('삭제하고 새 계획으로 대체');
    await user.click(within(dialog).getByRole('button', { name: '새 계획으로 검토' }));
    await waitFor(() =>
      expect(choose).toHaveBeenCalledWith(expect.objectContaining({ id: '3' }), 'REPLACE'),
    );
  });
  it('selecting CONTINUE again cannot discard edited plan values', async () => {
    const user = userEvent.setup();
    const value = readyRow('5');
    value.existingDraftAction = 'CONTINUE';
    value.changed = true;
    value.plans[0]!.quantity = '37';
    value.existingDrafts = [
      {
        productionPlanId: 10,
        versionNo: 3,
        planNo: 'DRAFT-10',
        planDate: value.plans[0]!.date,
        plannedQty: 100,
        uomId: 1,
        plannedLineId: null,
        plannedLineCode: null,
        plannedLineName: null,
        statusCode: 'PLANNED',
        createdBy: null,
        createdByName: null,
        createdAt: '2026-11-18T00:00:00Z',
        updatedAt: '2026-11-18T00:00:00Z',
        createdAutomatically: false,
      },
    ];
    const choose = vi.fn();
    renderWithProviders(
      <ProposalReview
        initialProposals={[value]}
        resourceSource={previewResourceSource}
        onClose={() => {}}
        onChooseDrafts={choose}
      />,
      { session: null },
    );
    await user.click(screen.getByRole('button', { name: '작성중 계획 1건 확인' }));
    const button = screen.getByRole('button', { name: '작성중 계획 이어서' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(choose).not.toHaveBeenCalled();
  });
  it('AUTO_WORK_ORDER cannot be selected for human confirmation', () => {
    const value = { ...readyRow('4'), serverKind: 'AUTO_WORK_ORDER' as const, plans: [] };
    renderWithProviders(
      <ProposalReview
        initialProposals={[value]}
        resourceSource={previewResourceSource}
        onClose={() => {}}
      />,
      { session: null },
    );
    expect(screen.getByRole('checkbox', { name: 'TEST-4 확정 선택' })).toBeDisabled();
    expect(screen.getAllByText('자동 처리').length).toBeGreaterThan(0);
  });
});
