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

describe('VersionFormPane — 샘플 비율 표기', () => {
  /* 단위를 라벨에 박지 않으면 30을 30개로 읽는다 — 받는 값은 백분율이다(#201). */
  it('라벨이 단위를 담는다', () => {
    renderPane();

    expect(screen.getByLabelText('샘플 비율(%)')).toBeInTheDocument();
    expect(screen.queryByLabelText(/샘플 수량/)).not.toBeInTheDocument();
  });

  /*
   * 「비율이 아니라 개수」를 밝히던 보조 안내를 정의째 없앴다 — 그 한 줄의 존재 이유가
   * 「확정은 비율인데 받는 값은 수량」이라는 어긋남이었고 #201 이 그것을 해소했다.
   */
  it('옛 보조 안내가 화면에 없다', () => {
    renderPane();

    // 음성 단언은 짝 양성과 같은 시점에 잰다 — 칸이 실제로 그려졌음을 먼저 확인한다.
    expect(screen.getByLabelText('샘플 비율(%)')).toBeInTheDocument();
    expect(screen.queryByText(/비율\(%\)이 아니라/)).not.toBeInTheDocument();
    expect(screen.queryByText(/검사할 개수입니다/)).not.toBeInTheDocument();
  });

  it('저장된 값을 그대로 낸다 — 100으로 곱하거나 나누지 않는다', () => {
    renderPane();

    const input = screen.getByLabelText('샘플 비율(%)');

    expect(input).toHaveValue(30);
    expect(input).not.toHaveValue(0.3);
    expect(input).not.toHaveValue(3000);
  });

  /*
   * `step` 기본값 1 은 소수를 브라우저 단에서 막는다 — 계약이 double 이다(#201 ③).
   *
   * **jsdom 은 step 제약을 실제로 강제하지 않는다**(실측 — `step` 을 지워도
   * `validity.stepMismatch` 가 거짓이다). 그래서 여기서는 속성이 실제 잣대이고,
   * 브라우저가 소수를 받는지는 사람 확인 몫이다. 대신 소수 값이 자릿수 그대로 그려지는지는 잰다.
   */
  it('입력칸이 소수를 막지 않는다', () => {
    renderPane({ values: versionToFormValues(inspectionPlanVersionFixtures[1]!) });

    const input = screen.getByLabelText<HTMLInputElement>('샘플 비율(%)');

    expect(input).toHaveValue(2.5);
    expect(input).toHaveAttribute('step', 'any');
  });

  /* 0 은 이제 허용되지 않는 값이라 `min={0}`은 거짓 안내다. 상한만 브라우저에 알린다. */
  it('상한 100이 걸려 있고 하한 0은 걸려 있지 않다', () => {
    renderPane();

    const input = screen.getByLabelText('샘플 비율(%)');

    expect(input).toHaveAttribute('max', '100');
    expect(input).not.toHaveAttribute('min');
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

    expect(screen.getByLabelText('샘플 비율(%)')).toBeDisabled();
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

    expect(screen.getByLabelText('샘플 비율(%)')).toBeEnabled();
    expect(screen.getByRole('combobox', { name: '샘플링 방법' })).toBeEnabled();
  });
});

describe('VersionFormPane — 편집', () => {
  it('값을 고치면 그 값만 알린다', () => {
    const { onChange } = renderPane();

    fireEvent.change(screen.getByLabelText('샘플 비율(%)'), { target: { value: '40' } });

    expect(onChange).toHaveBeenCalledWith({ samplingRatio: '40' });
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
