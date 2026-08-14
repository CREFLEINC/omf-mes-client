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

/** 폐기 거래처 선택지가 채워진 뒤의 모양 — **전환을 재기 위한 입력**이다. */
const FILLED_PARTNERS = [{ value: '9251', label: 'SAMPLE-PARTNER-01 · 합성 폐기업체 가' }];

/**
 * 선택지가 살아난 뒤의 두 값 — **목록과 안내가 함께 바뀐다.**
 *
 * 목록만 채우고 안내를 그대로 두면 「고를 수 있는데 준비 중이라 적힌」 칸이 된다. 두 값의
 * 짝을 여기 한 곳에 두어 시험마다 한쪽만 바꾸는 일이 없게 한다.
 */
const filledPartners = (): Partial<DisposalFormProps> => ({
  disposalPartnerOptions: FILLED_PARTNERS,
  disposalPartnerCondition: 'ready',
});

const renderForm = (overrides: Partial<DisposalFormProps> = {}) =>
  render(
    <DisposalForm
      values={EMPTY_DISPOSAL_DRAFT}
      codeOptions={toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES)}
      disposalPartnerOptions={[]}
      /* 지금의 사실 — 역할 코드가 미확정이라 선택지 조회가 나가지 않는다(화면이 정해 넘긴다). */
      disposalPartnerCondition="rolePending"
      fieldErrors={{}}
      isLocked={false}
      onChangeCode={noop}
      onChangeIssuedDate={noop}
      onChangeIssuedTime={noop}
      onChangeRemarks={noop}
      onToggleSelfDisposal={noop}
      onChangeDisposalPartner={noop}
      onChangeReason={noop}
      {...overrides}
    />,
  );

/** 코드 칸 셋 — **라벨로 집는다.** 도착지 선택칸이 생겨 「모든 선택칸」과 뜻이 갈렸다. */
const codeBoxes = (): HTMLElement[] => [
  screen.getByLabelText(t.formFields.issueType),
  screen.getByLabelText(t.formFields.sourceDocumentType),
  screen.getByLabelText(t.formFields.reason),
];

describe('DisposalForm 자리표시', () => {
  /** 값 목록이 비어 있는 동안 고를 것이 없다 — **왜 비었는지**가 화면에 있어야 한다. */
  it('값 목록이 비면 코드 셋이 잠기고 사유가 보인다', () => {
    renderForm();

    for (const box of codeBoxes()) expect(box).toBeDisabled();

    /* 선택칸은 **넷**이다 — 코드 셋과 폐기 거래처. 세지 않으면 칸이 늘거나 줄어도 조용하다. */
    expect(screen.getAllByRole('combobox')).toHaveLength(4);
    expect(screen.getAllByText(messages.pendingCode.note).length).toBeGreaterThan(0);
  });

  /** **전환 감지기의 둘째 방향**(감지기 M53) — 채우면 살아나지 않는 자리표시는 죽은 가지다. */
  it('값 목록이 채워지면 코드 칸이 열린다', () => {
    renderForm({ codeOptions: FILLED_CODES });

    for (const box of codeBoxes()) expect(box).toBeEnabled();
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

/**
 * **도착지 컨트롤 둘**(완료 조건 C15·C16 · 변경 통지 #128).
 *
 * ⛔ **③ 구획이 아니라 이 폼에 선다**(승인 기록 D-1 안 A). 계약이 도착지 짝을 전표 **생성**
 * 본문에서만 실어 나르고 전표 헤더를 고치는 경로가 없어(실측), 승인 뒤 시점에는 고른 값을
 * 보낼 통로가 아예 없다 — 거기 두면 사용자가 고른 거래처가 조용히 사라진다.
 */
describe('DisposalForm 도착지', () => {
  it('자체 폐기 체크와 폐기 거래처 선택칸이 있다', () => {
    renderForm();

    expect(screen.getByLabelText(t.formFields.selfDisposal)).not.toBeChecked();
    expect(screen.getByLabelText(t.formFields.disposalPartner)).toBeInTheDocument();
  });

  /**
   * **잠긴 사유가 접근 이름에 이어진다.** 잠긴 컨트롤은 포커스를 받지 못해 툴팁만으로는
   * 키보드·스크린리더 사용자가 닿을 수 없다 — 보이는 글자로 두고 `aria-describedby`로 잇는다.
   */
  it('선택지가 없으면 잠기고 왜 잠겼는지가 이름에 이어진다', () => {
    renderForm();

    const partner = screen.getByLabelText(t.formFields.disposalPartner);

    expect(partner).toBeDisabled();
    expect(partner).toHaveAccessibleDescription(expect.stringContaining(messages.pendingCode.note));
  });

  /** **전환의 둘째 방향** — 선택지가 차면 열리고 「준비 중」 안내가 사라진다. */
  it('선택지가 차면 열리고 안내를 거둔다', () => {
    renderForm(filledPartners());

    const partner = screen.getByLabelText(t.formFields.disposalPartner);

    expect(partner).toBeEnabled();
    expect(partner).not.toHaveAccessibleDescription(
      expect.stringContaining(messages.pendingCode.note),
    );
  });

  /**
   * **안내는 화면이 정해 넘긴다**(조건 줄의 창고 칸과 같은 형태).
   *
   * 선택칸이 비는 사정이 셋인데(역할 코드 미확정 · 조회 실패 · 목록 잘림) **뒤 둘은 조회를
   * 소유한 화면만 안다.** 부품이 목록 길이로 사유를 지어내면 「불러오지 못했는데 준비 중이라
   * 적힌」 칸이 되고, 사용자는 기다리면 열릴 것으로 읽는다.
   */
  it('화면이 준 사정에서 안내와 자리표시가 함께 나온다', () => {
    renderForm({ disposalPartnerCondition: 'failed' });

    const partner = screen.getByLabelText(t.formFields.disposalPartner);

    expect(partner).toHaveAccessibleDescription(expect.stringContaining(t.filters.lookupFailed));
    /* ⛔ **얼굴과 설명이 같은 사실을 말한다**(리뷰 Major B1) — 트리거가 「준비 중」이면 안 된다. */
    expect(partner).toHaveTextContent(t.form.partnerFailedPlaceholder);
    expect(partner).not.toHaveTextContent(messages.pendingCode.placeholder);
    expect(partner).toBeDisabled();
  });

  /**
   * **목록은 왔는데 0건**인 갈래. 「준비 중」과 갈라 둔다 — 이쪽은 기다려도 열리지 않는다.
   * 앞 회차에는 이 갈래에 **아무 설명도 서지 않았다**(리뷰 탐침 P-3).
   */
  it('0건이면 그 사실을 안내와 자리표시가 함께 말한다', () => {
    renderForm({ disposalPartnerCondition: 'empty' });

    const partner = screen.getByLabelText(t.formFields.disposalPartner);

    expect(partner).toHaveAccessibleDescription(expect.stringContaining(t.form.partnerEmptyNote));
    expect(partner).toHaveTextContent(t.form.partnerEmptyPlaceholder);
    expect(partner).not.toHaveTextContent(messages.pendingCode.placeholder);
  });

  /**
   * **낡은 목록이 남은 채 다시 부르기가 실패한 갈래.** 실제로 닿는다 — 캐시가 앞 응답을 들고
   * 있는 동안 재조회가 실패하면 **목록은 있는데 사정은 「실패」**다.
   *
   * 그때도 **사정이 정본이다.** 목록 길이로 잠금을 판정하면 안내는 「불러오지 못했습니다」인데
   * 칸은 열려 있는 어긋남이 된다 — 사용자는 낡은 목록에서 고르고도 무엇이 실패했는지 모른다.
   */
  it('낡은 목록이 남아 있어도 실패면 잠근다', () => {
    renderForm({ disposalPartnerOptions: FILLED_PARTNERS, disposalPartnerCondition: 'failed' });

    const partner = screen.getByLabelText(t.formFields.disposalPartner);

    expect(partner).toBeDisabled();
    expect(partner).toHaveAccessibleDescription(expect.stringContaining(t.filters.lookupFailed));
  });

  /** **오는 중에는 「없다」고 말하지 않는다** — 트리거가 그 사실만 적고 안내는 서지 않는다. */
  it('오는 중이면 불러오는 중이라 말한다', () => {
    renderForm({ disposalPartnerCondition: 'loading' });

    const partner = screen.getByLabelText(t.formFields.disposalPartner);

    expect(partner).toHaveTextContent(t.values.referenceLoading);
    expect(partner).not.toHaveAccessibleDescription(
      expect.stringContaining(t.form.partnerEmptyNote),
    );
  });

  /**
   * **선택지가 차 있어도 안내가 설 수 있다** — 잘린 목록이 그렇다(계약에 번호로 한 건을 받는
   * 경로가 없어 뒤쪽 거래처는 고를 길이 아예 없다). 목록 길이로 안내를 가르면 이 갈래가 사라진다.
   */
  it('선택지가 차 있어도 잘림 안내는 남는다', () => {
    renderForm({
      disposalPartnerOptions: FILLED_PARTNERS,
      disposalPartnerCondition: 'truncated',
    });

    const partner = screen.getByLabelText(t.formFields.disposalPartner);

    expect(partner).toBeEnabled();
    expect(partner).toHaveAccessibleDescription(expect.stringContaining(t.filters.lookupTruncated));
  });

  /**
   * **자리표시 문구도 함께 거둔다**(리뷰 Nit N2).
   *
   * 선택지가 찼는데 트리거에 「선택지 준비 중」이 남으면 **고를 수 있는 칸이 준비 중이라고
   * 말한다.** 안내(`note`)만 재고 자리표시를 재지 않으면 그 갈래가 비어 있다.
   */
  it('선택지가 차면 트리거의 자리표시 문구도 사라진다', () => {
    const { unmount } = renderForm();

    /* **그 칸의 트리거 안에서 본다** — 같은 문구가 잠긴 코드 칸 셋에도 서 있다. */
    expect(screen.getByLabelText(t.formFields.disposalPartner)).toHaveTextContent(
      messages.pendingCode.placeholder,
    );
    unmount();

    renderForm(filledPartners());

    expect(screen.getByLabelText(t.formFields.disposalPartner)).not.toHaveTextContent(
      messages.pendingCode.placeholder,
    );
  });

  /**
   * **체크하면 선택칸이 잠긴다**(#128 문면 「체크하면 비활성 · 값 비움」 앞쪽).
   *
   * 값을 비우는 뒤쪽은 화면의 상태 전이가 맡고(`withSelfDisposal`) 그 전이는 `types.test.ts`가
   * 잰다 — 여기서 재는 것은 **고를 수 없게 된다**는 사실이고, 잠근 사유가 「준비 중」과
   * 갈리는 것까지 함께 본다.
   */
  it('자체 폐기를 체크하면 선택지가 있어도 선택칸이 잠긴다', () => {
    renderForm({
      ...filledPartners(),
      values: { ...EMPTY_DISPOSAL_DRAFT, isSelfDisposal: true },
    });

    const partner = screen.getByLabelText(t.formFields.disposalPartner);

    expect(partner).toBeDisabled();
    expect(partner).toHaveAccessibleDescription(expect.stringContaining(t.form.selfDisposalChosen));
  });

  it('체크를 누르면 그 사실을 알린다', async () => {
    const onToggleSelfDisposal = vi.fn();
    const user = userEvent.setup();

    renderForm({ onToggleSelfDisposal });
    await user.click(screen.getByLabelText(t.formFields.selfDisposal));

    expect(onToggleSelfDisposal).toHaveBeenLastCalledWith(true);
  });

  /** 짝 방향 — 체크를 풀 때도 그 사실을 알린다. 한 방향만 이으면 풀리지 않는 체크가 된다. */
  it('체크를 풀면 그 사실도 알린다', async () => {
    const onToggleSelfDisposal = vi.fn();
    const user = userEvent.setup();

    renderForm({ values: { ...EMPTY_DISPOSAL_DRAFT, isSelfDisposal: true }, onToggleSelfDisposal });
    await user.click(screen.getByLabelText(t.formFields.selfDisposal));

    expect(onToggleSelfDisposal).toHaveBeenLastCalledWith(false);
  });

  /**
   * **서버가 준 거래처 오류가 그 칸에 붙는다**(리뷰 Minor M1).
   *
   * 이 슬라이스의 잣대는 「그 이름의 오류를 화면이 **보일 자리가 있는가**」다 — 칸이 생겼으니
   * 자리도 생겼다. 배너로만 보내면 「없는 거래처」류 400에서 사용자가 **어느 칸을 고쳐야
   * 하는지** 알 수 없다.
   */
  it('거래처 오류가 계약 필드 이름으로 그 칸에 붙는다', () => {
    renderForm({
      ...filledPartners(),
      fieldErrors: { destinationId: '폐기 역할이 없는 거래처입니다' },
    });

    expect(screen.getByLabelText(t.formFields.disposalPartner)).toHaveAccessibleDescription(
      expect.stringContaining('폐기 역할이 없는 거래처입니다'),
    );
  });

  /**
   * **승인 뒤에는 바꿀 수 없다는 사실을 폼이 밝힌다.** 통지는 이 컨트롤을 《승인 후》 구획에
   * 두라고 했으나 그 시점에 값을 보낼 계약 통로가 없어 발의 시점으로 옮겼다 — 옮겼다는 사실이
   * 화면에 없으면 사용자는 지금 고르지 않고 승인 뒤에 고르려 한다.
   */
  it('도착지가 승인 요청 때 함께 나간다는 사실을 밝힌다', () => {
    renderForm();

    expect(screen.getByText(t.form.destinationNote)).toBeInTheDocument();
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
    renderForm({
      ...filledPartners(),
      codeOptions: FILLED_CODES,
      isLocked: true,
    });

    for (const box of screen.getAllByRole('combobox')) expect(box).toBeDisabled();

    expect(screen.getByLabelText(t.formFields.issuedTime)).toBeDisabled();
    expect(screen.getByLabelText(t.formFields.remarks)).toBeDisabled();
    /* 도착지 컨트롤 **둘 다** 잠근다 — 한쪽만 잠그면 보내는 중에 짝이 바뀐다. */
    expect(screen.getByLabelText(t.formFields.selfDisposal)).toBeDisabled();
    expect(screen.getByLabelText(t.formFields.disposalPartner)).toBeDisabled();
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
