import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { toCodeOptionSets, PLACEHOLDER_SUPPLIER_RETURN_CODES } from './code-options';
import { INTERNAL_IDS, PARTNER_LABEL, partnerFixtures } from './fixtures';
import { ReturnForm, type ReturnFormProps } from './return-form';
import { EMPTY_RETURN_DRAFT, type SelectOption } from './types';
import { CODE_FIELD_NAMES } from './validation';

const t = messages.supplierReturn;

const SUPPLIER_OPTIONS: SelectOption[] = partnerFixtures.map((partner) => ({
  value: String(partner.partnerId),
  label: `${partner.partnerCode} · ${partner.partnerName}`,
}));

/** 값 목록이 확정된 뒤의 모양. **지금의 사실이 아니라 전환을 재기 위한 입력**이다. */
const FILLED_CODES = toCodeOptionSets({
  issueType: ['SAMPLE_ISSUE_TYPE_A'],
  sourceDocumentType: ['SAMPLE_SOURCE_TYPE_A'],
  destinationType: ['SAMPLE_DESTINATION_TYPE_A'],
  reason: ['SAMPLE_REASON_A'],
  receiptType: [],
  status: [],
});

/** 출고 일자 칸의 트리거. 달력 위젯이라 **라벨로** 집는다 — 트리거에는 보이는 글자가 없다. */
const issuedDateTrigger = (): HTMLElement => screen.getByLabelText(t.fields.issuedDate);

/**
 * 시각 입력칸에 값을 넣는다.
 *
 * **글자 단위로 치지 않는다** — `type="time"`은 시·분 세그먼트를 따로 받아 `09:12`를 그대로
 * 치면 마지막 글자만 분에 남는다. 이 잣대가 보려는 것은 세그먼트 조작이 아니라 **칸이 바뀌면
 * 그 값을 그대로 알리는가**이므로 값을 통째로 넣는다.
 */
const setIssuedTime = (value: string): void => {
  fireEvent.change(screen.getByLabelText(t.fields.issuedTime), { target: { value } });
};

const noop = (): void => {
  /* 이 잣대가 보는 것이 아니다 — 부르는지는 그 잣대가 따로 잰다. */
};

const renderForm = (overrides: Partial<ReturnFormProps> = {}) =>
  render(
    <ReturnForm
      values={EMPTY_RETURN_DRAFT}
      supplierOptions={SUPPLIER_OPTIONS}
      hasSupplierError={false}
      codeOptions={toCodeOptionSets(PLACEHOLDER_SUPPLIER_RETURN_CODES)}
      fieldErrors={{}}
      isLocked={false}
      onChangeSupplier={noop}
      onChangeCode={noop}
      onChangeIssuedDate={noop}
      onChangeIssuedTime={noop}
      onChangeReplacementExpected={noop}
      onChangeSendToErp={noop}
      onChangeRemarks={noop}
      onRetrySupplierOptions={noop}
      {...overrides}
    />,
  );

describe('ReturnForm — 반품 정보 구획', () => {
  it('여덟 칸의 라벨이 보인다', () => {
    renderForm();

    for (const label of [
      t.fields.supplier,
      t.fields.issueType,
      t.fields.sourceDocumentType,
      t.fields.destinationType,
      t.fields.reason,
      t.fields.issuedDate,
      t.fields.issuedTime,
      t.fields.remarks,
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByLabelText(t.fields.replacementExpected)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.sendToErp)).toBeInTheDocument();
  });

  /*
   * **M43의 짝** — 반품 정보를 창에 넣지 않고 구획에 두는 이유가 이 선택칸 다섯이다.
   * 창에 넣으면 창 본문이 펼침 목록을 자르는 결함(#45)에 정면으로 걸린다.
   */
  it('선택칸이 다섯이다 — 공급사와 코드 넷', () => {
    renderForm();

    expect(screen.getAllByRole('combobox')).toHaveLength(5);
  });

  it('공급사를 이름으로 고르고 내부 번호를 내지 않는다', () => {
    const { container } = renderForm({
      values: { ...EMPTY_RETURN_DRAFT, supplier: '9901' },
    });

    expect(container.textContent ?? '').toContain(PARTNER_LABEL);

    for (const id of INTERNAL_IDS) {
      expect(container.textContent ?? '').not.toContain(id);
    }
  });

  /*
   * **M41의 부품 쪽 짝** — 값 목록이 비어 있는 동안에는 자리표시와 사유가 붙고, 배열이 차면
   * 그 자리에 실제 선택지가 선다. 잠금을 상수로 굳히면 이 전환이 관측되지 않는다.
   */
  it('코드 선택지가 비어 있으면 자리표시와 사유가 붙는다', () => {
    renderForm();

    expect(screen.getAllByText(messages.pendingCode.note)).toHaveLength(2);
    expect(screen.getAllByText(messages.pendingCode.placeholder).length).toBeGreaterThan(0);
  });

  it('코드 선택지가 차면 자리표시와 사유가 사라진다', () => {
    renderForm({ codeOptions: FILLED_CODES });

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();
    expect(screen.queryByText(messages.pendingCode.placeholder)).not.toBeInTheDocument();
  });

  /*
   * **M33(첫째 겹)** — 전송 중에는 컨트롤이 잠긴다. 핸들러 가드(둘째 겹)만 두고 이 겹을 떼면
   * 사용자가 보내는 중에 값을 고칠 수 있고, 화면은 확인한 것과 다른 값을 보낸 것처럼 보인다.
   */
  it('전송 중에는 모든 입력칸이 잠긴다', () => {
    renderForm({ isLocked: true, codeOptions: FILLED_CODES });

    for (const control of screen.getAllByRole('combobox')) {
      expect(control).toBeDisabled();
    }

    expect(screen.getByLabelText(t.fields.issuedTime)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.remarks)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.replacementExpected)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.sendToErp)).toBeDisabled();
    expect(issuedDateTrigger()).toBeDisabled();
  });

  /** 짝 방향 — 잠기지 않았으면 열려 있다. */
  it('전송 중이 아니면 입력칸이 열려 있다', () => {
    renderForm({ codeOptions: FILLED_CODES });

    for (const control of screen.getAllByRole('combobox')) {
      expect(control).not.toBeDisabled();
    }

    expect(screen.getByLabelText(t.fields.issuedTime)).not.toBeDisabled();
  });

  it('코드 칸의 오류가 그 칸에 붙는다', () => {
    renderForm({
      codeOptions: FILLED_CODES,
      fieldErrors: { [CODE_FIELD_NAMES.reason]: '서버가 준 사유 오류' },
    });

    expect(screen.getByText('서버가 준 사유 오류')).toBeInTheDocument();
  });

  it('공급사 오류가 그 칸에 붙는다', () => {
    renderForm({ fieldErrors: { destinationId: '서버가 준 공급사 오류' } });

    expect(screen.getByText('서버가 준 공급사 오류')).toBeInTheDocument();
  });

  /*
   * **날짜와 시각 두 칸이 한 값이다.** 오류를 각자 그리면 같은 문장이 두 번 서고, 그때 두
   * 문장의 `id`가 달라 날짜 칸이 자기 오류를 가리킬 수 없다.
   */
  it('출고 일시 오류가 한 번만 그려지고 두 칸이 함께 그것을 가리킨다', () => {
    renderForm({ fieldErrors: { issuedAt: '서버가 준 일시 오류' } });

    const errors = screen.getAllByText('서버가 준 일시 오류');

    expect(errors).toHaveLength(1);

    const errorId = errors[0]?.getAttribute('id') ?? '';

    expect(errorId).not.toBe('');
    expect(screen.getByLabelText(t.fields.issuedTime)).toHaveAttribute('aria-describedby', errorId);
    expect(issuedDateTrigger()).toHaveAttribute('aria-describedby', errorId);
  });

  it('비고 오류가 그 칸에 붙는다', () => {
    renderForm({ fieldErrors: { remarks: '서버가 준 비고 오류' } });

    expect(screen.getByText('서버가 준 비고 오류')).toBeInTheDocument();
  });

  /* **C43의 화면 쪽 근거** — 기본이 켜짐이다(착수 이슈 §4가 그렇게 정했다). */
  it('ERP 송신이 켜진 채로 시작하고 대체입고 예정은 꺼져 있다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.sendToErp)).toBeChecked();
    expect(screen.getByLabelText(t.fields.replacementExpected)).not.toBeChecked();
  });

  it('토글을 누르면 그 값을 알린다', async () => {
    const user = userEvent.setup();
    const onChangeSendToErp = vi.fn();
    const onChangeReplacementExpected = vi.fn();

    renderForm({ onChangeSendToErp, onChangeReplacementExpected });

    await user.click(screen.getByLabelText(t.fields.sendToErp));
    await user.click(screen.getByLabelText(t.fields.replacementExpected));

    expect(onChangeSendToErp).toHaveBeenCalledWith(false);
    expect(onChangeReplacementExpected).toHaveBeenCalledWith(true);
  });

  it('시각과 비고에 친 글자를 그대로 알린다', async () => {
    const user = userEvent.setup();
    const onChangeIssuedTime = vi.fn();
    const onChangeRemarks = vi.fn();

    renderForm({ onChangeIssuedTime, onChangeRemarks });

    setIssuedTime('09:12');
    await user.type(screen.getByLabelText(t.fields.remarks), '가');

    expect(onChangeIssuedTime).toHaveBeenCalledWith('09:12');
    expect(onChangeRemarks).toHaveBeenCalledWith('가');
  });

  /*
   * **사용자가 넣지 않은 값이 전표에 실린다**(영업일). 그 사실을 폼에서 밝히지 않으면
   * 확인 창에서 처음 보게 된다.
   */
  it('영업일이 파생값이라는 사실과 두 토글의 한계를 밝힌다', () => {
    renderForm();

    expect(screen.getByText(t.notes.businessDateDerived)).toBeInTheDocument();
    expect(screen.getByText(t.notes.replacementExpectedNote)).toBeInTheDocument();
    expect(screen.getByText(t.notes.sendToErpNote)).toBeInTheDocument();
  });

  /* **M49** — 공급사 목록이 잘리면 그 사실을 밝힌다. 계약에 번호로 한 건을 받는 경로가 없다. */
  it('공급사 목록이 잘렸다는 안내를 그대로 낸다', () => {
    renderForm({ supplierNote: t.reasons.partnersTruncated });

    expect(screen.getByText(t.reasons.partnersTruncated)).toBeInTheDocument();
  });

  it('잘리지 않았으면 그 안내가 없다', () => {
    renderForm();

    expect(screen.queryByText(t.reasons.partnersTruncated)).not.toBeInTheDocument();
  });

  it('공급사 목록이 실패하면 사유와 복구 수단을 함께 낸다', async () => {
    const user = userEvent.setup();
    const onRetrySupplierOptions = vi.fn();

    renderForm({ hasSupplierError: true, onRetrySupplierOptions });

    expect(screen.getByText(t.reasons.partnersFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetrySupplierOptions).toHaveBeenCalledTimes(1);
  });

  it('실패하지 않았으면 복구 수단을 내지 않는다', () => {
    renderForm();

    expect(screen.queryByText(t.reasons.partnersFailed)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});

/**
 * **보조 문구와 오류가 함께 있으면 둘 다 접근 이름에 잇는다**(R3-3).
 *
 * **오늘 도달 가능한 상태다** — 공급사 칸은 거래처 목록 잘림 안내(`note`)와 서버가 준 도착지
 * 오류(`error`)를 **함께** 받을 수 있다. 하나만 이으면 나머지가 화면에는 보이는데 **이름에서
 * 사라져**, 스크린리더 사용자에게는 잘림 안내가 통째로 없는 것과 같다.
 */
describe('ReturnForm — 보조 문구와 오류가 함께 있을 때', () => {
  const supplierBox = (): HTMLElement => screen.getByRole('combobox', { name: t.fields.supplier });

  it('둘 다 접근 이름에 이어진다', () => {
    renderForm({
      supplierNote: t.reasons.partnersTruncated,
      fieldErrors: { destinationId: '합성 공급사 오류' },
    });

    /* 짝 방향 — 둘 다 화면에도 실제로 있다(이름에만 있고 글자가 없으면 안 된다). */
    expect(screen.getByText(t.reasons.partnersTruncated)).toBeInTheDocument();
    expect(screen.getByText('합성 공급사 오류')).toBeInTheDocument();

    expect(supplierBox()).toHaveAccessibleDescription(
      expect.stringContaining(t.reasons.partnersTruncated),
    );
    expect(supplierBox()).toHaveAccessibleDescription(expect.stringContaining('합성 공급사 오류'));
  });

  it('하나만 있으면 그것만 이어진다', () => {
    renderForm({ supplierNote: t.reasons.partnersTruncated });

    expect(supplierBox()).toHaveAccessibleDescription(t.reasons.partnersTruncated);
  });
});
