import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CapacityNote } from './capacity-note';
import type { LocationCapacity } from './lookups';
import { emptyRuleFormValues, ruleToFormValues } from './rule-draft';
import { RULE_WITH_LOCATION } from './fixtures';
import { RuleFormPane, type RuleFormPaneProps } from './rule-form-pane';
import type { SelectOption } from './types';

const t = messages.putawayRule;

const warehouseOptions: SelectOption[] = [{ value: '9201', label: 'SYN-WH-01 · 합성창고 가' }];
const uomOptions: SelectOption[] = [{ value: '9401', label: 'SYN-UOM-01 · 합성단위 가' }];
const locationChoices: SelectOption[] = [
  { value: '', label: t.values.warehouseWide },
  { value: '9301', label: 'SYN-LOC-01 · 합성위치 가' },
];

const CAPACITY: LocationCapacity = { locationId: 9301, capacityQty: 400, capacityUomId: 9401 };

const renderPane = (overrides: Partial<RuleFormPaneProps> = {}) => {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const onOpenItemPicker = vi.fn();

  render(
    <RuleFormPane
      mode="create"
      values={emptyRuleFormValues('9201')}
      onChange={onChange}
      itemLabel={t.values.unknown}
      warehouseLabel="SYN-WH-01 · 합성창고 가"
      onOpenItemPicker={onOpenItemPicker}
      fieldErrors={{}}
      banner={null}
      warehouseOptions={warehouseOptions}
      locationChoices={locationChoices}
      locationDisabledReason={null}
      uomOptions={uomOptions}
      capacityNote={{ kind: 'none' }}
      uomLabel={() => 'SYN-UOM-01 · 합성단위 가'}
      duplicateUnknownNote={null}
      saveDisabledReason={null}
      isDirty={false}
      isLocked={false}
      isSaving={false}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onChange, onSave, onCancel, onOpenItemPicker, user: userEvent.setup() };
};

const editValues = ruleToFormValues(RULE_WITH_LOCATION);

describe('RuleFormPane — 등록과 수정이 갈리는 자리', () => {
  it('등록에서는 창고를 고를 수 있고 품목 찾기 버튼이 선다', () => {
    renderPane();

    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.openItemPicker })).toBeInTheDocument();
  });

  /**
   * C3-2 — 계약의 수정 본문에 품목·창고 키가 아예 없다. **잠근 채 사유를 말하지 않으면
   * 사용자에게 고장으로 읽힌다.**
   */
  it('수정에서는 품목·창고를 고칠 수 없고 사유가 함께 선다', () => {
    renderPane({ mode: 'edit', values: editValues, itemLabel: 'SYN-ITEM-01 · 합성품목 가' });

    expect(screen.queryByRole('combobox', { name: t.fields.warehouse })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.actions.openItemPicker }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(t.notes.itemFixed)).toBeInTheDocument();
  });

  /** 잠갔더라도 **값은 보여야 한다** — 무엇을 고치고 있는지 알 수 없으면 폼이 뜻을 잃는다. */
  it('수정에서 잠긴 두 칸의 값이 보인다', () => {
    renderPane({ mode: 'edit', values: editValues, itemLabel: 'SYN-ITEM-01 · 합성품목 가' });

    expect(screen.getByLabelText(t.fields.item)).toHaveTextContent('SYN-ITEM-01 · 합성품목 가');
    expect(screen.getByLabelText(t.fields.warehouse)).toHaveTextContent('SYN-WH-01 · 합성창고 가');
  });

  it('등록의 주 액션 이름이 수정과 다르다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: t.actions.submitCreate })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.save })).not.toBeInTheDocument();
  });

  /** 수정에서 「취소」는 되돌리는 조작이라 고친 것이 있을 때만 뜻이 있다. */
  it('수정에서 고친 것이 없으면 취소가 잠긴다', () => {
    renderPane({ mode: 'edit', values: editValues, isDirty: false });

    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled();
  });

  /** 등록에서 「취소」는 폼을 닫는 것이라 고친 것이 없어도 눌러야 한다. */
  it('등록에서는 고친 것이 없어도 취소를 누를 수 있다', () => {
    renderPane({ isDirty: false });

    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeEnabled();
  });
});

describe('RuleFormPane — 필수 표시와 위치의 뜻', () => {
  it('용량·단위·우선순위가 필수로 표시된다', () => {
    renderPane();

    expect(screen.getByLabelText(t.fields.capacity)).toBeRequired();
    expect(screen.getByLabelText(t.fields.priorityNo)).toBeRequired();
    expect(screen.getByRole('combobox', { name: t.fields.uom })).toHaveAttribute('aria-required');
  });

  /** 비고는 계약이 널을 허용한다 — 비우는 것이 정상 값이라 필수 표시를 붙이지 않는다. */
  it('비고는 필수가 아니다', () => {
    renderPane();

    expect(screen.getByLabelText(t.fields.remarks)).not.toBeRequired();
  });

  /** 비운 위치는 **확정된 뜻**이다 — 말하지 않으면 「고르다 만 것」으로 읽힌다. */
  it('위치를 비우면 창고 전체라는 안내가 상시 선다', () => {
    renderPane();

    expect(screen.getByText(t.notes.locationEmptyMeansWarehouseWide)).toBeInTheDocument();
  });

  /** 우선순위 방향은 데이터에 적혀 있지 않고 계약이 정한 것이라 화면이 말해야 한다. */
  it('우선순위 방향을 말한다', () => {
    renderPane();

    expect(screen.getByText(t.notes.priorityDirection)).toBeInTheDocument();
  });

  /** C3-4 — 자리표시가 비어 있는 동안 위치 입력이 열리고 그 사정을 안내가 밝힌다. */
  it('관리수준이 정해지지 않았다는 안내가 서면서도 위치 칸은 열려 있다', () => {
    renderPane({ locationPendingNote: t.notes.managementLevelPending });

    expect(screen.getByText(t.notes.managementLevelPending)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.location })).toBeEnabled();
  });

  /** 값이 채워진 뒤에는 잠기되 **사유가 함께** 선다. */
  it('위치 입력이 잠기면 사유가 함께 보인다', () => {
    renderPane({ locationDisabledReason: t.notes.managementLevelPending });

    expect(screen.getByRole('combobox', { name: t.fields.location })).toBeDisabled();
    expect(screen.getByText(t.notes.managementLevelPending)).toBeInTheDocument();
  });
});

describe('RuleFormPane — 위치 자체 용량 (C3-6 · C3-7)', () => {
  /** C3-7 — 견줄 값이 없으면 **아무 말도 하지 않는다.** */
  it('견줄 위치 용량이 없으면 값도 경고도 내지 않는다', () => {
    renderPane({ capacityNote: { kind: 'none' } });

    expect(screen.queryByText(/이 위치의 용량/)).not.toBeInTheDocument();
    expect(screen.queryByText(t.notes.locationCapacityOver)).not.toBeInTheDocument();
  });

  /** Q4 — 계약이 값을 주므로 **실값으로** 나란히 보인다. */
  it('넘지 않으면 실값만 보인다', () => {
    const capacityNote: CapacityNote = { kind: 'plain', capacity: CAPACITY };

    renderPane({ capacityNote });

    expect(
      screen.getByText(t.notes.locationCapacity('400', 'SYN-UOM-01 · 합성단위 가')),
    ).toBeInTheDocument();
    expect(screen.queryByText(t.notes.locationCapacityOver)).not.toBeInTheDocument();
  });

  /**
   * C3-6 — 넘으면 경고가 서되 **저장은 그대로 된다.** 저장 자리가 열려 있음을 함께 잰다 —
   * 경고와 차단을 한 축으로 합치면 이 화면이 없는 규칙을 지어낸다(`omf-mes#84`).
   */
  it('넘으면 경고가 서고 저장 버튼은 열려 있다', () => {
    const capacityNote: CapacityNote = { kind: 'over', capacity: CAPACITY };

    renderPane({ capacityNote, mode: 'edit', values: editValues, isDirty: true });

    expect(screen.getByText(t.notes.locationCapacityOver)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.save })).toBeEnabled();
  });

  /** 단위가 다르면 실값은 보이되 **견주지 않았다**고 말한다. */
  it('단위가 다르면 사유를 낸다', () => {
    const capacityNote: CapacityNote = { kind: 'unitMismatch', capacity: CAPACITY };

    renderPane({ capacityNote });

    expect(
      screen.getByText(t.notes.locationCapacity('400', 'SYN-UOM-01 · 합성단위 가')),
    ).toBeInTheDocument();
    expect(screen.getByText(t.notes.locationCapacityUnitMismatch)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.locationCapacityOver)).not.toBeInTheDocument();
  });
});

describe('RuleFormPane — 저장 자리의 네 상태', () => {
  it('열려 있으면 눌러 저장한다', async () => {
    const { onSave, user } = renderPane({ mode: 'edit', values: editValues, isDirty: true });

    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('막혔으면 사유와 함께 잠긴다', () => {
    renderPane({ saveDisabledReason: t.actionReasons.duplicateActive });

    expect(screen.getByRole('button', { name: t.actions.submitCreate })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.duplicateActive)).toBeInTheDocument();
  });

  /**
   * G-30 ① **가릴 것은 대상에만** — 내 저장이 나가는 중이면 진행 표시가 사유 자리를 대신한다.
   * 두 사실(내 저장 / 남의 저장)을 한 문구로 뭉개지 않는다.
   */
  it('내 저장이 나가는 중이면 진행 표시가 돌고 남의 저장 사유를 내지 않는다', () => {
    renderPane({ isLocked: true, isSaving: true });

    expect(screen.getByRole('button', { name: t.actions.submitCreate })).toBeDisabled();
    expect(screen.queryByText(t.actionReasons.createLockedByOtherSave)).not.toBeInTheDocument();
  });

  /** G-30 ② **막을 것은 전역** — 남의 저장이 나가는 중이면 잠그되 무엇을 기다리는지 밝힌다. */
  it('남의 저장이 나가는 중이면 사유와 함께 잠기고 진행 표시를 돌지 않는다', () => {
    renderPane({ isLocked: true, isSaving: false });

    expect(screen.getByText(t.actionReasons.createLockedByOtherSave)).toBeInTheDocument();
    expect(screen.getByText(t.notes.savingLock)).toBeInTheDocument();
  });

  /** 저장 자리의 이름과 사유는 **한 쌍**이다 — 한쪽만 바꾸면 이름과 사유가 어긋난 짝이 생긴다. */
  it('수정에서 잠긴 사유가 저장 이름으로 시작한다', () => {
    renderPane({ mode: 'edit', values: editValues, isLocked: true });

    expect(screen.getByText(t.actionReasons.saveLockedByOtherSave)).toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.createLockedByOtherSave)).not.toBeInTheDocument();
  });

  /** 취소도 함께 잠긴다 — 나가는 중에 초안이 되돌아가면 무엇이 저장됐는지 알 수 없다. */
  it('나가는 중에는 취소도 사유와 함께 잠긴다', () => {
    renderPane({ isLocked: true });

    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.cancelLockedByOtherSave)).toBeInTheDocument();
  });

  /** 나가는 중에는 **입력칸도 창 열기도** 잠긴다 — 확인한 것과 다른 것이 저장되면 안 된다. */
  it('나가는 중에는 입력칸과 품목 찾기가 잠긴다', () => {
    renderPane({ isLocked: true });

    expect(screen.getByLabelText(t.fields.capacity)).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.openItemPicker })).toBeDisabled();
  });
});

describe('RuleFormPane — 인라인 오류와 중복 안내', () => {
  it('필드 오류가 그 칸 옆에 선다', () => {
    renderPane({ fieldErrors: { capacityQty: t.validation.capacityNotPositive } });

    expect(screen.getByText(t.validation.capacityNotPositive)).toBeInTheDocument();
  });

  /** 품목은 입력칸이 아니라 창으로 고르므로 **오류가 설 자리를 따로 둔다.** */
  it('품목 오류가 보인다', () => {
    renderPane({ fieldErrors: { itemId: t.validation.itemRequired } });

    expect(screen.getByText(t.validation.itemRequired)).toBeInTheDocument();
  });

  /** C3-9 — 판정하지 못했다는 사실은 말하되 저장을 막지 않는다. */
  it('중복을 판정하지 못했다는 안내가 서도 저장은 열려 있다', () => {
    renderPane({ duplicateUnknownNote: t.notes.duplicateUnknown, saveDisabledReason: null });

    expect(screen.getByText(t.notes.duplicateUnknown)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.submitCreate })).toBeEnabled();
  });

  it('입력하면 그 칸의 값만 위로 올린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText(t.fields.capacity), '5');

    expect(onChange).toHaveBeenCalledWith({ capacityQty: '5' });
  });

  it('품목 찾기를 누르면 창을 연다', async () => {
    const { onOpenItemPicker, user } = renderPane();

    await user.click(screen.getByRole('button', { name: t.actions.openItemPicker }));

    expect(onOpenItemPicker).toHaveBeenCalledTimes(1);
  });
});
