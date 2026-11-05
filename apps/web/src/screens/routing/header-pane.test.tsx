import { render, screen } from '@testing-library/react';
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
      pqcPlanLabel={null}
      pqcPlanAction={null}
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
  /* 검사 항목은 품목에 붙는다 — 이 품목의 PQC 검사 기준을 머리에 보인다(사용자 지시 2026-11-05). */
  it('이 품목의 PQC 검사 기준을 보인다', () => {
    renderPane({ pqcPlanLabel: 'PQC-1 · 하우징 공정검사' });
    expect(screen.getByText('PQC 검사 기준')).toBeInTheDocument();
    expect(screen.getByText('PQC-1 · 하우징 공정검사')).toBeInTheDocument();
  });

  it('「PQC 검사 기준」 옆 단추를 누르면 올린다', async () => {
    const onClick = vi.fn();
    const { user } = renderPane({
      pqcPlanLabel: 'PQC-1 · 하우징 공정검사',
      pqcPlanAction: { label: '검사 기준 수정', onClick },
    });
    await user.click(screen.getByRole('button', { name: '검사 기준 수정' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('PQC 검사 기준을 아직 모르면 칸이 없다', () => {
    renderPane();
    expect(screen.queryByText('PQC 검사 기준')).not.toBeInTheDocument();
  });

  it('받은 값으로 폼과 값 표기를 채운다', () => {
    renderPane();

    expect(screen.getByLabelText('Routing 코드')).toHaveValue('STANDARD');
    /* 유효 시작일 · 종료일은 입력받지 않는다(#231). */
    expect(screen.queryByLabelText('유효시작')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('유효종료')).not.toBeInTheDocument();
    expect(screen.getByText('ITM-001 · 하우징 커버')).toBeInTheDocument();
    expect(screen.getByText('Rev 3')).toBeInTheDocument();
    expect(screen.getByText('작성중')).toBeInTheDocument();
  });

  it('작성중이면 입력을 열어 두고 잠금 안내를 내지 않는다', () => {
    renderPane();

    expect(screen.getByLabelText('Routing 코드')).toBeEnabled();
    expect(screen.queryByText(STATE_LOCK_CONFIRMED)).not.toBeInTheDocument();
  });

  it('값을 고치면 그 칸만 상위로 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText('Routing 코드'), 'X');
    expect(onChange).toHaveBeenCalledWith({ routingCode: 'STANDARDX' });
  });

  /* 확정 · 폐기는 경고 상자 없이 읽기 전용 값으로 낸다 — 카드 머리 「Rev · 상태」가 잠금을 말한다(#231). */
  it.each(['CONFIRMED', 'OBSOLETE'])(
    '%s Rev 에서는 Routing 코드를 읽기 전용 값으로 내고 경고 상자가 없다',
    (code) => {
      renderPane({ status: resolveRoutingStatus(code) });

      const value = screen.getByLabelText('Routing 코드');
      expect(value).toHaveTextContent('STANDARD');
      expect(value).toHaveAttribute('aria-readonly', 'true');
      /* 입력칸이 아니라 값 표기다. */
      expect(value.tagName).toBe('SPAN');
      expect(screen.queryByText(STATE_LOCK_CONFIRMED)).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  /*
   * 상태 잠금과 코드 잠금은 사유가 다르다 — 코드 잠금은 값 옆 라벨로 따로 알린다.
   */
  it('코드 잠금은 읽기 전용 값 옆에 「사용 중 · 변경 불가」 라벨을 달고 사유를 숨긴 글로 잇는다', () => {
    renderPane({ codeLockReason: CODE_LOCK });

    const value = screen.getByLabelText('Routing 코드');
    expect(value).toHaveAttribute('aria-readonly', 'true');
    /* 긴 문장 대신 값 옆 라벨(#231) — 문장은 숨긴 글로 값에 이어 화면 낭독기가 읽는다. */
    expect(screen.getByText('사용 중 · 변경 불가')).toBeInTheDocument();
    expect(screen.getByText(CODE_LOCK)).toHaveClass('visually-hidden');
    expect(value).toHaveAccessibleDescription(CODE_LOCK);
  });

  it('모르는 상태 코드는 원본 코드를 배지로 내고 편집을 막지 않는다', () => {
    renderPane({ status: resolveRoutingStatus('ACTIVE') });

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByLabelText('Routing 코드')).toBeEnabled();
  });

  it('필수 입력칸에만 표시를 붙이고 접근성 이름은 그대로 둔다', () => {
    renderPane();

    expect(screen.getByLabelText('Routing 코드')).toHaveAttribute('aria-required', 'true');
    /* 남은 입력칸은 코드 하나뿐이다(#231). */
    expect(screen.getAllByText('*', { selector: '[aria-hidden="true"]' })).toHaveLength(1);
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

  it('Rev 1 에는 견줄 앞 판이 없어 Rev 비교 · 변경 이력을 세우지 않는다(#231)', () => {
    renderPane({ routingVersion: 1 });

    expect(screen.queryByRole('button', { name: 'Rev 비교' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '변경 이력' })).not.toBeInTheDocument();
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

  /* 작성중은 폐기할 수 없다 — 비활성으로 두지 않고 단추를 세우지 않는다(사용자 지시 · #231). */
  it('작성중이면 폐기 단추를 세우지 않는다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: '폐기' })).not.toBeInTheDocument();
    expect(screen.queryByText(OBSOLETE_NEEDS_CONFIRMED)).not.toBeInTheDocument();
  });

  it('확정 Rev에서는 폐기를 눌러 상위에 올린다', async () => {
    const { onObsolete, user } = renderPane({
      status: resolveRoutingStatus('CONFIRMED'),
      confirmDisabledReason:
        '확정은 작성중 Rev에만 할 수 있습니다. 변경하려면 신규 Rev를 발행하세요.',
      obsoleteDisabledReason: null,
    });

    await user.click(screen.getByRole('button', { name: '폐기' }));

    expect(onObsolete).toHaveBeenCalledTimes(1);
  });

  it('전이 요청이 도는 동안에는 확정·폐기를 다시 누를 수 없다', () => {
    renderPane({ isTransitioning: true });
    expect(screen.getByRole('button', { name: '확정' })).toBeDisabled();
  });

  it('전이 요청이 도는 동안에는 확정 Rev 의 폐기를 다시 누를 수 없다', () => {
    renderPane({
      status: resolveRoutingStatus('CONFIRMED'),
      obsoleteDisabledReason: null,
      isTransitioning: true,
    });

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
  /* 확정 Rev 에서는 쓸 수 없는 취소 · 저장 · 확정을 세우지 않는다(#231). */
  it('확정 Rev에서는 취소 · 저장 · 확정을 세우지 않고 폐기만 둔다', () => {
    renderPane({
      isDirty: true,
      status: resolveRoutingStatus('CONFIRMED'),
      obsoleteDisabledReason: null,
    });

    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '취소' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '확정' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '폐기' })).toBeEnabled();
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
