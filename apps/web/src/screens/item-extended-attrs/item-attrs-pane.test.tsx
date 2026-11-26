import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemFixtures } from './fixtures';
import { ItemAttrsPane, lotSizeLabelOf } from './item-attrs-pane';
import { itemToAttrsFormValues } from './item-attrs-mappers';
import { validateItemAttrsForm } from './item-attrs-validation';
import type { ItemAttrsFormValues } from './types';

const renderPane = (overrides: Partial<Parameters<typeof ItemAttrsPane>[0]> = {}) => {
  const onChange = vi.fn<(patch: Partial<ItemAttrsFormValues>) => void>();
  const onSave = vi.fn();
  const onCancel = vi.fn();

  render(
    <ItemAttrsPane
      values={itemToAttrsFormValues(itemFixtures[0]!)}
      itemTypeCode="FINISHED"
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

  /* 검사 기준의 IQC 「기본 생략」과 함께 바뀐다는 사실은 스위치 아래 대신 항목 이름 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */
  it('IQC 대상이 검사 기준과 함께 바뀐다는 안내는 항목 이름 옆 ⓘ 의 설명으로 읽힌다', () => {
    renderPane();

    const note = messages.itemExtendedAttrs.attrs.inspectionRequiredSyncNote;
    expect(screen.getByRole('button', { name: note })).toBeInTheDocument();
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'IQC 대상' })).toBeInTheDocument();
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
    expect(screen.queryByText('사용 유무')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: '사용 유무' })).not.toBeInTheDocument();
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

/* LOT 기본크기는 품목유형마다 뜻이 다르다(사용자 지시 2026-10-28) — 칸은 하나를 함께 쓴다. */
describe('ItemAttrsPane — 품목유형별 LOT 기본크기', () => {
  it('반제품 · 제품은 생산 LOT, 원자재 · 부자재는 자재 LOT, 상품은 칸이 없다', () => {
    expect(lotSizeLabelOf('FINISHED')).toBe('생산 LOT 기본크기');
    expect(lotSizeLabelOf('SEMI_FINISHED')).toBe('생산 LOT 기본크기');
    expect(lotSizeLabelOf('RAW_MATERIAL')).toBe('자재 LOT 기본크기');
    expect(lotSizeLabelOf('SUBSIDIARY_MATERIAL')).toBe('자재 LOT 기본크기');
    expect(lotSizeLabelOf('MERCHANDISE')).toBeNull();
  });

  it('원자재는 같은 칸을 자재 LOT 기본크기로 낸다', async () => {
    const { onChange, user } = renderPane({ itemTypeCode: 'RAW_MATERIAL' });

    expect(screen.queryByLabelText('생산 LOT 기본크기')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('자재 LOT 기본크기'), '1');

    expect(onChange).toHaveBeenLastCalledWith({ defaultProductionLotSize: '5001' });
  });

  it('상품은 LOT 기본크기 칸이 없다', () => {
    renderPane({ itemTypeCode: 'MERCHANDISE' });

    expect(screen.queryByLabelText('생산 LOT 기본크기')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('자재 LOT 기본크기')).not.toBeInTheDocument();
  });
});

/* 피처 014 FR-018 · 시안 W0114-W0605 W6·W7 — 원자재 · 부자재의 LOT 기본값에 패키징 두 칸. */
describe('US5-1 ItemAttrsPane — 패키징 기본값 두 칸', () => {
  it('US5-1 원자재 · 부자재는 패키징 단위 · LOT 당 패키징 수량 기본값 칸을 LOT 기본값 묶음에 낸다', () => {
    renderPane({ itemTypeCode: 'SUBSIDIARY_MATERIAL' });

    const lot = screen.getByRole('rowgroup', { name: 'LOT 기본값' });
    expect(within(lot).getByLabelText('패키징 단위 기본값')).toBeInTheDocument();
    expect(within(lot).getByLabelText('LOT 당 패키징 수량 기본값')).toBeInTheDocument();
  });

  it('US5-1 제품 · 상품에는 두 칸이 없다(자재 LOT 이 아니다)', () => {
    renderPane({ itemTypeCode: 'FINISHED' });

    expect(screen.queryByLabelText('패키징 단위 기본값')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('LOT 당 패키징 수량 기본값')).not.toBeInTheDocument();
  });

  it('US5-1 LOT 당 패키징 수량을 넣으면 그 칸만 알린다', async () => {
    const { onChange, user } = renderPane({ itemTypeCode: 'RAW_MATERIAL' });

    await user.type(screen.getByLabelText('LOT 당 패키징 수량 기본값'), '5');

    expect(onChange).toHaveBeenLastCalledWith({ defaultPackageCount: '5' });
  });

  it('US5-3 나누지 못하는 오류를 LOT 당 패키징 수량 칸 아래에 낸다', () => {
    const message =
      '패키징 수량이 부적합 합니다. 자재 LOT 기본크기를 정확히 나눌 수 있는 값을 입력해주세요.';
    renderPane({ itemTypeCode: 'RAW_MATERIAL', fieldErrors: { defaultPackageCount: message } });

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  /* 사용자 결정 2026-11-24 — 기본크기 ÷ 패키징 수량이 소수 1자리까지 떨어지면 통과(Q15). */
  it.each([
    ['2.5', '5', true],
    ['10', '4', true],
    ['2.5', '2', false],
    ['100', '30', false],
  ])('US5-3 Q15 기본크기 %s ÷ 패키징 수량 %s — 통과 %s', (size, count, ok) => {
    const message =
      '패키징 수량이 부적합 합니다. 자재 LOT 기본크기를 정확히 나눌 수 있는 값을 입력해주세요.';
    const values = {
      ...itemToAttrsFormValues(itemFixtures[0]!),
      defaultProductionLotSize: size,
      defaultPackageUomId: '7003',
      defaultPackageCount: count,
    };
    renderPane({
      itemTypeCode: 'RAW_MATERIAL',
      values,
      fieldErrors: validateItemAttrsForm(values),
    });

    if (ok) expect(screen.queryByText(message)).not.toBeInTheDocument();
    else expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('US5-3 LOT 당 패키징 수량 도움말은 소수 1자리 규칙을 말한다', () => {
    expect(messages.itemExtendedAttrs.attrs.defaultPackageCountNote).toContain(
      '자재 LOT 기본크기 ÷ 패키징 수량이 소수 1자리까지 떨어져야 합니다.',
    );
  });

  it('US5-2 패키징 단위 칸의 오류도 낸다', () => {
    const message = '패키징 단위와 LOT 당 패키징 수량은 함께 넣거나 함께 비워 주세요';
    renderPane({ itemTypeCode: 'RAW_MATERIAL', fieldErrors: { defaultPackageUomId: message } });

    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
