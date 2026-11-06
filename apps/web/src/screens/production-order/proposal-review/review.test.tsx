import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/api-harness';
import { ProposalReview } from './review';
import { previewProposals, previewResourceSource } from './preview';
import { proposalErrors } from './model';

const renderReview = (extra: Partial<React.ComponentProps<typeof ProposalReview>> = {}) =>
  renderWithProviders(
    <ProposalReview
      initialProposals={previewProposals}
      resourceSource={previewResourceSource}
      onClose={() => {}}
      {...extra}
    />,
    { session: null },
  );
const firstNo = previewProposals[0]!.number;
const secondNo = previewProposals[1]!.number;

describe('제안 검토 화면', () => {
  it('상세 선택과 확정 선택을 구분하고 처음에는 체크하지 않는다', async () => {
    const user = userEvent.setup();
    renderReview();
    expect(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` })).not.toBeChecked();
    await user.click(screen.getByRole('row', { name: `${secondNo} 상세` }));
    expect(screen.getByRole('region', { name: `${secondNo} 제안 상세` })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: `${secondNo} 확정 선택` })).not.toBeChecked();
    const list = screen.getByRole('region', { name: 'ERP W/O 제안 목록' });
    const detail = screen.getByRole('region', { name: `${secondNo} 제안 상세` });
    expect(list.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('수정하면 확정 선택이 해제되고 표와 주간 보기를 바꿔도 보완값을 유지한다', async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` }));
    const input = screen.getByRole('textbox', { name: '생산량' });
    await user.clear(input);
    await user.type(input, '80');
    expect(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` })).not.toBeChecked();
    await user.click(screen.getByRole('tab', { name: '주간 편성 보기' }));
    expect(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: '다음 주' }));
    expect(screen.getByText('현재 주 외 계획 3건')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'ERP W/O별 표' }));
    expect(screen.getByRole('textbox', { name: '생산량' })).toHaveValue('80');
    await user.click(screen.getByRole('tab', { name: '공정별 작업지시' }));
    expect(screen.getAllByText(/변경 전 제안/).length).toBeGreaterThan(0);
  });
  it('4M 필수 누락을 표시하고 같은 화면의 선택 팝업에서 보완한다', async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByRole('row', { name: `${secondNo} 상세` }));
    expect(screen.getByText('성형: 생산 라인 미지정')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '4M 배정' }));
    await user.click(screen.getAllByRole('button', { name: '생산 라인' })[0]!);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByText('생산 라인 A'));
    await user.click(within(dialog).getByRole('button', { name: '선택' }));
    expect(screen.queryByText('성형: 생산 라인 미지정')).not.toBeInTheDocument();
    expect(screen.getAllByText('작업자')).toHaveLength(2);
    expect(screen.queryByText('작업자을 지정하세요')).not.toBeInTheDocument();
  });
  it('연결하지 않은 미리보기는 선택해도 실제 확정을 실행하지 않는다', async () => {
    const user = userEvent.setup();
    renderReview({ preview: true });
    await user.click(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` }));
    expect(screen.getByRole('button', { name: '선택 제안 확정 (1)' })).toBeDisabled();
  });
  it('닫기 전에 미확정 보완값 폐기를 확인한다', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    renderReview({ onClose: close });
    await user.click(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` }));
    await user.click(screen.getByRole('button', { name: '제안 닫기' }));
    expect(close).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제안 닫기' }));
    expect(close).toHaveBeenCalledOnce();
  });
  it('기존 확정 계획은 수정하거나 확정 대상으로 선택하지 않는다', () => {
    const rows = structuredClone(previewProposals);
    rows[0]!.plans[0]!.source = '기존 확정 계획';
    renderReview({ initialProposals: rows });
    expect(screen.getByRole('textbox', { name: '생산량' })).toBeDisabled();
    expect(proposalErrors(rows[0]!)).toContain('확정할 제안이 없습니다');
  });
  it('Routing 후보 선택 시 공정 목록을 갱신하고 확정 선택을 해제한다', async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` }));
    await user.click(screen.getByRole('button', { name: 'Routing' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByText('대체 공정 (Rev 2)'));
    await user.click(within(dialog).getByRole('button', { name: '선택' }));
    expect(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` })).not.toBeChecked();
    await user.click(screen.getByRole('tab', { name: '공정별 작업지시' }));
    expect(screen.getByText('PR-01')).toBeInTheDocument();
    expect(screen.queryByText('PR-02')).not.toBeInTheDocument();
  });
  it('페이지를 넘겨도 다른 페이지 확정 선택을 유지한다', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 21 }, (_, index) => ({
      ...structuredClone(previewProposals[0]!),
      id: String(index + 1),
      number: `PD261106${String(index + 1).padStart(6, '0')}`,
    }));
    renderReview({ initialProposals: rows });
    await user.click(screen.getByRole('checkbox', { name: `${rows[0]!.number} 확정 선택` }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('checkbox', { name: `${rows[20]!.number} 확정 선택` }));
    expect(screen.getByRole('button', { name: '선택 제안 확정 (2)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByRole('checkbox', { name: `${rows[0]!.number} 확정 선택` })).toBeChecked();
  });
  it('초과 수량과 잘못된 수량을 확정 가능으로 표시하지 않는다', () => {
    const row = structuredClone(previewProposals[0]!);
    row.plans[0]!.quantity = '101';
    expect(proposalErrors(row)).toContain('제안 수량이 미확정 잔량을 초과합니다');
    row.plans[0]!.quantity = 'NaN';
    expect(proposalErrors(row)).toContain('생산량은 0보다 커야 합니다');
  });
});
