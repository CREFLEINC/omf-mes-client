import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HeaderForm } from './header-form';
import type { AdjustHeaderDraft, SelectOption } from './types';

const t = messages.stockAdjust;

const REASON_OPTIONS: SelectOption[] = [
  { value: 'SAMPLE_AR_A', label: 'SAMPLE_AR_A' },
  { value: 'SAMPLE_AR_B', label: 'SAMPLE_AR_B' },
];

const VALUES: AdjustHeaderDraft = { reasonCode: '', sendToErp: true };

const renderForm = (
  overrides: Partial<AdjustHeaderDraft> = {},
  props: {
    reasonOptions?: SelectOption[];
    reasonNote?: string;
    fieldErrors?: Record<string, string>;
    isLocked?: boolean;
  } = {},
) => {
  const onChange = vi.fn();

  render(
    <HeaderForm
      values={{ ...VALUES, ...overrides }}
      reasonOptions={props.reasonOptions ?? REASON_OPTIONS}
      reasonNote={props.reasonNote}
      fieldErrors={props.fieldErrors ?? {}}
      isLocked={props.isLocked ?? false}
      onChange={onChange}
    />,
  );

  return { onChange, user: userEvent.setup() };
};

describe('HeaderForm — 계약이 받는 두 값', () => {
  it('조정 사유와 ERP 송신 두 칸이 선다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.reasonCode)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.sendToErp)).toBeInTheDocument();
  });

  /** 헤더 사유는 계약 필수다 — 필수 표시가 붙는다. */
  it('조정 사유가 필수로 표시된다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.reasonCode)).toHaveAttribute('aria-required', 'true');
  });

  it('사유를 고르면 그 값이 올라간다', async () => {
    const { onChange, user } = renderForm();

    await user.click(screen.getByLabelText(t.fields.reasonCode));
    await user.click(screen.getByRole('option', { name: 'SAMPLE_AR_A' }));

    expect(onChange).toHaveBeenCalledWith({ reasonCode: 'SAMPLE_AR_A' });
  });

  /** ⭐ **기본값이 켬이다**(D-11) — 계약 기본값과 같다. */
  it('ERP 송신이 켠 채로 보인다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.sendToErp)).toBeChecked();
  });

  it('ERP 송신을 끄면 거짓이 올라간다', async () => {
    const { onChange, user } = renderForm();

    await user.click(screen.getByLabelText(t.fields.sendToErp));

    expect(onChange).toHaveBeenCalledWith({ sendToErp: false });
  });

  it('꺼진 상태가 그대로 보인다', () => {
    renderForm({ sendToErp: false });

    expect(screen.getByLabelText(t.fields.sendToErp)).not.toBeChecked();
  });

  /**
   * **연계 방식은 서버가 정한다**(미결 #66 · D-11). 화면이 정하는 것은 보낼지 여부 하나이고,
   * 그 사실만 토글 옆에 적는다 — 자리표시 상수를 두지 않는다.
   */
  it('보내는 방식은 서버가 정한다는 사실이 토글 옆에 선다', () => {
    renderForm();

    expect(screen.getByText(t.notes.sendToErpNote)).toBeVisible();
  });
});

describe('HeaderForm — 값 목록이 아직 비어 있다', () => {
  /**
   * **자리표시 상태**(D-9 · 미결 #64 · C10·C17의 절반).
   *
   * 선택칸은 서고 고를 것이 없다. 무엇이 막혔는지는 보조 문구가 말하고, 등록 잠금 사유가
   * 조작 자리에서 그 사실을 다시 밝힌다.
   */
  it('선택지가 0건이어도 칸은 서고 사유가 보조 문구로 붙는다', async () => {
    const { user } = renderForm({}, { reasonOptions: [], reasonNote: t.notes.reasonCodePending });

    const field = screen.getByLabelText(t.fields.reasonCode);

    expect(field).toBeInTheDocument();
    expect(screen.getByText(t.notes.reasonCodePending)).toBeVisible();

    await user.click(field);

    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  /** 짝 방향 — 값이 오면 그대로 고를 수 있다. 자리표시가 죽은 가지가 아니라는 증거다. */
  it('값 목록이 채워지면 그 선택지가 그대로 선다', async () => {
    const { user } = renderForm();

    await user.click(screen.getByLabelText(t.fields.reasonCode));

    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});

describe('HeaderForm — 서버 오류와 잠금', () => {
  /** 서버가 그 칸에 붙인 오류는 **그 칸 옆**에 선다 — 배너로 밀면 어느 칸인지 알 수 없다. */
  it('사유 칸의 서버 오류가 그 칸에 붙는다', () => {
    renderForm({}, { fieldErrors: { reasonCode: '합성 서버 오류' } });

    expect(screen.getByText('합성 서버 오류')).toBeVisible();
    expect(screen.getByLabelText(t.fields.reasonCode)).toHaveAttribute('aria-invalid', 'true');
  });

  /**
   * **두 칸이 함께 잠긴다**(C26). 나가는 중과 이미 등록한 뒤가 같은 잠금을 쓴다 —
   * 한 칸만 잠그면 그 자리가 곧 「보낸 것과 화면이 갈리는」 경로가 된다.
   */
  it('잠기면 두 칸이 모두 잠긴다', () => {
    renderForm({}, { isLocked: true });

    expect(screen.getByLabelText(t.fields.reasonCode)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.sendToErp)).toBeDisabled();
  });

  /** 짝 방향 — 잠기지 않았으면 둘 다 열려 있다. 「늘 잠근다」로 통과하지 않게 한다. */
  it('잠기지 않았으면 두 칸이 모두 열려 있다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.reasonCode)).toBeEnabled();
    expect(screen.getByLabelText(t.fields.sendToErp)).toBeEnabled();
  });

  /**
   * **잠긴 사유를 이 폼이 내지 않는다**(전례 규율). 사정은 조작 자리에 한 번 서고,
   * 칸마다 되풀이하면 같은 사실이 두 번 읽힌다.
   */
  it('잠긴 사유를 폼 안에 적지 않는다', () => {
    renderForm({}, { isLocked: true });

    /* 짝 양성 — 폼은 실제로 그려졌고 잠겨 있다. */
    expect(screen.getByLabelText(t.fields.reasonCode)).toBeDisabled();
    expect(screen.queryByText(t.actionReasons.saving)).not.toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.alreadyRegistered)).not.toBeInTheDocument();
  });
});

/**
 * **상신 사유 칸을 두지 않는다**(D-8). 헤더 사유는 코드이고 상신 사유는 자유 텍스트라 서로
 * 다른 값이며, 상신은 이 회차의 범위가 아니다 — 칸을 두면 보낼 자리 없는 값을 받게 된다.
 */
describe('HeaderForm — 여기 없는 것', () => {
  it('자유 텍스트 입력칸이 없다', () => {
    renderForm();

    /* 짝 양성 — 이 폼에는 선택칸과 토글이 실제로 있다. */
    expect(screen.getByLabelText(t.fields.reasonCode)).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  /** 전표번호·상태는 서버가 정한다 — 칸을 두면 보낼 수 없는 값을 화면이 들고 있게 된다. */
  it('전표번호·상태 칸이 없다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.reasonCode)).toBeInTheDocument();
    expect(screen.queryByText(t.result.inventoryAdjustmentNo)).not.toBeInTheDocument();
    expect(screen.queryByText(t.result.statusCode)).not.toBeInTheDocument();
  });
});
