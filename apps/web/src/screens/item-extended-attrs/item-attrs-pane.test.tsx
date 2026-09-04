import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FREE_TEXT_CODES } from './code-catalog';
import { itemFixtures } from './fixtures';
import { ItemAttrsPane } from './item-attrs-pane';
import { itemToAttrsFormValues } from './item-attrs-mappers';
import type { ItemAttrsFormValues } from './types';

/**
 * **이 구획이 소유한** 자유 입력 코드와 그 화면 라벨.
 *
 * `code-catalog.ts`의 목록은 화면 전체를 담는다 — `externalSystemCode`는 부속 정보 탭의
 * 외부 코드 구획에 있어 여기서 찾을 수 없다. 그래서 이 구획 몫만 뽑아 쓰되,
 * 아래에서 **그 몫이 실제로 목록에 있는지** 함께 확인한다(목록과 화면이 갈리지 않도록).
 */
const FREE_TEXT_LABELS: Record<string, string> = {
  serialControlTypeCode: '시리얼 관리 유형',
  storageConditionCode: '보관 조건',
};

const renderPane = (overrides: Partial<Parameters<typeof ItemAttrsPane>[0]> = {}) => {
  const onChange = vi.fn<(patch: Partial<ItemAttrsFormValues>) => void>();
  const onSave = vi.fn();
  const onCancel = vi.fn();

  render(
    <ItemAttrsPane
      values={itemToAttrsFormValues(itemFixtures[0]!)}
      isActive
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

  it('확장 속성을 의미별 네 구획으로 묶는다', () => {
    renderPane();

    for (const name of ['다국어 명칭', 'LOT 기본값·식별', '유효기한·선출', '검사·재고·보관']) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument();
    }
  });

  /*
   * 값 목록이 확정되지 않은 코드는 **자유 입력**이다(결정 4).
   * 빈 선택지로 두면 저장 자체가 막히고, 값을 지어내면 화면이 코드 체계를 주장하게 된다.
   */
  it.each(Object.keys(FREE_TEXT_LABELS))('%s는 자유 입력이다', (field) => {
    renderPane();

    expect(screen.getByLabelText(FREE_TEXT_LABELS[field]!)).toHaveProperty('tagName', 'INPUT');
  });

  /* 위 목록이 자리표시 기록과 갈리면 「무엇이 자유 입력인가」의 정본이 둘이 된다. */
  it('이 구획의 자유 입력 필드가 자리표시 기록에 들어 있다', () => {
    for (const field of Object.keys(FREE_TEXT_LABELS)) {
      expect(FREE_TEXT_CODES).toContain(field);
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

    for (const label of [
      '품목명(한국어)',
      '품목명(베트남어)',
      'LOT 보관 단위 기본값',
      '생산 LOT 기본크기',
      '개발품',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText('재생재')).not.toBeInTheDocument();
  });
});

/**
 * 결정 3 — 사용 여부에 컨트롤을 두지 않는다.
 *
 * 계약이 저장 본문에 필수로 요구하지만 같은 계약이 「사용 중지 액션이 화면에 없다」고 못 박았다.
 */
describe('ItemAttrsPane — 사용 여부는 값 표기다', () => {
  it('값으로만 낸다', () => {
    renderPane();

    expect(screen.getByLabelText('사용 여부')).toHaveTextContent('사용 중');
  });

  it('미사용 품목은 미사용으로 낸다', () => {
    renderPane({ isActive: false });

    expect(screen.getByLabelText('사용 여부')).toHaveTextContent('미사용');
  });

  /* 값만 있고 바꿀 수단이 없으면 사용자가 화면이 빠뜨린 것으로 읽는다 — 이유를 밝힌다. */
  it('바꾸지 않는다는 사실을 함께 밝힌다', () => {
    renderPane();

    expect(
      screen.getByText(
        '사용 여부는 이 화면에서 바꾸지 않습니다. 저장해도 지금 값이 그대로 유지됩니다.',
      ),
    ).toBeInTheDocument();
  });

  it('사용 여부를 켜고 끄는 컨트롤이 없다', () => {
    renderPane();

    const switches = screen.getAllByRole('switch').map((element) => element.getAttribute('id'));

    // 스위치는 개발품을 포함한 다섯 확장 불리언뿐이다.
    expect(switches).toHaveLength(5);
    expect(screen.queryByRole('switch', { name: '사용 여부' })).not.toBeInTheDocument();
  });
});

describe('ItemAttrsPane — LOT 관리 여부', () => {
  it('토글을 바꾸면 boolean 계약 필드만 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.click(screen.getByRole('switch', { name: 'LOT 관리' }));

    expect(onChange).toHaveBeenCalledWith({ lotControlled: false });
  });
});

describe('ItemAttrsPane — 최신 확장 속성', () => {
  it('다국어명을 고치면 해당 계약 필드만 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText('품목명(한국어)'), 'X');

    expect(onChange).toHaveBeenLastCalledWith({ nameKo: '합성 품목 A 표시명X' });
  });

  it('개발품을 바꾸면 boolean 계약 필드만 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.click(screen.getByRole('switch', { name: '개발품' }));

    expect(onChange).toHaveBeenCalledWith({ developmentItem: false });
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

  it('토글이 꺼져 있으면 필수 표시가 없다', () => {
    renderPane({
      values: { ...itemToAttrsFormValues(itemFixtures[0]!), shelfLifeManaged: false },
    });

    expect(screen.getByLabelText('유효기한(일)')).not.toHaveAttribute('aria-required');
  });
});

describe('ItemAttrsPane — 입력과 액션', () => {
  it('입력을 고치면 그 필드만 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText('보관 조건'), 'X');

    expect(onChange).toHaveBeenLastCalledWith({ storageConditionCode: 'SYN-STORAGE-01X' });
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
