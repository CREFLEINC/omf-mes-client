import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { toExternalCodeDrafts } from './external-code-draft';
import { ExternalCodePane } from './external-code-pane';
import { externalCodeFixtures } from './fixtures';
import type { LookupEntry } from './types';

const partnerEntries: LookupEntry[] = [
  { value: '6001', label: 'SYN-PARTNER-01 · 합성 거래처 A', isActive: true },
  { value: '6002', label: 'SYN-PARTNER-02 · 합성 거래처 B', isActive: false },
];

const renderPane = (overrides: Partial<Parameters<typeof ExternalCodePane>[0]> = {}) => {
  const handlers = {
    onAdd: vi.fn<() => void>(),
    onEdit: vi.fn<(draftId: string) => void>(),
    onRemove: vi.fn<(draftId: string) => void>(),
    onSave: vi.fn<() => void>(),
    onCancel: vi.fn<() => void>(),
  };

  render(
    <ExternalCodePane
      drafts={toExternalCodeDrafts(externalCodeFixtures)}
      isLoading={false}
      partnerEntries={partnerEntries}
      isPartnerLoading={false}
      optionsNotice={null}
      loadError={null}
      banner={null}
      isDirty={false}
      isSaving={false}
      {...handlers}
      {...overrides}
    />,
  );

  return { ...handlers, user: userEvent.setup() };
};

describe('ExternalCodePane — 표시', () => {
  it('구획에 접근 이름이 있다', () => {
    renderPane();

    expect(screen.getByRole('region', { name: '외부 코드' })).toBeInTheDocument();
  });

  it('외부 시스템과 외부 품목코드를 그대로 낸다', () => {
    renderPane();

    expect(screen.getByText('SYN-EXT-01')).toBeInTheDocument();
    expect(screen.getByText('SYN-EXT-ITEM-01')).toBeInTheDocument();
  });

  it('거래처를 번호가 아니라 이름으로 낸다', () => {
    renderPane();

    expect(screen.getByText('SYN-PARTNER-01 · 합성 거래처 A')).toBeInTheDocument();
    expect(screen.queryByText('6001')).not.toBeInTheDocument();
  });

  /* 계약이 「비우면 (전체)」로 정했다(A-7) — 빈 칸으로 두면 화면이 빠뜨린 것으로 읽힌다. */
  it('거래처를 비운 줄은 「(전체)」다', () => {
    renderPane();

    expect(screen.getByText('(전체)')).toBeInTheDocument();
  });

  /* 「비어 있다」와 「아직 못 받았다」는 다른 사실이다. */
  it('거래처 목록을 받는 중이어도 비운 줄은 「(전체)」다', () => {
    renderPane({ partnerEntries: [], isPartnerLoading: true });

    expect(screen.getByText('(전체)')).toBeInTheDocument();
    expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
    expect(screen.queryByText('알 수 없음')).not.toBeInTheDocument();
  });

  /* 계약의 이 표에 기간 컬럼 자체가 없다 — 셋을 한 부품으로 묶지 않은 이유다. */
  it('유효기간 열이 없다', () => {
    renderPane();

    const header = screen.getAllByRole('row')[0]!;
    expect(
      within(header)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['외부 시스템', '거래처', '외부 품목코드', '편집']);
  });

  it('등록된 줄이 없으면 빈 상태를 낸다', () => {
    renderPane({ drafts: [] });

    expect(screen.getByText('등록된 외부 코드가 없습니다')).toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 상태를 낸다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '외부 코드를 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

/**
 * M29 — **이 화면 최대의 중복 함정.**
 * `uq_item_external_code`가 `COALESCE(partner_id,0)`으로 접는다(A-7).
 */
describe('ExternalCodePane — 이미 겹친 줄 (M29)', () => {
  const [, second] = toExternalCodeDrafts(externalCodeFixtures);
  /* 거래처를 비운 두 줄 — 외부 품목코드가 달라도 서버에게는 같은 짝이다. */
  const duplicated = [
    { ...second!, draftId: 'saved:5502' },
    { ...second!, draftId: 'saved:5503', externalItemCode: 'SYN-EXT-ITEM-09' },
  ];

  it('거래처를 비운 겹친 줄에 안내가 난다', () => {
    renderPane({ drafts: duplicated });

    expect(screen.getByText(/거래처를 비운 줄끼리도 같은 줄로 보므로/)).toBeInTheDocument();
  });

  it('겹친 줄이 있으면 저장이 사유가 붙은 비활성이다', () => {
    renderPane({ drafts: duplicated, isDirty: true });

    const save = screen.getByRole('button', { name: '저장' });
    expect(save).toBeDisabled();

    const noteId = save.getAttribute('aria-describedby');
    expect(noteId).not.toBeNull();
    expect(screen.getByText(/겹친 줄을 고치거나 지운 뒤 저장하세요/)).toHaveAttribute('id', noteId);
  });

  it('겹친 줄이 있으면 저장을 눌러도 바깥에 알리지 않는다', async () => {
    const { onSave, user } = renderPane({ drafts: duplicated, isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).not.toHaveBeenCalled();
  });

  /* 반대 방향 — 거래처가 다르면 같은 외부 시스템이어도 겹치지 않는다. */
  it('거래처가 다른 두 줄에는 안내도 사유도 붙지 않는다', () => {
    renderPane({
      drafts: [
        { ...second!, draftId: 'a', partnerId: '6001' },
        { ...second!, draftId: 'b', partnerId: '6002' },
      ],
      isDirty: true,
    });

    expect(screen.queryByText(/겹친 줄/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });
});

describe('ExternalCodePane — 계약에 없는 조작을 두지 않는다', () => {
  it('순서 이동과 쪽 이동이 없다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: /위로|아래로|순서/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument();
  });
});

describe('ExternalCodePane — 액션', () => {
  it('추가를 바깥에 알린다', async () => {
    const { onAdd, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '외부 코드 추가' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('행 액션의 이름이 줄마다 다르다', () => {
    renderPane();

    const labels = screen
      .getAllByRole('button', { name: /외부 코드 수정$/ })
      .map((button) => button.getAttribute('aria-label'));

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('수정과 삭제를 초안 키로 알린다', async () => {
    const { onEdit, onRemove, user } = renderPane();

    await user.click(screen.getAllByRole('button', { name: /외부 코드 수정$/ })[0]!);
    expect(onEdit).toHaveBeenCalledWith('saved:5501');

    await user.click(screen.getAllByRole('button', { name: /외부 코드 삭제$/ })[0]!);
    expect(onRemove).toHaveBeenCalledWith('saved:5501');
  });

  it('고친 것이 없으면 저장과 취소가 닫혀 있다', () => {
    renderPane({ isDirty: false });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('저장 중에는 저장을 두 번 누를 수 없다', () => {
    renderPane({ isDirty: true, isSaving: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('저장과 취소를 바깥에 알린다', async () => {
    const { onSave, onCancel, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('ExternalCodePane — 슬롯', () => {
  it('저장 실패 배너와 선택 목록 안내를 그대로 낸다', () => {
    renderPane({ banner: <p>저장 실패 슬롯</p>, optionsNotice: <p>선택 목록 슬롯</p> });

    expect(screen.getByText('저장 실패 슬롯')).toBeInTheDocument();
    expect(screen.getByText('선택 목록 슬롯')).toBeInTheDocument();
  });

  it('조회에 실패하면 표 대신 실패 슬롯을 낸다', () => {
    renderPane({ loadError: <p>조회 실패 슬롯</p> });

    expect(screen.getByText('조회 실패 슬롯')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
