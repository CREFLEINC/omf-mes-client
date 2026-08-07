import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uomConversionFixtures } from './fixtures';
import type { LookupEntry } from './types';
import { toUomConversionDrafts } from './uom-conversion-draft';
import { UomConversionPane } from './uom-conversion-pane';

const uomEntries: LookupEntry[] = [
  { value: '7001', label: 'SYN-UOM-01 · 합성 단위 A', isActive: true },
  { value: '7002', label: 'SYN-UOM-02 · 합성 단위 B', isActive: false },
  { value: '7003', label: 'SYN-UOM-03 · 합성 단위 C', isActive: true },
];

const renderPane = (overrides: Partial<Parameters<typeof UomConversionPane>[0]> = {}) => {
  const handlers = {
    onAdd: vi.fn<() => void>(),
    onEdit: vi.fn<(draftId: string) => void>(),
    onRemove: vi.fn<(draftId: string) => void>(),
    onSave: vi.fn<() => void>(),
    onCancel: vi.fn<() => void>(),
  };

  render(
    <UomConversionPane
      drafts={toUomConversionDrafts(uomConversionFixtures)}
      isLoading={false}
      uomEntries={uomEntries}
      isUomLoading={false}
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

describe('UomConversionPane — 표시', () => {
  it('구획에 접근 이름이 있다', () => {
    renderPane();

    expect(screen.getByRole('region', { name: '단위 환산' })).toBeInTheDocument();
  });

  it('단위를 번호가 아니라 이름으로 낸다', () => {
    renderPane();

    expect(screen.getAllByText('SYN-UOM-01 · 합성 단위 A').length).toBeGreaterThan(0);
    expect(screen.queryByText('7001')).not.toBeInTheDocument();
  });

  /*
   * **환산 비율을 표기만 바꾸지 않는다.** 자릿수를 맞추거나 반올림하면
   * 사용자가 고치지 않은 줄이 저장할 때 다른 값이 된 것처럼 보인다.
   */
  it('환산 비율을 자릿수 그대로 낸다', () => {
    renderPane();

    expect(screen.getByText('2.5')).toBeInTheDocument();
    expect(screen.getByText('0.00012345')).toBeInTheDocument();
  });

  it('유효기간을 한 칸에 내고, 비운 종료는 미지정 표기다', () => {
    renderPane();

    expect(screen.getByText('2026-01-01 ~ 2026-12-31')).toBeInTheDocument();
    expect(screen.getByText('2026-02-01 ~ —')).toBeInTheDocument();
  });

  it('등록된 줄이 없으면 빈 상태를 낸다', () => {
    renderPane({ drafts: [] });

    expect(screen.getByText('등록된 단위 환산이 없습니다')).toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 상태를 낸다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '단위 환산을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('단위 목록을 받는 중에는 「알 수 없음」을 내지 않는다', () => {
    renderPane({ uomEntries: [], isUomLoading: true });

    expect(screen.queryByText('알 수 없음')).not.toBeInTheDocument();
  });
});

/**
 * 사업부 매핑과 갈리는 자리 — **이 자원에는 유일 제약이 있다.**
 *
 * 서버가 준 목록에 이미 겹친 줄이 있을 수 있으므로(옛 자료) 저장을 눌러야 알게 하지 않고
 * 미리 밝히고 막는다. 배치 규범 4에 따라 **사유를 붙인** 비활성이다.
 */
describe('UomConversionPane — 이미 겹친 줄 (M29)', () => {
  const duplicated = (() => {
    const [first] = toUomConversionDrafts(uomConversionFixtures);

    return [
      { ...first!, draftId: 'saved:4001' },
      /* 환산 비율과 유효 종료만 다른 줄 — 유일 제약의 컬럼이 아니라 서버에게는 같은 짝이다. */
      { ...first!, draftId: 'saved:4002', conversionRate: '9', effectiveTo: '' },
    ];
  })();

  it('겹친 줄이 있으면 표 위에 안내가 난다', () => {
    renderPane({ drafts: duplicated });

    expect(
      screen.getByText('변환 전·변환 후·유효 시작이 같은 줄이 있습니다. 겹친 줄을 정리하세요.'),
    ).toBeInTheDocument();
  });

  it('겹친 줄이 있으면 저장이 사유가 붙은 비활성이다', () => {
    renderPane({ drafts: duplicated, isDirty: true });

    const save = screen.getByRole('button', { name: '저장' });
    expect(save).toBeDisabled();

    const noteId = save.getAttribute('aria-describedby');
    expect(noteId).not.toBeNull();
    expect(screen.getByText(/겹친 줄을 고치거나 지운 뒤 저장하세요/)).toHaveAttribute('id', noteId);
  });

  /* 사유가 붙은 비활성은 저장을 실제로 부르지 않아야 한다 — 눌러도 아무 일이 없다. */
  it('겹친 줄이 있으면 저장을 눌러도 바깥에 알리지 않는다', async () => {
    const { onSave, user } = renderPane({ drafts: duplicated, isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).not.toHaveBeenCalled();
  });

  /*
   * 반대 방향 — **겹치지 않으면 사유를 붙이지 않는다.**
   * 모든 비활성에 문구를 붙이면 정작 읽어야 할 사유가 묻힌다(배치 규범 4).
   */
  it('겹친 줄이 없으면 저장에 사유가 붙지 않는다', () => {
    renderPane({ isDirty: true });

    const save = screen.getByRole('button', { name: '저장' });
    expect(save).toBeEnabled();
    expect(save).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText(/겹친 줄/)).not.toBeInTheDocument();
  });
});

describe('UomConversionPane — 계약에 없는 조작을 두지 않는다', () => {
  it('순서 이동과 쪽 이동이 없다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: /위로|아래로|순서/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument();
  });
});

describe('UomConversionPane — 액션', () => {
  it('추가를 바깥에 알린다', async () => {
    const { onAdd, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '환산 추가' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  /* 「수정」이 둘이면 어느 줄을 고치는 것인지 알 수 없다. */
  it('행 액션의 이름이 줄마다 다르다', () => {
    renderPane();

    const labels = screen
      .getAllByRole('button', { name: /환산 수정$/ })
      .map((button) => button.getAttribute('aria-label'));

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('수정과 삭제를 초안 키로 알린다', async () => {
    const { onEdit, onRemove, user } = renderPane();

    const rows = screen.getAllByRole('button', { name: /환산 수정$/ });
    await user.click(rows[0]!);
    expect(onEdit).toHaveBeenCalledWith('saved:4001');

    await user.click(screen.getAllByRole('button', { name: /환산 삭제$/ })[0]!);
    expect(onRemove).toHaveBeenCalledWith('saved:4001');
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

describe('UomConversionPane — 슬롯', () => {
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

describe('UomConversionPane — 표 구조', () => {
  it('머리 줄에 다섯 열이 있다', () => {
    renderPane();

    const header = screen.getAllByRole('row')[0]!;
    expect(
      within(header)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['변환 전 단위', '변환 후 단위', '환산 비율', '유효기간', '편집']);
  });
});
