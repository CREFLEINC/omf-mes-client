import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { planItems, specItems, versionItems } from './fixtures';
import { asId, asOptionValue, ItemPicker, type PickerSlot } from './item-picker';

const t = messages.collectionChannel;

const slot = <TItem,>(items: TItem[], overrides: Partial<PickerSlot<TItem>> = {}) => ({
  items,
  truncated: false,
  isError: false,
  isLoading: false,
  ...overrides,
});

const renderPicker = (props: Partial<Parameters<typeof ItemPicker>[0]> = {}) =>
  render(
    <ItemPicker
      inspectionItemId={null}
      onChangeItem={() => undefined}
      inspectionPlanId={4001}
      onChangePlan={() => undefined}
      inspectionPlanVersionId={4101}
      onChangeVersion={() => undefined}
      plans={slot(planItems)}
      versions={slot(versionItems)}
      specs={slot(specItems)}
      channelUnitCode=""
      uomCodeById={new Map()}
      {...props}
    />,
  );

/**
 * ⛔ **불러오는 중에 「없다」고 말하지 않는다.** 받기 전에는 목록이 비어 있는 것이 정상인데,
 * 그때 「이 버전에는 아직 검사 항목이 없습니다」를 내면 **거짓을 한 번 보이고 지운다** —
 * 그 사이에 창을 닫은 사람은 없는 줄 알고 다른 길을 찾는다.
 */
describe('고르는 칸의 보조 문구', () => {
  it('불러오는 중에는 없다고 말하지 않는다', () => {
    renderPicker({ specs: slot([], { isLoading: true }) });

    expect(screen.queryByText(t.itemPicker.noItems)).not.toBeInTheDocument();
  });

  it('다 받았는데 비었으면 그때 말한다', () => {
    renderPicker({ specs: slot([]) });

    expect(screen.getByText(t.itemPicker.noItems)).toBeInTheDocument();
  });

  it('버전이 없으면 그 사실을 말한다', () => {
    renderPicker({ versions: slot([]) });

    expect(screen.getByText(t.itemPicker.noVersions)).toBeInTheDocument();
  });

  /** 실패가 잘림보다, 잘림이 「비었다」보다 앞선다 — 아무것도 못 받은 것이 가장 큰 사실이다. */
  it('불러오지 못했으면 잘림 대신 실패를 말한다', () => {
    renderPicker({ plans: slot([], { isError: true, truncated: true }) });

    expect(screen.getByText(t.itemPicker.plansLoadFailed)).toBeInTheDocument();
    expect(screen.queryByText(t.optionsTruncated)).not.toBeInTheDocument();
  });

  it('잘렸을 뿐이면 잘렸다고만 말한다', () => {
    renderPicker({ plans: slot(planItems, { truncated: true }) });

    expect(screen.getByText(t.optionsTruncated)).toBeInTheDocument();
    expect(screen.queryByText(t.itemPicker.plansLoadFailed)).not.toBeInTheDocument();
  });
});

/** ⛔ 읽을 수 없는 값을 식별자로 삼지 않는다 — 서버가 400으로 되받고 원인이 감춰진다. */
describe('고른 값과 식별자 옮기기', () => {
  it('고르지 않았으면 빈 값이다', () => {
    expect(asOptionValue(null)).toBe('');
  });

  it('식별자는 그대로 값이 된다', () => {
    expect(asOptionValue(5001)).toBe('5001');
  });

  it('빈 값은 고르지 않은 것이다', () => {
    expect(asId('')).toBeNull();
  });

  it('숫자로 읽을 수 없으면 고르지 않은 것으로 다룬다', () => {
    expect(asId('사이클 타임')).toBeNull();
  });

  it('정수가 아니면 고르지 않은 것으로 다룬다', () => {
    expect(asId('5001.5')).toBeNull();
  });

  it('읽을 수 있으면 식별자가 된다', () => {
    expect(asId('5001')).toBe(5001);
  });
});
