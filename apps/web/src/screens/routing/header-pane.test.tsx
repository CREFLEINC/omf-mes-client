import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HeaderPane, type HeaderPaneProps } from './header-pane';
import { resolveRoutingStatus } from './routing-status';

const VALUES = {
  routingCode: 'STANDARD',
  effectiveFrom: '2026-02-01',
  effectiveTo: '2026-02-28',
};

const CONFIRM_NEEDS_OPERATIONS = '확정은 공정을 1건 이상 등록해야 할 수 있습니다.';
const OBSOLETE_NEEDS_CONFIRMED = '폐기는 확정된 Rev에만 할 수 있습니다. 먼저 확정하세요.';

const renderPane = (overrides: Partial<HeaderPaneProps> = {}) => {
  const onChange = vi.fn();
  const onCancel = vi.fn();
  const onSave = vi.fn();
  const onConfirm = vi.fn();
  const onObsolete = vi.fn();

  render(
    <HeaderPane
      mode="edit"
      itemLabel="ITM-001 · 하우징 커버"
      routingVersion={3}
      status={resolveRoutingStatus('DRAFT')}
      values={VALUES}
      onChange={onChange}
      fieldErrors={{}}
      banner={null}
      codeLockReason={null}
      isDirty={false}
      isSaving={false}
      onSave={onSave}
      onCancel={onCancel}
      confirmDisabledReason={null}
      obsoleteDisabledReason={OBSOLETE_NEEDS_CONFIRMED}
      isTransitioning={false}
      onConfirm={onConfirm}
      onObsolete={onObsolete}
      {...overrides}
    />,
  );

  return { onChange, onCancel, onSave, onConfirm, onObsolete, user: userEvent.setup() };
};

const STATE_LOCK_CONFIRMED = '확정된 Rev는 수정할 수 없습니다. 변경하려면 신규 Rev를 발행하세요.';
const CODE_LOCK = '이미 다른 자료에서 사용 중이라 코드를 바꿀 수 없습니다.';

describe('HeaderPane', () => {
  it('받은 값으로 폼과 값 표기를 채운다', () => {
    renderPane();

    expect(screen.getByLabelText('Routing 코드')).toHaveValue('STANDARD');
    expect(screen.getByLabelText('유효시작')).toHaveValue('2026-02-01');
    expect(screen.getByLabelText('유효종료')).toHaveValue('2026-02-28');
    expect(screen.getByText('ITM-001 · 하우징 커버')).toBeInTheDocument();
    expect(screen.getByText('Rev 3')).toBeInTheDocument();
    expect(screen.getByText('작성중')).toBeInTheDocument();
  });

  it('작성중이면 입력을 열어 두고 잠금 안내를 내지 않는다', () => {
    renderPane();

    expect(screen.getByLabelText('Routing 코드')).toBeEnabled();
    expect(screen.getByLabelText('유효시작')).toBeEnabled();
    expect(screen.queryByText(STATE_LOCK_CONFIRMED)).not.toBeInTheDocument();
  });

  it('값을 고치면 그 칸만 상위로 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText('Routing 코드'), 'X');
    expect(onChange).toHaveBeenCalledWith({ routingCode: 'STANDARDX' });

    // 날짜 입력은 달력 위젯을 거치므로 값 변경을 직접 일으켜 확인한다.
    fireEvent.change(screen.getByLabelText('유효종료'), { target: { value: '2026-03-31' } });
    expect(onChange).toHaveBeenCalledWith({ effectiveTo: '2026-03-31' });
  });

  it('확정 Rev에서는 헤더 입력 전부가 잠기고 푸는 방법을 안내한다', () => {
    renderPane({ status: resolveRoutingStatus('CONFIRMED') });

    expect(screen.getByLabelText('Routing 코드')).toBeDisabled();
    expect(screen.getByLabelText('유효시작')).toBeDisabled();
    expect(screen.getByLabelText('유효종료')).toBeDisabled();
    expect(screen.getByText(STATE_LOCK_CONFIRMED)).toBeInTheDocument();
  });

  it('폐기 Rev에서도 입력이 잠기고 폐기에 맞는 안내가 나온다', () => {
    renderPane({ status: resolveRoutingStatus('OBSOLETE') });

    expect(screen.getByLabelText('Routing 코드')).toBeDisabled();
    expect(
      screen.getByText('폐기된 Rev는 수정할 수 없습니다. 변경하려면 신규 Rev를 발행하세요.'),
    ).toBeInTheDocument();
  });

  /*
   * 상태 잠금과 코드 잠금은 사유가 다르다 — 하나로 뭉뚱그리면 사용자가 무엇을 하면 풀리는지 알 수 없다.
   */
  it('코드 잠금은 Routing 코드만 잠그고 상태 잠금과 다른 문구를 낸다', () => {
    renderPane({ codeLockReason: CODE_LOCK });

    expect(screen.getByLabelText('Routing 코드')).toBeDisabled();
    expect(screen.getByLabelText('유효시작')).toBeEnabled();
    expect(screen.getByLabelText('유효종료')).toBeEnabled();
    expect(screen.getByText(CODE_LOCK)).toBeInTheDocument();
    expect(screen.queryByText(STATE_LOCK_CONFIRMED)).not.toBeInTheDocument();
  });

  it('상태와 코드가 함께 잠기면 두 사유가 모두 보인다', () => {
    renderPane({ status: resolveRoutingStatus('CONFIRMED'), codeLockReason: CODE_LOCK });

    expect(screen.getByText(STATE_LOCK_CONFIRMED)).toBeInTheDocument();
    expect(screen.getByText(CODE_LOCK)).toBeInTheDocument();
  });

  it('모르는 상태 코드는 원본 코드를 배지로 내고 편집을 막지 않는다', () => {
    renderPane({ status: resolveRoutingStatus('ACTIVE') });

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByLabelText('Routing 코드')).toBeEnabled();
  });

  /*
   * 유효종료는 「지정하지 않음」이 정상 값이라 표시를 붙이지 않는다 —
   * 필수인 칸과 아닌 칸이 같은 폼에 있으므로 표시가 그 차이를 밝힌다.
   */
  it('필수 입력칸에만 표시를 붙이고 접근성 이름은 그대로 둔다', () => {
    renderPane();

    expect(screen.getByLabelText('Routing 코드')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('유효시작')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('유효종료')).not.toHaveAttribute('aria-required');

    expect(screen.getAllByText('*', { selector: '[aria-hidden="true"]' })).toHaveLength(2);
  });

  it('필드 오류를 그 입력칸에 인라인으로 낸다', () => {
    renderPane({ fieldErrors: { routingCode: '필수 입력 항목입니다.' } });

    expect(screen.getByText('필수 입력 항목입니다.')).toBeInTheDocument();
  });

  it('범위 밖 액션은 감추지 않고 사유와 함께 비활성으로 둔다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: 'Rev 비교' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '변경 이력' })).toBeDisabled();
    expect(
      screen.getByText(
        'Rev 비교는 아직 할 수 없습니다. 비교 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
      ),
    ).toBeInTheDocument();
  });

  /*
   * 확정·폐기는 활성 조건이 서로 다르다 — 하나로 묶으면 무엇을 하면 풀리는지 알 수 없다.
   */
  it('막을 사유가 없으면 확정을 눌러 상위에 올린다', async () => {
    const { onConfirm, user } = renderPane();

    const confirm = screen.getByRole('button', { name: '확정' });
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('라인이 0건이면 확정이 비활성이고 그 사유가 보인다', () => {
    renderPane({ confirmDisabledReason: CONFIRM_NEEDS_OPERATIONS });

    expect(screen.getByRole('button', { name: '확정' })).toBeDisabled();
    expect(screen.getByText(CONFIRM_NEEDS_OPERATIONS)).toBeInTheDocument();
  });

  it('작성중이면 폐기가 비활성이고 먼저 확정하라고 알린다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '폐기' })).toBeDisabled();
    expect(screen.getByText(OBSOLETE_NEEDS_CONFIRMED)).toBeInTheDocument();
  });

  it('확정 Rev에서는 폐기를 눌러 상위에 올린다', async () => {
    const { onObsolete, user } = renderPane({
      status: resolveRoutingStatus('CONFIRMED'),
      confirmDisabledReason: '확정은 작성중 Rev에만 할 수 있습니다. 변경하려면 신규 Rev를 발행하세요.',
      obsoleteDisabledReason: null,
    });

    await user.click(screen.getByRole('button', { name: '폐기' }));

    expect(onObsolete).toHaveBeenCalledTimes(1);
  });

  it('전이 요청이 도는 동안에는 확정·폐기를 다시 누를 수 없다', () => {
    renderPane({ obsoleteDisabledReason: null, isTransitioning: true });

    expect(screen.getByRole('button', { name: '확정' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '폐기' })).toBeDisabled();
  });

  it('고친 것이 없으면 저장이 비활성이다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('고치면 저장할 수 있다', async () => {
    const { onSave, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalled();
  });

  /* 잠긴 상태에서는 고칠 수도 없지만, 잠금 직전에 고친 값이 남아 있을 수 있어 함께 막는다. */
  it('확정 Rev에서는 고친 값이 남아 있어도 저장이 비활성이다', () => {
    renderPane({ isDirty: true, status: resolveRoutingStatus('CONFIRMED') });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('저장 중에는 저장이 비활성이다', () => {
    renderPane({ isDirty: true, isSaving: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('고친 것이 없으면 취소가 비활성이고, 고치면 취소로 되돌릴 수 있다', async () => {
    const { onCancel, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(onCancel).toHaveBeenCalled();
  });
});
