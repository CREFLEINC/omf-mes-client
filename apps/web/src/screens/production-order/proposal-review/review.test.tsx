import { screen, within, waitFor } from '@testing-library/react';
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
  it('계획 중심 표와 통합 상세의 모든 정보를 탭 전환 없이 표시한다', () => {
    renderReview();
    const summary = screen.getByRole('region', { name: '제안 요약' });
    for (const label of ['제안 대상', '확정 가능', '검토 필요', '변경 없음'])
      expect(within(summary).getByText(label)).toBeInTheDocument();
    for (const label of ['계획일', '생산량', '생산 라인', '확정 검토'])
      expect(
        within(screen.getByRole('region', { name: 'ERP W/O 제안 목록' })).getByRole(
          'columnheader',
          { name: label },
        ),
      ).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: '제안 상세 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '생산계획 정보' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '공정별 작업지시 2건' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '4M 배정' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '확정 시 반영 사항' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: `${previewProposals[3]!.number} 확정 선택` }),
    ).toBeDisabled();
  });
  it('제안 보완은 누락·검증 항목만 표시하고 정상 값은 다시 입력하지 않는다', async () => {
    const user = userEvent.setup();
    renderReview();
    expect(screen.queryByRole('heading', { name: /^제안 보완/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '생산량' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('row', { name: `${secondNo} 상세` }));
    expect(
      within(screen.getByRole('region', { name: '제안 보완' })).getByRole('button', {
        name: '생산 라인',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Routing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '생산량' })).not.toBeInTheDocument();
  });
  it('상하·좌우 배치를 바꿔도 확정 선택과 상세를 유지한다', async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` }));
    await user.click(screen.getByRole('button', { name: '좌우 배치' }));
    expect(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` })).toBeChecked();
    expect(screen.getByRole('separator', { name: '제안 표와 상세 너비 조절' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '상하 배치' }));
    expect(screen.getByRole('region', { name: '생산계획 정보' })).toBeInTheDocument();
  });
  it('선택 사항은 숨기되 선택 확정에 넘기는 배정값은 보존한다', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(async (_rows: typeof previewProposals) => {});
    const rows = structuredClone(previewProposals);
    rows[0]!.plans[0]!.operations[0]!.resources.plannedEquipmentId = {
      id: 11,
      code: 'EQ-01',
      name: '설비 A',
    };
    renderReview({ initialProposals: rows, onConfirm: confirm });
    expect(screen.queryByRole('button', { name: '설비' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` }));
    await user.click(screen.getByRole('button', { name: '선택 제안 확정' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '확정' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(
      confirm.mock.calls[0]?.[0]?.[0]?.plans[0]?.operations[0]?.resources.plannedEquipmentId?.id,
    ).toBe(11);
  });
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
  it('4M 보완하면 확정 선택이 해제되고 보기 전환에도 값을 유지한다', async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` }));
    const operation = screen.getByRole('region', { name: '10 성형 배정' });
    await user.click(within(operation).getByRole('button', { name: '생산 라인' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByText('생산 라인 B'));
    await user.click(within(dialog).getByRole('button', { name: '선택' }));
    expect(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` })).not.toBeChecked();
    await user.click(screen.getByRole('tab', { name: '주간 편성 보기' }));
    await user.click(screen.getByRole('button', { name: '다음 주' }));
    expect(screen.getByText('현재 주 외 계획 4건')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'ERP W/O별 표' }));
    expect(screen.getAllByText('생산 라인 B (LINE-02)').length).toBeGreaterThan(0);
  });
  it('생산량·계획일·BOM은 검토 표시가 있어도 정보로만 표시한다', () => {
    const rows = structuredClone(previewProposals);
    rows[0]!.plans[0]!.reviewFields = ['quantity', 'date'];
    renderReview({ initialProposals: rows });
    expect(screen.queryByRole('textbox', { name: '생산량' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('계획일')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'BOM' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: '생산계획 정보' })).getByText('BOM-A (Rev 1)'),
    ).toBeInTheDocument();
  });
  it('4M 필수 누락을 표시하고 같은 화면의 선택 팝업에서 보완한다', async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByRole('row', { name: `${secondNo} 상세` }));
    expect(screen.getByText('성형: 생산 라인 미지정')).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('region', { name: '10 성형 배정' })).getByRole('button', {
        name: '생산 라인',
      }),
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByText('생산 라인 A'));
    await user.click(within(dialog).getByRole('button', { name: '선택' }));
    expect(screen.queryByText('성형: 생산 라인 미지정')).not.toBeInTheDocument();
    expect(screen.queryByText('작업자')).not.toBeInTheDocument();
    expect(screen.queryByText('작업자을 지정하세요')).not.toBeInTheDocument();
  });
  it('연결하지 않은 미리보기는 선택해도 실제 확정을 실행하지 않는다', async () => {
    const user = userEvent.setup();
    renderReview({ preview: true });
    await user.click(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` }));
    expect(screen.getByRole('button', { name: '선택 제안 확정' })).toBeDisabled();
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
    expect(screen.queryByRole('textbox', { name: '생산량' })).not.toBeInTheDocument();
    expect(proposalErrors(rows[0]!)).toContain('확정할 제안이 없습니다');
  });
  it('Routing 후보 선택 시 공정 목록을 갱신하고 확정 선택을 해제한다', async () => {
    const user = userEvent.setup();
    const rows = structuredClone(previewProposals);
    rows[0]!.plans[0]!.reviewFields = ['routing'];
    renderReview({ initialProposals: rows });
    await user.click(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` }));
    await user.click(screen.getByRole('button', { name: 'Routing' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByText('대체 공정 (Rev 2)'));
    await user.click(within(dialog).getByRole('button', { name: '선택' }));
    expect(screen.getByRole('checkbox', { name: `${firstNo} 확정 선택` })).not.toBeChecked();
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
    expect(screen.getByText('선택 2건 / 실제 확정 미연결')).toBeInTheDocument();
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
