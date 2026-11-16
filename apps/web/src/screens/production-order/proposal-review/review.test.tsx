import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/api-harness';
import { ProposalReview } from './review';
import { previewProposals, previewResourceSource } from './preview';
import { applyReceiptStorage, proposalErrors } from './model';

const renderReview = (extra: Partial<React.ComponentProps<typeof ProposalReview>> = {}) =>
  renderWithProviders(
    <ProposalReview
      manualLayout={false}
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
  it('기존 편성 구성에서 계획 확정 없이 4M과 최종 검토를 확인한다', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderReview({ manualLayout: true, onConfirm });
    expect(screen.getByRole('tablist', { name: '자동 전개 검토 단계' })).toBeVisible();
    expect(screen.getByRole('button', { name: '주간 편성' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '계획 목록' }));
    await user.click(screen.getByRole('tab', { name: '4M 배정' }));
    expect(screen.getByRole('region', { name: '작업지시 목록' })).toBeVisible();
    expect(screen.getByRole('region', { name: '4M 배정 입력' })).toBeVisible();
    await user.click(screen.getByRole('tab', { name: '확정 검토' }));
    expect(screen.queryByRole('button', { name: '배정 저장' })).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  beforeEach(() => localStorage.removeItem('omf-mes:proposal-review:layout'));
  it('생산품 입고 창고는 정보로 표시하고 내부 위치 선택은 숨긴다', async () => {
    const user = userEvent.setup();
    renderReview();
    expect(screen.getByRole('region', { name: '생산품 입고 창고' })).toHaveTextContent(
      '생산품 입고 창고 A (WH-A)',
    );
    await user.click(screen.getByRole('tab', { name: '4M 배정' }));
    expect(screen.queryByRole('button', { name: '생산품 입고 창고' })).toBeNull();
    expect(screen.queryByRole('button', { name: '완제품 위치' })).toBeNull();
    expect(screen.queryByText('입고 위치', { exact: true })).toBeNull();
  });
  it('분할 창고의 내부 위치는 접힌 상세에서만 확인한다', async () => {
    const user = userEvent.setup();
    const row = structuredClone(previewProposals[0]!);
    row.erpStorage = {
      ...row.erpStorage!,
      locationRole: 'PUTAWAY_STAGING',
      location: { id: 62, code: 'SYS-STAGING', name: '적치 대기', parentId: 81 },
    };
    renderReview({ initialProposals: [row] });
    const details = screen.getByText('입고 위치', { exact: true }).closest('details');
    expect(details).not.toHaveAttribute('open');
    await user.click(screen.getByText('입고 위치', { exact: true }));
    expect(details).toHaveAttribute('open');
    expect(details).toHaveTextContent('적치 대기');
  });
  it.each([
    'FG_WAREHOUSE_UNMAPPED',
    'FG_WAREHOUSE_INACTIVE',
    'FG_WAREHOUSE_OTHER_PLANT',
    'FG_WAREHOUSE_NOT_ALLOWED',
  ])('창고 연결 차단 %s는 위치 선택으로 해소하지 않는다', async (reasonCode) => {
    const user = userEvent.setup();
    const row = structuredClone(previewProposals[0]!);
    row.erpStorage = { ...row.erpStorage!, warehouse: null, location: null, reasonCode };
    renderReview({ initialProposals: [row] });
    expect(proposalErrors(applyReceiptStorage(row)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('tab', { name: '4M 배정' }));
    expect(screen.queryByRole('button', { name: '입고 위치' })).toBeNull();
    expect(screen.queryByRole('button', { name: '생산품 입고 창고' })).toBeNull();
  });
  it('서버가 정한 내부 위치를 공정별 확정값에 자동 반영하고 기존 확정 계획은 유지한다', () => {
    const row = structuredClone(previewProposals[0]!);
    row.plans.forEach((plan) =>
      plan.operations.forEach((op) => {
        op.resources.defaultFgLocationId = null;
      }),
    );
    const normalized = applyReceiptStorage(row);
    normalized.plans.forEach((plan) =>
      plan.operations.forEach((op) => {
        expect(op.resources.defaultFgLocationId).toEqual(row.erpStorage!.location);
        expect(op.defaultFgLocationSource).toBe('ERP_STORAGE_LOCATION');
      }),
    );
    expect(row.plans[0]!.operations[0]!.resources.defaultFgLocationId).toBeNull();
    const existing = structuredClone(previewProposals[3]!);
    existing.plans[0]!.operations[0]!.resources.defaultFgLocationId = {
      id: 91,
      code: 'OLD',
      name: '기존 위치',
    };
    expect(applyReceiptStorage(existing).plans).toEqual(existing.plans);
  });
  it('같은 Routing을 쓰는 두 계획의 공정 선택을 구분한다', async () => {
    const user = userEvent.setup();
    const rows = structuredClone(previewProposals);
    const first = rows[0]!.plans[0]!;
    first.operations = [first.operations[0]!];
    const second = structuredClone(first);
    second.key = 'second-plan';
    second.date = '2026-11-20';
    rows[0]!.plans = [first, second];
    renderReview({ initialProposals: rows, manualLayout: true });
    await user.click(screen.getByRole('tab', { name: '4M 배정' }));
    const list = screen.getByRole('region', { name: '작업지시 목록' });
    await user.click(within(list).getAllByRole('row').at(-1)!);
    expect(screen.getByRole('region', { name: '4M 배정 입력' })).toHaveTextContent('2026-11-20');
  });
  it('상태 열은 ERP W/O 바로 다음이며 상세는 세 탭으로 확인한다', async () => {
    const user = userEvent.setup();
    renderReview();
    const list = screen.getByRole('region', { name: 'ERP W/O 제안 목록' });
    const headers = within(list)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers.slice(0, 3)).toEqual(['선택', 'ERP W/O', '확정 검토']);
    expect(screen.getByRole('tablist', { name: '제안 상세 보기' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '생산계획 정보' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '공정별 작업지시' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^공정별 작업지시/ }));
    expect(screen.getByRole('region', { name: '공정별 작업지시' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '4M 배정' }));
    expect(screen.getByRole('region', { name: '4M 배정' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '작업자' })).not.toBeInTheDocument();
  });
  it('좌우 배치 목록은 ERP W/O와 확정 검토만 표시한다', async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByRole('button', { name: '좌우 배치' }));
    expect(
      within(screen.getByRole('region', { name: 'ERP W/O 제안 목록' }))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['선택', 'ERP W/O', '확정 검토']);
    await user.click(screen.getByRole('button', { name: '상하 배치' }));
    expect(
      within(screen.getByRole('region', { name: 'ERP W/O 제안 목록' }))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent)
        .slice(0, 3),
    ).toEqual(['선택', 'ERP W/O', '확정 검토']);
  });
  it('BOM과 Routing 정보 옆 아이콘에서 상세 팝업을 확인한다', async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByRole('button', { name: 'BOM 상세 보기' }));
    const bom = screen.getByRole('dialog');
    expect(within(bom).getByText('MAT-01')).toBeInTheDocument();
    expect(within(bom).getByText('구성 자재 A')).toBeInTheDocument();
    await user.click(within(bom).getAllByRole('button', { name: '닫기' }).at(-1)!);
    await user.click(screen.getByRole('button', { name: 'Routing 상세 보기' }));
    expect(within(screen.getByRole('dialog')).getByText('PR-01')).toBeInTheDocument();
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
    await user.click(screen.getByRole('tab', { name: '4M 배정' }));
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
    await user.click(screen.getByRole('tab', { name: '4M 배정' }));
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
    await user.click(screen.getByRole('tab', { name: '4M 배정' }));
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
    await user.click(screen.getByRole('tab', { name: /^공정별 작업지시/ }));
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
  it('공정 재검증이 필요한 제안은 확정할 수 없다', () => {
    const row = structuredClone(previewProposals[0]!);
    row.plans[0]!.recalculationRequired = true;
    expect(proposalErrors(row)).toContain('공정 재검증 필요');
  });
  it('초과 수량과 잘못된 수량을 확정 가능으로 표시하지 않는다', () => {
    const row = structuredClone(previewProposals[0]!);
    row.plans[0]!.quantity = '101';
    expect(proposalErrors(row)).toContain('제안 수량이 미확정 잔량을 초과합니다');
    row.plans[0]!.quantity = 'NaN';
    expect(proposalErrors(row)).toContain('생산량은 0보다 커야 합니다');
  });
});
