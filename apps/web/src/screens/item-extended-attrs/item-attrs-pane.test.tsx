import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemFixtures } from './fixtures';
import { ItemAttrsPane } from './item-attrs-pane';
import { itemToAttrsFormValues } from './item-attrs-mappers';
import type { ItemAttrsFormValues } from './types';

const renderPane = (overrides: Partial<Parameters<typeof ItemAttrsPane>[0]> = {}) => {
  const onChange = vi.fn<(patch: Partial<ItemAttrsFormValues>) => void>();
  const onSave = vi.fn();
  const onCancel = vi.fn();

  render(
    <ItemAttrsPane
      values={itemToAttrsFormValues(itemFixtures[0]!)}
      uomOptions={[
        { value: '7001', label: '합성 단위 A' },
        { value: '7003', label: '합성 단위 C' },
      ]}
      onChange={onChange}
      fieldErrors={{}}
      banner={null}
      isDirty={false}
      isSaving={false}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onChange, onSave, onCancel, user: userEvent.setup() };
};

describe('ItemAttrsPane — 폼 구성', () => {
  it('구획에 접근 이름이 있다', () => {
    renderPane();

    expect(screen.getByRole('region', { name: '확장 속성' })).toBeInTheDocument();
  });

  /* 다국어 명칭은 이 화면에서 고치지 않는다(사용자 지시 2026-10-28) — 값은 저장 때 그대로 되돌려 싣는다. */
  it('확장 속성을 의미별 세 구획으로 묶는다', () => {
    renderPane();

    expect(screen.queryByRole('rowgroup', { name: '다국어 명칭' })).not.toBeInTheDocument();
    for (const name of ['LOT 기본값', '유효기한·선출', '검사·재고']) {
      expect(screen.getByRole('rowgroup', { name })).toBeInTheDocument();
    }
  });

  it('선출 정책과 LOT 보관 단위를 선택칸으로 낸다', () => {
    renderPane();

    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByLabelText('선출 정책')).toBeInTheDocument();
    expect(screen.getByLabelText('LOT 보관 단위 기본값')).toBeInTheDocument();
  });

  it('원본 4열을 이 구획에 두지 않는다', () => {
    renderPane();

    for (const label of ['품목코드', '품목명', '품목유형', '기준 단위']) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
  });

  it('최신 계약의 확장 속성을 내고 계약에 없는 재생재 입력은 만들지 않는다', () => {
    renderPane();

    for (const label of ['LOT 보관 단위 기본값', '생산 LOT 기본크기', 'IQC 대상']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText('재생재')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('품목명(한국어)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('품목명(베트남어)')).not.toBeInTheDocument();
  });

  /* 동작에 쓰이지 않는 항목은 뺐다(사용자 지시 2026-10-28) — 값은 저장 때 조회한 그대로 되돌려 실린다. */
  it('시리얼 관리 유형 · 개발품 · 개봉 후 유효시간 · 보관 조건 · LOT 관리를 내지 않는다', () => {
    renderPane();

    for (const label of [
      '시리얼 관리 유형',
      '개발품',
      '개봉 후 유효시간(시간)',
      '보관 조건',
      'LOT 관리',
    ]) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
  });
});

/**
 * 결정 3 — 사용 여부에 컨트롤을 두지 않는다.
 *
 * 계약이 저장 본문에 필수로 요구하지만 같은 계약이 「사용 중지 액션이 화면에 없다」고 못 박았다.
 */
/** 고치지 않는 값(MES 구분 · 사용 여부)은 위 사실 칸에 있다 — 폼에는 고치는 칸만 둔다. */
describe('ItemAttrsPane — 고치지 않는 값은 폼에 없다', () => {
  it('MES 구분 · 사용 여부를 내지 않는다', () => {
    renderPane();

    expect(screen.queryByText('MES 구분')).not.toBeInTheDocument();
    expect(screen.queryByText('사용 여부')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: '사용 여부' })).not.toBeInTheDocument();
  });
});

describe('ItemAttrsPane — 유효기한 관리 토글', () => {
  it('토글을 끄면 그 사실만 알린다 — 값 칸을 화면이 지우지 않는다', async () => {
    const { onChange, user } = renderPane();

    await user.click(screen.getByRole('switch', { name: '유효기한 관리' }));

    expect(onChange).toHaveBeenCalledWith({ shelfLifeManaged: false });
  });

  /* 조건부 필수(A-2) — 표시가 없으면 저장을 눌러야 필수임을 알게 된다. */
  it('토글이 켜져 있으면 유효기한(일)이 필수로 표시된다', () => {
    renderPane();

    expect(screen.getByLabelText('유효기한(일)')).toHaveAttribute('aria-required', 'true');
  });

  /* 꺼져 있으면 일수 칸 자체가 없다 — 저장 때 비워 보낸다(계약 A-2). */
  it('토글이 꺼져 있으면 일수 칸이 없다', () => {
    renderPane({
      values: { ...itemToAttrsFormValues(itemFixtures[0]!), shelfLifeManaged: false },
    });

    expect(screen.queryByLabelText('유효기한(일)')).not.toBeInTheDocument();
  });
});

describe('ItemAttrsPane — 입력과 액션', () => {
  it('입력을 고치면 그 필드만 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText('생산 LOT 기본크기'), '1');

    expect(onChange).toHaveBeenLastCalledWith({ defaultProductionLotSize: '5001' });
  });

  it('고친 것이 없으면 저장과 취소가 닫혀 있다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('고친 것이 있으면 저장할 수 있다', async () => {
    const { onSave, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('저장하는 동안에는 다시 누를 수 없다', () => {
    renderPane({ isDirty: true, isSaving: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('필드 오류를 그 칸 옆에 낸다', () => {
    renderPane({ fieldErrors: { shelfLifeDays: '유효기한(일)은 0 이상의 정수로 입력하세요.' } });

    expect(screen.getByText('유효기한(일)은 0 이상의 정수로 입력하세요.')).toBeInTheDocument();
  });

  it('저장 실패 배너 자리를 상위에서 받는다', () => {
    renderPane({ banner: <p>저장 실패 자리</p> });

    expect(
      within(screen.getByRole('region', { name: '확장 속성' })).getByText('저장 실패 자리'),
    ).toBeInTheDocument();
  });
});
