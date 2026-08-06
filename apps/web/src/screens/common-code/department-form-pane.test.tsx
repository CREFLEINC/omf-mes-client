import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DepartmentFormPane } from './department-form-pane';
import type { DepartmentFormValues } from './types';

const values: DepartmentFormValues = {
  departmentCode: 'SYN-DEPT-01',
  departmentName: '합성 부서 A',
  parentDepartmentId: '',
  businessUnitId: '',
};

const renderPane = (overrides: Partial<Parameters<typeof DepartmentFormPane>[0]> = {}) => {
  const onChange = vi.fn<(patch: Partial<DepartmentFormValues>) => void>();
  const onSave = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();
  const onDeactivate = vi.fn<() => void>();

  render(
    <DepartmentFormPane
      mode="edit"
      values={values}
      onChange={onChange}
      fieldErrors={{}}
      banner={null}
      codeLockReason={null}
      deactivateDisabledReason={null}
      parentOptions={[{ value: '3002', label: 'SYN-DEPT-02 · 합성 부서 B' }]}
      parentDisabledReason={null}
      businessUnitOptions={[{ value: '4001', label: 'SYN-BU-01 · 합성 사업부 A' }]}
      isDirty
      isSaving={false}
      onSave={onSave}
      onCancel={onCancel}
      onDeactivate={onDeactivate}
      {...overrides}
    />,
  );

  return { onChange, onSave, onCancel, onDeactivate, user: userEvent.setup() };
};

describe('DepartmentFormPane — 입력칸', () => {
  it('네 칸을 낸다 — 사용 여부 입력칸을 두지 않는다', () => {
    renderPane();

    expect(screen.getByLabelText('부서코드')).toBeInTheDocument();
    expect(screen.getByLabelText('부서명')).toBeInTheDocument();
    expect(screen.getByLabelText('상위 부서')).toBeInTheDocument();
    expect(screen.getByLabelText('사업부')).toBeInTheDocument();
    // 사용 여부는 전용 액션으로만 바뀐다 — 입력칸을 두면 저장 본문에 실릴 여지가 생긴다.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('값을 고치면 그 칸만 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText('부서명'), 'X');

    expect(onChange).toHaveBeenCalledWith({ departmentName: '합성 부서 AX' });
  });

  it('인라인 오류가 그 칸에 붙는다', () => {
    renderPane({ fieldErrors: { departmentCode: '필수 입력 항목입니다.' } });

    expect(screen.getByText('필수 입력 항목입니다.')).toBeInTheDocument();
  });
});

describe('DepartmentFormPane — 코드 잠금', () => {
  /*
   * 판정의 주인은 서버가 준 편집 가능 여부다 — 화면이 스스로 잠그지 않는다.
   * 상위가 만든 사유를 그대로 받아 붙인다.
   */
  it('잠금 사유가 있으면 부서코드 칸이 잠기고 사유가 붙는다', () => {
    renderPane({ codeLockReason: '이 코드는 다른 자료가 참조 중이라 고칠 수 없습니다.' });

    expect(screen.getByLabelText('부서코드')).toBeDisabled();
    expect(
      screen.getByText('이 코드는 다른 자료가 참조 중이라 고칠 수 없습니다.'),
    ).toBeInTheDocument();
  });

  /* 잠기는 것은 코드 칸뿐이다 — 서버가 잠그지 않은 칸까지 화면이 잠그면 안 된다. */
  it('코드가 잠겨도 부서명과 상위 부서는 편집할 수 있다', () => {
    renderPane({ codeLockReason: '고칠 수 없습니다.' });

    expect(screen.getByLabelText('부서명')).toBeEnabled();
    expect(screen.getByLabelText('상위 부서')).toBeEnabled();
  });
});

describe('DepartmentFormPane — 상위 부서', () => {
  /* 상위로 고를 다른 부서가 없으면 감추지 않고 사유와 함께 비활성으로 둔다(배치 규범 4). */
  it('상위로 고를 부서가 없으면 선택칸이 비활성이고 사유가 붙는다', () => {
    renderPane({
      parentOptions: [],
      parentDisabledReason: '상위 부서는 고를 수 있는 다른 부서가 없어 지정할 수 없습니다.',
    });

    expect(screen.getByLabelText('상위 부서')).toBeDisabled();
    expect(
      screen.getByText('상위 부서는 고를 수 있는 다른 부서가 없어 지정할 수 없습니다.'),
    ).toBeInTheDocument();
  });

  /* 비우는 것이 정상 값이다 — 계약이 널을 허용하고 그것이 곧 뿌리 부서다. */
  it('상위 부서를 비우는 선택지가 있다', async () => {
    const { user } = renderPane();

    await user.click(screen.getByLabelText('상위 부서'));

    expect(screen.getByRole('option', { name: '없음 (뿌리 부서)' })).toBeInTheDocument();
  });
});

describe('DepartmentFormPane — 액션', () => {
  it('등록 폼에는 사용 중지 자리를 두지 않는다', () => {
    renderPane({ mode: 'create' });

    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '부서 추가' })).toBeInTheDocument();
  });

  it('수정 폼의 사용 중지를 누르면 알린다', async () => {
    const { onDeactivate, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '사용 중지' }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  /* 이미 미사용이면 되돌릴 수 없는 조작을 다시 할 이유가 없다 — 감추지 않고 사유를 밝힌다. */
  it('사용 중지 사유가 있으면 비활성이고 사유가 붙는다', () => {
    renderPane({
      deactivateDisabledReason: '사용 중지는 이미 미사용인 부서에 다시 할 수 없습니다.',
    });

    expect(screen.getByRole('button', { name: '사용 중지' })).toBeDisabled();
    expect(
      screen.getByText('사용 중지는 이미 미사용인 부서에 다시 할 수 없습니다.'),
    ).toBeInTheDocument();
  });

  it('고친 것이 없으면 저장을 누를 수 없다', () => {
    renderPane({ isDirty: false });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  /*
   * 등록에서 「취소」는 폼을 닫는 것이라 고친 것이 없어도 눌러야 한다.
   * 수정에서는 기준값으로 되돌리는 것이라 고친 것이 있을 때만 뜻이 있다.
   */
  it('등록의 취소는 고친 것이 없어도 눌린다', () => {
    renderPane({ mode: 'create', isDirty: false });

    expect(screen.getByRole('button', { name: '취소' })).toBeEnabled();
  });

  it('수정의 취소는 고친 것이 있을 때만 눌린다', () => {
    renderPane({ isDirty: false });

    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('저장 중에는 저장을 다시 누를 수 없다', () => {
    renderPane({ isSaving: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });
});
