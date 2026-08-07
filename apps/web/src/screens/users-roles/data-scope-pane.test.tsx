import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DataScopeDraft } from './data-scope-draft';
import { DataScopePane, type DataScopePaneProps } from './data-scope-pane';
import type { LookupEntry } from './types';

const BUSINESS_UNITS: LookupEntry[] = [
  { value: '2001', label: 'SYN-BU-01 · 합성 사업부 A', isActive: true },
  { value: '2002', label: 'SYN-BU-02 · 합성 사업부 B', isActive: true },
];

const PLANTS: LookupEntry[] = [
  { value: '4001', label: 'SYN-PLT-01 · 합성 공장 A', isActive: true },
];

const DRAFTS: DataScopeDraft[] = [
  { draftId: 'saved:9001', businessUnitId: '2001', plantId: '4001' },
  { draftId: 'saved:9002', businessUnitId: '2002', plantId: '' },
];

const renderPane = (overrides: Partial<DataScopePaneProps> = {}) => {
  const props: DataScopePaneProps = {
    drafts: DRAFTS,
    isLoading: false,
    businessUnitEntries: BUSINESS_UNITS,
    plantEntries: PLANTS,
    optionsNotice: null,
    loadError: null,
    banner: null,
    isDirty: false,
    isSaving: false,
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };

  render(<DataScopePane {...props} />);

  return { props, user: userEvent.setup() };
};

const rows = (): HTMLElement[] => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('DataScopePane', () => {
  it('줄마다 사업부와 공장이 보인다', () => {
    renderPane();

    expect(rows()).toHaveLength(2);
    expect(within(rows()[0] as HTMLElement).getByText('SYN-BU-01 · 합성 사업부 A')).toBeInTheDocument();
    expect(within(rows()[0] as HTMLElement).getByText('SYN-PLT-01 · 합성 공장 A')).toBeInTheDocument();
  });

  /** 빈 축은 「고르지 않음」이 아니라 그 축 전체를 뜻하는 **고른 값**이다. */
  it('빈 축은 「(전체)」로 보인다', () => {
    renderPane();

    expect(within(rows()[1] as HTMLElement).getByText('(전체)')).toBeInTheDocument();
  });

  /** 내부 식별자는 사용자가 쓸 수 없는 값이라 그대로 보이면 자료로 읽힌다. */
  it('선택 목록에 없는 번호는 번호가 아니라 「알 수 없음」으로 보인다', () => {
    renderPane({ drafts: [{ draftId: 'a', businessUnitId: '9999', plantId: '' }] });

    expect(within(rows()[0] as HTMLElement).getByText('알 수 없음')).toBeInTheDocument();
    expect(screen.queryByText('9999')).not.toBeInTheDocument();
  });

  it('줄 수정·삭제 버튼의 이름이 어느 줄인지 밝힌다', async () => {
    const { props, user } = renderPane();

    await user.click(
      screen.getByRole('button', { name: 'SYN-BU-02 · 합성 사업부 B · (전체) 범위 수정' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'SYN-BU-02 · 합성 사업부 B · (전체) 범위 삭제' }),
    );

    expect(props.onEdit).toHaveBeenCalledWith('saved:9002');
    expect(props.onRemove).toHaveBeenCalledWith('saved:9002');
  });

  it('범위 추가를 누르면 창을 여는 요청이 올라간다', async () => {
    const { props, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '범위 추가' }));

    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });

  it('줄이 없으면 빈 상태가 나오고 범위 추가는 그대로 있다', () => {
    renderPane({ drafts: [] });

    expect(screen.getByText('지정된 접근범위가 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '범위 추가' })).toBeEnabled();
  });

  it('불러오는 중에는 표 대신 진행 표시가 나온다', () => {
    renderPane({ isLoading: true });

    expect(
      screen.getByRole('status', { name: '데이터 접근범위를 불러오는 중' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /** 실패를 빈 표로 내면 「범위가 없다」로 읽혀 그 상태로 저장하면 전체 회수가 나간다. */
  it('조회에 실패하면 표를 그리지 않는다', () => {
    renderPane({ loadError: <p>목록을 불러오지 못했습니다</p> });

    expect(screen.getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('고친 것이 없으면 저장이 비활성이고 사유가 보인다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByText(/저장은 고친 내용이 있을 때/)).toBeInTheDocument();
  });

  it('고친 것이 있으면 저장과 취소를 누를 수 있다', async () => {
    const { props, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('저장 실패 배너와 선택 목록 안내를 받은 자리에 낸다', () => {
    renderPane({ banner: <p>저장 실패</p>, optionsNotice: <p>선택 목록이 일부만</p> });

    expect(screen.getByText('저장 실패')).toBeInTheDocument();
    expect(screen.getByText('선택 목록이 일부만')).toBeInTheDocument();
  });
});
