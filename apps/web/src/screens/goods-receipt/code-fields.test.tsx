import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodeFields } from './code-fields';
import { toCodeOptionSets, PLACEHOLDER_GOODS_RECEIPT_CODES } from './code-options';
import { EMPTY_CODE_DRAFT, type CodeDraft } from './types';
import { CODE_FIELD_NAMES } from './validation';

const t = messages.goodsReceipt;

const FILLED_SETS = toCodeOptionSets({
  receiptType: ['SAMPLE_RECEIPT_TYPE_A', 'SAMPLE_RECEIPT_TYPE_B'],
  sourceDocumentType: ['SAMPLE_SOURCE_TYPE_A'],
  qualityStatus: ['SAMPLE_QUALITY_A'],
  inventoryStatus: ['SAMPLE_INVENTORY_A'],
  reason: ['SAMPLE_REASON_A'],
});

const EMPTY_SETS = toCodeOptionSets(PLACEHOLDER_GOODS_RECEIPT_CODES);

const renderFields = (
  overrides: {
    options?: typeof FILLED_SETS;
    values?: CodeDraft;
    fieldErrors?: Record<string, string>;
    isLocked?: boolean;
  } = {},
) => {
  const onChange = vi.fn();

  render(
    <CodeFields
      options={overrides.options ?? EMPTY_SETS}
      values={overrides.values ?? EMPTY_CODE_DRAFT}
      fieldErrors={overrides.fieldErrors ?? {}}
      isLocked={overrides.isLocked ?? false}
      onChange={onChange}
    />,
  );

  return { onChange, user: userEvent.setup() };
};

const LABELS = [
  t.fields.receiptType,
  t.fields.sourceDocumentType,
  t.fields.qualityStatus,
  t.fields.inventoryStatus,
  t.fields.reason,
];

const PENDING_LABELS = [t.fields.receiptType, t.fields.qualityStatus, t.fields.reason];

describe('CodeFields — 칸 구성', () => {
  it('코드 다섯 칸이 요청 차례대로 선다', () => {
    renderFields();

    const comboboxes = screen.getAllByRole('combobox');

    expect(comboboxes).toHaveLength(5);
    /* 차례가 요청·확인 창과 같아야 사용자가 무엇을 확인했는지 맞춰 볼 수 있다. */
    expect(LABELS.map((label) => screen.getByRole('combobox', { name: label }))).toEqual(
      comboboxes,
    );
  });

  it('다섯 칸이 저마다 이름을 갖는다', () => {
    renderFields();

    for (const label of LABELS) {
      expect(screen.getByRole('combobox', { name: label })).toBeInTheDocument();
    }
  });
});

describe('CodeFields — 값 목록이 비어 있을 때', () => {
  /* 비어 있는 선택칸만 두면 고장으로 읽힌다. 왜 비었는지가 화면에서 읽혀야 한다. */
  it('운영 코드 세 칸은 왜 비었는지 밝히고 그 문구가 칸에 이어진다', () => {
    renderFields();

    expect(screen.getAllByText(messages.pendingCode.note)).toHaveLength(3);

    for (const label of PENDING_LABELS) {
      expect(screen.getByRole('combobox', { name: label })).toHaveAccessibleDescription(
        messages.pendingCode.note,
      );
    }

    for (const label of [t.fields.sourceDocumentType, t.fields.inventoryStatus]) {
      expect(screen.getByRole('combobox', { name: label })).not.toHaveAccessibleDescription(
        messages.pendingCode.note,
      );
    }
  });

  it('트리거가 준비 중임을 밝힌다', () => {
    renderFields();

    expect(screen.getAllByText(messages.pendingCode.placeholder)).toHaveLength(3);
  });
});

/**
 * **G1의 전환** — 자리표시 배열이 채워지면 이 부품은 고칠 것 없이 그대로 살아난다.
 * 채운 뒤에도 「준비 중」 안내가 남으면 화면이 거짓말을 한다.
 */
describe('CodeFields — 값 목록이 채워졌을 때', () => {
  it('준비 중 안내가 사라진다', () => {
    renderFields({ options: FILLED_SETS });

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();
    /* 짝 방향 — 칸 자체는 그대로 다섯이다. */
    expect(screen.getAllByRole('combobox')).toHaveLength(5);
  });

  it('선택지를 고르면 그 값이 그대로 올라간다', async () => {
    const { onChange, user } = renderFields({ options: FILLED_SETS });

    await user.click(screen.getByRole('combobox', { name: t.fields.receiptType }));
    await user.click(screen.getByRole('option', { name: 'SAMPLE_RECEIPT_TYPE_B' }));

    expect(onChange).toHaveBeenCalledWith('receiptType', 'SAMPLE_RECEIPT_TYPE_B');
  });

  it('고른 값이 트리거에 남는다', () => {
    renderFields({
      options: FILLED_SETS,
      values: { ...EMPTY_CODE_DRAFT, qualityStatus: 'SAMPLE_QUALITY_A' },
    });

    expect(screen.getByRole('combobox', { name: t.fields.qualityStatus })).toHaveTextContent(
      'SAMPLE_QUALITY_A',
    );
  });
});

describe('CodeFields — 오류와 잠금', () => {
  it('그 칸의 오류만 그 칸에 붙는다', () => {
    renderFields({
      options: FILLED_SETS,
      fieldErrors: { [CODE_FIELD_NAMES.qualityStatus]: t.errors.codeTooLong(50) },
    });

    expect(
      screen.getByRole('combobox', { name: t.fields.qualityStatus }),
    ).toHaveAccessibleDescription(t.errors.codeTooLong(50));
    /* 짝 방향 — 다른 칸에는 붙지 않는다. */
    expect(
      screen.getByRole('combobox', { name: t.fields.receiptType }),
    ).not.toHaveAccessibleDescription(t.errors.codeTooLong(50));
  });

  /* 전송 중에는 값을 바꿔도 이번 요청에 실리지 않는다 — 바꿀 수 있게 두면 무엇을 보냈는지 흐려진다. */
  it('전송 중에는 다섯 칸이 모두 잠긴다', () => {
    renderFields({ options: FILLED_SETS, isLocked: true });

    for (const box of screen.getAllByRole('combobox')) {
      expect(box).toBeDisabled();
    }
  });

  it('전송 중이 아니면 잠기지 않는다', () => {
    renderFields({ options: FILLED_SETS });

    for (const box of screen.getAllByRole('combobox')) {
      expect(box).not.toBeDisabled();
    }
  });
});
