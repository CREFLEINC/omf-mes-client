import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PLACEHOLDER_DISPOSAL_ISSUE_CODES, toCodeOptionSets } from './code-options';
import { DisposalForm, type DisposalFormProps } from './disposal-form';
import { EMPTY_DISPOSAL_DRAFT } from './types';
import { CODE_FIELD_NAMES } from './validation';

const t = messages.disposalIssue;

/** 값 목록이 확정된 뒤의 모양. **지금의 사실이 아니라 전환을 재기 위한 입력**이다. */
const FILLED_CODES = toCodeOptionSets({
  issueType: ['SAMPLE_GI_TYPE_A'],
  sourceDocumentType: ['SAMPLE_SRC_TYPE_A'],
  reason: ['SAMPLE_GI_REASON_A'],
  receiptType: [],
  status: [],
  issueStatus: [],
});

const noop = (): void => {
  /* 이 잣대가 보는 것이 아니다 — 부르는지는 그 잣대가 따로 잰다. */
};

const renderForm = (overrides: Partial<DisposalFormProps> = {}) =>
  render(
    <DisposalForm
      values={EMPTY_DISPOSAL_DRAFT}
      codeOptions={toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES)}
      fieldErrors={{}}
      isLocked={false}
      onChangeCode={noop}
      onChangeIssuedDate={noop}
      onChangeIssuedTime={noop}
      onChangeRemarks={noop}
      onChangeReason={noop}
      {...overrides}
    />,
  );

describe('DisposalForm 자리표시', () => {
  /** 값 목록이 비어 있는 동안 고를 것이 없다 — **왜 비었는지**가 화면에 있어야 한다. */
  it('값 목록이 비면 코드 셋이 잠기고 사유가 보인다', () => {
    renderForm();

    const boxes = screen.getAllByRole('combobox');

    expect(boxes).toHaveLength(3);

    for (const box of boxes) expect(box).toBeDisabled();

    expect(screen.getAllByText(messages.pendingCode.note).length).toBeGreaterThan(0);
  });

  /** **전환 감지기의 둘째 방향**(감지기 M53) — 채우면 살아나지 않는 자리표시는 죽은 가지다. */
  it('값 목록이 채워지면 코드 칸이 열린다', () => {
    renderForm({ codeOptions: FILLED_CODES });

    for (const box of screen.getAllByRole('combobox')) expect(box).toBeEnabled();
  });

  /**
   * **폐기 계정 칸이 없다 — 잠긴 칸조차 없다**(변경 통지 #124 ⛔ 「비활성이 아니라 없앱니다」).
   * 회계 계정은 MES 밖의 값이고, 잠근 채 두면 사용자는 언젠가 열릴 칸으로 읽는다.
   *
   * **도착지 유형 칸도 함께 없다.** 짝인 도착지 식별자를 공급할 자리가 사라져, 남겨 두면
   * 한쪽만 실린 본문이 만들어진다(#128 ⛔).
   *
   * 남은 셋을 이름으로 먼저 확인해 **짝 양성과 같은 시점**에 잰다 — 아직 아무것도 그려지지
   * 않은 화면에서 「없다」는 늘 참이다.
   */
  it.each(['폐기 계정', '도착지 유형'])('%s 칸이 없다', (label) => {
    renderForm({ codeOptions: FILLED_CODES });

    /* 짝 양성 — 남은 코드 칸 셋이 실제로 서 있다. */
    expect(screen.getByLabelText(t.formFields.issueType)).toBeInTheDocument();
    expect(screen.getByLabelText(t.formFields.sourceDocumentType)).toBeInTheDocument();
    expect(screen.getByLabelText(t.formFields.reason)).toBeInTheDocument();

    expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });
});

describe('DisposalForm 상신 사유', () => {
  /** **형식을 유도한다**(공유계약 A-12) — 예시와 보조 문구가 첫 줄의 노릇을 말한다. */
  it('사유 칸에 예시와 「첫 줄이 요약이 된다」가 붙는다', () => {
    renderForm();

    const reason = screen.getByLabelText(t.formFields.submitReason);

    expect(reason).toHaveAttribute('placeholder', t.form.reasonPlaceholder);
    expect(screen.getByText(t.form.reasonHelper)).toBeInTheDocument();
  });

  it('친 글자를 그대로 알린다', async () => {
    const onChangeReason = vi.fn();
    const user = userEvent.setup();

    renderForm({ onChangeReason });
    await user.type(screen.getByLabelText(t.formFields.submitReason), '가');

    expect(onChangeReason).toHaveBeenLastCalledWith('가');
  });

  /** 사유 오류는 **그 칸 아래**에 선다 — 폼이 길어 버튼 옆 사유만으로는 눈에 들어오지 않는다. */
  it('사유 오류가 그 칸에 붙는다', () => {
    renderForm({ fieldErrors: { reason: t.errors.reasonRequired } });

    const reason = screen.getByLabelText(t.formFields.submitReason);

    expect(screen.getByText(t.errors.reasonRequired)).toBeInTheDocument();
    expect(reason).toHaveAccessibleDescription(expect.stringContaining(t.errors.reasonRequired));
  });

  /** 「폐기 사유」(코드)와 「요청 사유」(문장)가 **다른 칸**이다 — 낱말이 비슷해 겹치기 쉽다. */
  it('폐기 사유 코드와 상신 사유가 서로 다른 칸이다', () => {
    renderForm({ codeOptions: FILLED_CODES });

    expect(screen.getByLabelText(t.formFields.reason)).not.toBe(
      screen.getByLabelText(t.formFields.submitReason),
    );
  });
});

describe('DisposalForm 출고 일시', () => {
  it('미리 채우는 값이 없다', () => {
    renderForm();

    expect(screen.getByLabelText(t.formFields.issuedTime)).toHaveValue('');
  });

  it('시각을 고치면 그 값을 알린다', () => {
    const onChangeIssuedTime = vi.fn();

    renderForm({ onChangeIssuedTime });
    fireEvent.change(screen.getByLabelText(t.formFields.issuedTime), {
      target: { value: '09:30' },
    });

    expect(onChangeIssuedTime).toHaveBeenCalledWith('09:30');
  });

  /** 두 칸이 한 값이라 오류도 **한 자리**에 한 번 선다 — 두 번 그리면 같은 말을 되풀이한다. */
  it('출고 일시 오류가 한 번만 서고 두 칸이 함께 가리킨다', () => {
    renderForm({ fieldErrors: { issuedAt: '출고 일시를 확인해 주세요' } });

    expect(screen.getAllByText('출고 일시를 확인해 주세요')).toHaveLength(1);
    expect(screen.getByLabelText(t.formFields.issuedDate)).toHaveAccessibleDescription(
      '출고 일시를 확인해 주세요',
    );
    expect(screen.getByLabelText(t.formFields.issuedTime)).toHaveAccessibleDescription(
      '출고 일시를 확인해 주세요',
    );
  });

  /** 사용자가 넣지 않은 값이 전표에 실린다 — 폼이 그 사실을 밝힌다. */
  it('영업일이 파생임을 밝힌다', () => {
    renderForm();

    expect(screen.getByText(t.form.businessDateDerived)).toBeInTheDocument();
  });
});

describe('DisposalForm 잠금', () => {
  /** **첫째 겹**이다 — 전송 중에 값이 바뀌면 확인한 것과 나가는 것이 갈린다. */
  it('전송 중에는 모든 칸이 잠긴다', () => {
    renderForm({ codeOptions: FILLED_CODES, isLocked: true });

    for (const box of screen.getAllByRole('combobox')) expect(box).toBeDisabled();

    expect(screen.getByLabelText(t.formFields.issuedTime)).toBeDisabled();
    expect(screen.getByLabelText(t.formFields.remarks)).toBeDisabled();
    expect(screen.getByLabelText(t.formFields.submitReason)).toBeDisabled();
  });
});

describe('DisposalForm 없는 것', () => {
  /** ERP 송신 토글을 두지 않는다(계획 결정 5) — **정하지 않았다는 사실만** 적는다. */
  it('ERP 송신 토글이 없고 그 사실을 밝힌다', () => {
    renderForm();

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByText(t.form.sendToErpNote)).toBeInTheDocument();
  });

  /** 코드 오류는 **계약 필드 이름**으로 온다 — 서버가 준 것과 화면이 잡은 것이 같은 칸에 붙는다. */
  it('코드 오류가 계약 필드 이름으로 그 칸에 붙는다', () => {
    renderForm({
      codeOptions: FILLED_CODES,
      fieldErrors: { [CODE_FIELD_NAMES.issueType]: '쓸 수 없는 코드입니다' },
    });

    expect(screen.getByLabelText(t.formFields.issueType)).toHaveAccessibleDescription(
      '쓸 수 없는 코드입니다',
    );
  });
});
