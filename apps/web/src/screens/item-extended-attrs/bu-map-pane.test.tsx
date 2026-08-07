import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { toBuMapDrafts } from './bu-map-draft';
import { BuMapPane } from './bu-map-pane';
import { buMapFixtures } from './fixtures';
import type { LookupEntry } from './types';

const businessUnitEntries: LookupEntry[] = [
  { value: '5001', label: 'SYN-BU-01 · 합성 사업부 A', isActive: true },
  { value: '5002', label: 'SYN-BU-02 · 합성 사업부 B', isActive: true },
  /* 미사용 사업부도 이름으로 옮긴다 — 지난 자료를 읽을 수 있어야 한다. */
  { value: '5003', label: 'SYN-BU-03 · 합성 사업부 C', isActive: false },
];

/** 9001은 일부러 넣지 않는다 — 이름을 얻지 못한 행의 표기를 본다. */
const itemNameEntries: LookupEntry[] = [
  { value: '1002', label: 'SYN-ITEM-02 · 합성 품목 B', isActive: true },
];

const renderPane = (overrides: Partial<Parameters<typeof BuMapPane>[0]> = {}) => {
  const handlers = {
    onAdd: vi.fn<() => void>(),
    onEdit: vi.fn<(draftId: string) => void>(),
    onRemove: vi.fn<(draftId: string) => void>(),
    onSave: vi.fn<() => void>(),
    onCancel: vi.fn<() => void>(),
  };

  render(
    <BuMapPane
      drafts={toBuMapDrafts(buMapFixtures)}
      isLoading={false}
      businessUnitEntries={businessUnitEntries}
      isBusinessUnitLoading={false}
      itemNameEntries={itemNameEntries}
      isItemNameLoading={false}
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

const rowOf = (name: string): HTMLElement => screen.getByRole('row', { name: new RegExp(name) });

describe('BuMapPane — 표시', () => {
  it('구획에 접근 이름이 있다', () => {
    renderPane();

    expect(screen.getByRole('region', { name: '사업부 매핑' })).toBeInTheDocument();
  });

  /* 번호는 내부 식별자라 사용자가 쓸 수 없는 값이고, 보이면 자료로 읽힌다. */
  it('사업부와 대상 품목을 번호가 아니라 이름으로 낸다', () => {
    renderPane();

    const row = rowOf('SYN-ITEM-02');
    expect(within(row).getByText('SYN-BU-01 · 합성 사업부 A')).toBeInTheDocument();
    expect(within(row).getByText('SYN-ITEM-02 · 합성 품목 B')).toBeInTheDocument();
    expect(screen.queryByText('5001')).not.toBeInTheDocument();
    expect(screen.queryByText('1002')).not.toBeInTheDocument();
  });

  /* 이름을 얻지 못한 행만 「알 수 없음」이다 — 그 행에 번호를 대신 내지 않는다. */
  it('이름을 얻지 못한 대상 품목은 「알 수 없음」이고 번호를 내지 않는다', () => {
    renderPane();

    expect(screen.getByText('알 수 없음')).toBeInTheDocument();
    expect(screen.queryByText('9001')).not.toBeInTheDocument();
  });

  /* 값이 없는 것과 아직 못 받은 것은 다른 사실이다. */
  it('이름을 받는 중에는 「알 수 없음」을 내지 않는다', () => {
    renderPane({ itemNameEntries: [], isItemNameLoading: true });

    expect(screen.queryByText('알 수 없음')).not.toBeInTheDocument();
    expect(screen.getAllByText('불러오는 중…').length).toBeGreaterThan(0);
  });

  it('유효기간을 한 칸에 낸다', () => {
    renderPane();

    expect(screen.getByText('2026-01-01 ~ 2026-12-31')).toBeInTheDocument();
  });

  /* 비우면 무기한이다 — 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
  it('유효 종료를 비운 줄은 미지정 표기를 낸다', () => {
    renderPane();

    expect(screen.getByText('2026-02-01 ~ —')).toBeInTheDocument();
  });

  it('등록된 줄이 없으면 빈 상태를 낸다', () => {
    renderPane({ drafts: [] });

    expect(screen.getByText('등록된 사업부 매핑이 없습니다')).toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 상태를 낸다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '사업부 매핑을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('조회에 실패하면 표 대신 실패 슬롯을 낸다', () => {
    renderPane({ loadError: <p>조회 실패 슬롯</p> });

    expect(screen.getByText('조회 실패 슬롯')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

/**
 * 계약이 이 목록에 두지 않은 것 — **화면도 두지 않는다.**
 *
 * 순서 컬럼이 없으므로 화면이 순서를 만들면 새로고침에 사라지고(결정 6),
 * 쪽 나눔이 없으므로 쪽 이동을 두면 없는 쪽을 가리키게 된다.
 */
describe('BuMapPane — 계약에 없는 조작을 두지 않는다', () => {
  it('순서 이동 액션이 없다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: /위로|아래로|순서/ })).not.toBeInTheDocument();
  });

  it('쪽 이동이 없다', () => {
    renderPane();

    expect(screen.queryByRole('navigation', { name: '쪽 이동' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument();
  });

  /* 계약이 이 표에 유일 제약을 적지 않았다 — 없는 제약을 흉내 내면 서버가 허용하는 값을 막는다. */
  it('중복 경고를 내지 않는다 (M29)', () => {
    const [first] = toBuMapDrafts(buMapFixtures);
    renderPane({
      drafts: [
        { ...first!, draftId: 'saved:3001' },
        { ...first!, draftId: 'saved:3002' },
      ],
    });

    /*
     * 옆 두 자원의 중복 문구에는 「중복」이라는 낱말이 없다 —
     * `/중복/`으로만 재면 그 문구를 그대로 옮겨 와도 잡히지 않는다.
     */
    expect(screen.queryByText(/이미 있습니다|겹친 줄/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).not.toHaveAttribute('aria-describedby');
  });
});

describe('BuMapPane — 액션', () => {
  it('추가를 바깥에 알린다', async () => {
    const { onAdd, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '매핑 추가' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  /* 「수정」이 둘이면 어느 줄을 고치는 것인지 알 수 없다 — 행 이름을 액션 이름에 담는다. */
  it('행 액션의 이름이 줄마다 다르다', () => {
    renderPane();

    const editLabels = screen
      .getAllByRole('button', { name: /매핑 수정$/ })
      .map((button) => button.getAttribute('aria-label'));

    expect(new Set(editLabels).size).toBe(editLabels.length);
  });

  /*
   * **이 표에는 유일 제약이 없다**(결정 7) — 같은 품목을 가리키는 줄이 여럿 있는 것이 정상이다.
   * 이름을 대상 품목만으로 지으면 그때 「수정」이 여럿이 되어 어느 줄인지 알 수 없다.
   */
  it('같은 대상 품목을 가리키는 두 줄도 이름이 갈린다', () => {
    const [first] = toBuMapDrafts(buMapFixtures);
    renderPane({
      drafts: [
        { ...first!, draftId: 'saved:3001' },
        /* 대상 품목은 같고 사업부·유효 시작만 다른 줄 — 서버가 허용하는 조합이다. */
        {
          ...first!,
          draftId: 'saved:3009',
          fromBusinessUnitId: '5002',
          effectiveFrom: '2026-06-01',
        },
      ],
    });

    const editLabels = screen
      .getAllByRole('button', { name: /매핑 수정$/ })
      .map((button) => button.getAttribute('aria-label'));

    expect(editLabels).toHaveLength(2);
    expect(new Set(editLabels).size).toBe(2);
    /* 대상 품목만 담으면 두 이름이 같아진다 — 그 형태를 막는다. */
    for (const label of editLabels) {
      expect(label).toContain('SYN-ITEM-02 · 합성 품목 B');
      expect(label).not.toBe('SYN-ITEM-02 · 합성 품목 B 매핑 수정');
    }
  });

  it('수정과 삭제를 초안 키로 알린다', async () => {
    const { onEdit, onRemove, user } = renderPane();

    await user.click(screen.getAllByRole('button', { name: /매핑 수정$/ })[0]!);
    expect(onEdit).toHaveBeenCalledWith('saved:3001');

    await user.click(screen.getAllByRole('button', { name: /매핑 삭제$/ })[0]!);
    expect(onRemove).toHaveBeenCalledWith('saved:3001');
  });

  /* 되돌릴 것이 없는데 열려 있으면 사용자가 눌러 보고 아무 일도 일어나지 않는 것을 겪는다. */
  it('고친 것이 없으면 저장과 취소가 닫혀 있다', () => {
    renderPane({ isDirty: false });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('고친 것이 있으면 저장과 취소가 열린다', () => {
    renderPane({ isDirty: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeEnabled();
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

describe('BuMapPane — 슬롯', () => {
  it('저장 실패 배너와 선택 목록 안내를 그대로 낸다', () => {
    renderPane({ banner: <p>저장 실패 슬롯</p>, optionsNotice: <p>선택 목록 슬롯</p> });

    expect(screen.getByText('저장 실패 슬롯')).toBeInTheDocument();
    expect(screen.getByText('선택 목록 슬롯')).toBeInTheDocument();
  });
});
