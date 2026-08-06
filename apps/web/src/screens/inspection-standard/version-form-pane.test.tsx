import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inspectionPlanVersionFixtures } from './fixtures';
import { resolveVersionStatus } from './plan-version-status';
import type { VersionFormValues } from './types';
import { VersionFormPane } from './version-form-pane';
import { emptyVersionFormValues, versionToFormValues } from './version-mappers';

const renderPane = (overrides: Partial<Parameters<typeof VersionFormPane>[0]> = {}) => {
  const onChange = vi.fn<(patch: Partial<VersionFormValues>) => void>();
  const onSave = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();

  render(
    <VersionFormPane
      mode="edit"
      planVersion={2}
      status={resolveVersionStatus('DRAFT')}
      values={versionToFormValues(inspectionPlanVersionFixtures[0]!)}
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

describe('VersionFormPane — 샘플 수량 표기', () => {
  /*
   * 라벨을 「비율」로 쓰면 30을 넣은 사람이 30%로 오해한다 — 확정 문서의 문구가
   * 「샘플 비율(%)」이었기 때문에 단위를 라벨에 박는 것이 이 화면의 첫 방어선이다.
   */
  it('라벨이 단위를 담는다', () => {
    renderPane();

    expect(screen.getByLabelText('샘플 수량(개)')).toBeInTheDocument();
    expect(screen.queryByLabelText('샘플 비율(%)')).not.toBeInTheDocument();
  });

  it('보조 안내가 비율이 아님을 밝힌다', () => {
    renderPane();

    expect(screen.getByText('비율(%)이 아니라 검사할 개수입니다.')).toBeInTheDocument();
  });

  it('저장된 값을 개수 그대로 낸다 — 비율로 환산하지 않는다', () => {
    renderPane();

    expect(screen.getByLabelText('샘플 수량(개)')).toHaveValue(30);
  });
});

describe('VersionFormPane — 상태 표기', () => {
  it('상태 배지와 임시 안내를 함께 낸다', () => {
    renderPane();

    expect(screen.getByText('작성중')).toBeInTheDocument();
    expect(
      screen.getByText(
        '상태 표시는 임시입니다 — 상태 값 목록이 확정되면 이 표시가 바뀔 수 있습니다.',
      ),
    ).toBeInTheDocument();
  });

  /* 서버가 채우는 값을 미리 지어내 보이지 않는다. */
  it('등록 폼에서는 판 번호와 상태를 내지 않는다', () => {
    renderPane({
      mode: 'create',
      planVersion: null,
      status: null,
      values: emptyVersionFormValues(),
    });

    expect(screen.queryByText('버전 2')).not.toBeInTheDocument();
    expect(screen.queryByText('작성중')).not.toBeInTheDocument();
    expect(screen.queryByText(/상태 표시는 임시입니다/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '버전 등록' })).toBeInTheDocument();
  });
});

describe('VersionFormPane — 상태 잠금', () => {
  it('확정 버전은 전 입력이 잠기고 푸는 방법을 안내한다', () => {
    renderPane({ status: resolveVersionStatus('CONFIRMED') });

    expect(screen.getByLabelText('샘플 수량(개)')).toBeDisabled();
    expect(screen.getByLabelText('유효시작')).toBeDisabled();
    expect(screen.getByLabelText('AQL')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '검사 주기' })).toBeDisabled();
    expect(
      screen.getByText('확정된 버전은 수정할 수 없습니다. 변경하려면 신규 버전을 발행하세요.'),
    ).toBeInTheDocument();
  });

  it('폐기 버전은 다른 문구로 안내한다', () => {
    renderPane({ status: resolveVersionStatus('OBSOLETE') });

    expect(
      screen.getByText('폐기된 버전은 수정할 수 없습니다. 변경하려면 신규 버전을 발행하세요.'),
    ).toBeInTheDocument();
  });

  /* 잠금 직전에 고친 값이 남아 있을 수 있어 저장도 함께 막는다. */
  it('잠긴 버전에서는 고친 것이 있어도 저장이 막힌다', () => {
    renderPane({ status: resolveVersionStatus('CONFIRMED'), isDirty: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('작성중 버전에서는 입력이 열린다', () => {
    renderPane();

    expect(screen.getByLabelText('샘플 수량(개)')).toBeEnabled();
    expect(screen.getByRole('combobox', { name: '샘플링 방법' })).toBeEnabled();
  });
});

describe('VersionFormPane — 편집', () => {
  it('값을 고치면 그 값만 알린다', () => {
    const { onChange } = renderPane();

    fireEvent.change(screen.getByLabelText('샘플 수량(개)'), { target: { value: '40' } });

    expect(onChange).toHaveBeenCalledWith({ samplingQty: '40' });
  });

  it('필드 오류를 그 칸 옆에 낸다', () => {
    renderPane({ fieldErrors: { rejectionNumber: '불합격판정개수는 0보다 큰 숫자여야 합니다.' } });

    expect(screen.getByText('불합격판정개수는 0보다 큰 숫자여야 합니다.')).toBeInTheDocument();
  });

  it('고친 것이 없으면 저장과 취소가 모두 비활성이다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  /* 값 목록이 확정되지 않았다는 사실을 감추지 않는다. */
  it('자리표시 선택칸에 준비 중 안내가 붙는다', () => {
    renderPane();

    expect(
      screen.getAllByText('선택지 준비 중입니다. 코드 목록이 확정되면 이 항목에서 고를 수 있습니다.')
        .length,
    ).toBeGreaterThan(0);
  });
});
