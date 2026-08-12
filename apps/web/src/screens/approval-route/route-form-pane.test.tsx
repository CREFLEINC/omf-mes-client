import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BUSINESS_UNIT_LABEL, routeFormValuesFixture, routeViewFixtures } from './fixtures';
import { RouteFormPane, type RouteFormPaneProps } from './route-form-pane';
import { emptyRouteFormValues } from './route-request';
import type { RouteView } from './types';

const t = messages.approvalRoute;

const [withUnit, allUnits, inactiveRoute] = routeViewFixtures as [RouteView, RouteView, RouteView];

const BUSINESS_UNIT_OPTIONS = [{ value: '9101', label: BUSINESS_UNIT_LABEL }];

const renderPane = (overrides: Partial<RouteFormPaneProps> = {}) => {
  const props: RouteFormPaneProps = {
    mode: 'edit',
    route: withUnit,
    values: routeFormValuesFixture,
    onChange: vi.fn(),
    fieldErrors: {},
    banner: null,
    approvalTypeOptions: [],
    businessUnitOptions: BUSINESS_UNIT_OPTIONS,
    duplicateUnknownNote: null,
    onOpenExisting: null,
    saveDisabledReason: null,
    activateDisabledReason: null,
    isDirty: true,
    isLocked: false,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onDeactivate: vi.fn(),
    onActivate: vi.fn(),
    ...overrides,
  };

  return { ...render(<RouteFormPane {...props} />), props };
};

describe('RouteFormPane — 읽기 표기', () => {
  it('승인 유형·사용 여부·단계 수를 낸다', () => {
    renderPane();

    expect(screen.getByText('SAMPLE-TYPE-A')).toBeInTheDocument();
    expect(screen.getByText(t.values.active)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  /** 계약의 수정 본문에 승인 유형이 없다 — 왜 못 고치는지를 밝히지 않으면 결함으로 읽힌다. */
  it('승인 유형을 고칠 수 없다는 사실을 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.notes.approvalTypeFixed)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.approvalTypeCode)).toBeNull();
  });

  it('단계가 0이면 표식을 낸다', () => {
    renderPane({ route: allUnits });

    expect(screen.getByText(t.values.noSteps)).toBeInTheDocument();
  });

  it('미사용 결재선은 그 사실을 낸다', () => {
    renderPane({ route: inactiveRoute });

    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
  });

  it('어디에도 내부 번호가 없다', () => {
    const { container } = renderPane();

    // 선행 단언 — 값이 실제로 그려져야 「번호가 없다」가 뜻을 갖는다.
    expect(screen.getByText('SAMPLE-TYPE-A')).toBeInTheDocument();
    expect(container.textContent).not.toContain('9001');
    expect(container.textContent).not.toContain('9101');
  });
});

describe('RouteFormPane — 진행 중 건수 상시 표시', () => {
  /**
   * 진행 중 건수를 사용 중지 확인 창에만 두면, 결재선을 **고치는** 사람은 자기가 무엇에
   * 영향을 주지 *않는지*를 끝내 모른다. 그래서 상시 자리에 둔다.
   */
  it('진행 중인 요청이 있으면 건수와 함께 그 요청들이 옛 결재선으로 끝난다고 말한다', () => {
    renderPane();

    expect(screen.getByText(t.notes.inProgressSome(3))).toBeInTheDocument();
  });

  it('진행 중인 요청이 없어도 그 사실을 말한다', () => {
    renderPane({ route: allUnits });

    expect(screen.getByText(t.notes.inProgressNone)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.inProgressSome(0))).not.toBeInTheDocument();
  });

  it('건수를 응답 값에서 가져온다', () => {
    renderPane({ route: { ...withUnit, inProgressCount: 7 } });

    expect(screen.getByText(t.notes.inProgressSome(7))).toBeInTheDocument();
  });

  /**
   * **사용 중지된 결재선에서야말로 이 문구가 필요하다.** 끄기 확인 창은 닫히면 사라지지만
   * 이 자리는 남는다 — 사용 여부로 가리면 문구가 존재하는 이유 그 자체가 사라진다.
   */
  it('사용 중지된 결재선에서도 진행 중 안내가 남는다', () => {
    renderPane({ route: { ...inactiveRoute, inProgressCount: 2 } });

    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
    expect(screen.getByText(t.notes.inProgressSome(2))).toBeInTheDocument();
  });

  /** 등록에는 아직 자원이 없다 — 없는 건수를 0으로 채워 보이면 사용자가 자료로 읽는다. */
  it('등록 폼에는 진행 중 안내가 없다', () => {
    renderPane({ mode: 'create', route: null, values: emptyRouteFormValues() });

    expect(screen.queryByText(t.notes.inProgressNone)).not.toBeInTheDocument();
    expect(screen.queryByText(t.values.active)).not.toBeInTheDocument();
  });
});

describe('RouteFormPane — 비움 경고 (전체 교체의 뜻)', () => {
  it('사업부를 비우면 전 사업부 공통이 된다고 말한다', () => {
    renderPane({ values: { ...routeFormValuesFixture, businessUnitId: '' } });

    expect(screen.getByText(t.notes.businessUnitEmpty)).toBeInTheDocument();
  });

  /** 짝 방향 — 채웠을 때 문구가 사라지지 않으면 안내가 배경이 되어 읽히지 않는다. */
  it('사업부를 채우면 그 문구가 사라진다', () => {
    renderPane();

    expect(screen.queryByText(t.notes.businessUnitEmpty)).not.toBeInTheDocument();
  });

  it('값 구간을 둘 다 비우면 전 구간이 된다고 말한다', () => {
    renderPane({ values: { ...routeFormValuesFixture, minValue: '', maxValue: '' } });

    expect(screen.getByText(t.notes.valueRangeEmpty)).toBeInTheDocument();
  });

  it('값 구간을 한쪽이라도 채우면 그 문구가 사라진다', () => {
    renderPane({ values: { ...routeFormValuesFixture, minValue: '100', maxValue: '' } });

    expect(screen.queryByText(t.notes.valueRangeEmpty)).not.toBeInTheDocument();
  });

  it('1차에 값 구간이 쓰이지 않는다는 사실은 늘 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.notes.valueRangeUnused)).toBeInTheDocument();
  });
});

describe('RouteFormPane — 입력칸', () => {
  it('값 구간 두 칸을 고칠 수 있다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane({ values: { ...routeFormValuesFixture, minValue: '' } });

    await user.type(screen.getByLabelText(t.fields.minValue), '7');

    expect(props.onChange).toHaveBeenCalledWith({ minValue: '7' });
  });

  /**
   * **「선택 없음」이 곧 전 사업부 공통이다.** 빈 선택지를 두지 않으면 한 번 고른 뒤에
   * 다시 비울 방법이 칸 안에 없어져, 전 사업부 공통 결재선을 만들 길이 사라진다.
   */
  it('사업부 선택칸에 「전 사업부 공통」 선택지가 있다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane();

    await user.click(screen.getByRole('combobox', { name: t.fields.businessUnit }));
    await user.click(screen.getByRole('option', { name: t.values.allBusinessUnits }));

    expect(props.onChange).toHaveBeenCalledWith({ businessUnitId: '' });
  });

  it('인라인 오류를 그 칸 옆에 낸다', () => {
    renderPane({ fieldErrors: { maxValue: t.validation.maxLessThanMin } });

    expect(screen.getByText(t.validation.maxLessThanMin)).toBeInTheDocument();
  });

  /**
   * **첫째 겹 단독 감지기** — 전송 중에는 입력칸이 잠긴다. 핸들러 가드(둘째 겹)를 떼어내고도
   * 이 단언이 서야 두 겹이 각각 실재한다고 말할 수 있다.
   */
  it('전송 중에는 입력칸과 버튼이 잠긴다', () => {
    renderPane({ isLocked: true });

    expect(screen.getByLabelText(t.fields.minValue)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.maxValue)).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.save })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeDisabled();
  });
});

describe('RouteFormPane — 등록 폼', () => {
  const createProps = { mode: 'create' as const, route: null, values: emptyRouteFormValues() };

  it('승인 유형 입력칸이 서고 선택지가 비어 있으면 안내가 붙는다', () => {
    renderPane(createProps);

    expect(screen.getByLabelText(t.fields.approvalTypeCode)).toBeInTheDocument();
    expect(screen.getByText(messages.pendingCode.note)).toBeInTheDocument();
  });

  /** **배열이 차면 안내를 거둔다** — 남으면 화면이 거짓말을 한다. */
  it('선택지가 차면 안내가 사라진다', () => {
    renderPane({
      ...createProps,
      approvalTypeOptions: [{ value: 'SAMPLE-TYPE-A', label: 'SAMPLE-TYPE-A' }],
    });

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();
  });

  it('주 액션이 「등록」이다', () => {
    renderPane(createProps);

    expect(screen.getByRole('button', { name: t.actions.submitCreate })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.save })).toBeNull();
  });

  /** 등록 중에는 사용 전환할 대상이 아직 없다 — 자원이 만들어지지 않았다. */
  it('사용 전환 액션이 없다', () => {
    renderPane(createProps);

    expect(screen.queryByRole('button', { name: messages.common.deactivate })).toBeNull();
    expect(screen.queryByRole('button', { name: t.actions.activate })).toBeNull();
  });

  /** 등록의 「취소」는 폼을 닫는 것이라 고친 것이 없어도 눌러야 한다. */
  it('고친 것이 없어도 취소를 누를 수 있다', () => {
    renderPane({ ...createProps, isDirty: false });

    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeEnabled();
  });
});

describe('RouteFormPane — 저장이 막힌 자리', () => {
  it('사유가 있으면 저장 버튼이 잠기고 사유가 보인다', () => {
    renderPane({ saveDisabledReason: t.actionReasons.saveNoChanges });

    expect(screen.getByRole('button', { name: messages.common.save })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.saveNoChanges)).toBeInTheDocument();
  });

  it('사유가 없으면 저장 버튼이 열린다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane();

    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  /**
   * 활성 중복으로 막혔을 때 **기존 결재선으로 옮겨 가는 길**을 함께 낸다.
   * 막기만 하면 사용자는 그 기존 결재선이 어느 것인지 목록에서 다시 찾아야 한다.
   */
  it('활성 중복으로 막히면 기존 결재선을 여는 길이 함께 선다', async () => {
    const user = userEvent.setup();
    const onOpenExisting = vi.fn();
    renderPane({ saveDisabledReason: t.actionReasons.duplicateActive, onOpenExisting });

    expect(screen.getByText(t.actionReasons.duplicateActive)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.actions.openExisting }));

    expect(onOpenExisting).toHaveBeenCalledTimes(1);
  });

  it('막히지 않았으면 그 길을 내지 않는다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: t.actions.openExisting })).toBeNull();
  });

  /** 판정하지 못한 것은 막을 근거가 아니다 — 안내만 내고 저장은 열어 둔다. */
  it('선검사를 하지 못했으면 안내만 내고 저장을 막지 않는다', () => {
    renderPane({ duplicateUnknownNote: t.notes.duplicateUnknown });

    expect(screen.getByText(t.notes.duplicateUnknown)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.save })).toBeEnabled();
  });
});

describe('RouteFormPane — 사용 전환 액션', () => {
  it('사용 중인 결재선에는 「사용 중지」만 선다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.activate })).toBeNull();
  });

  it('사용 중지된 결재선에는 「다시 사용」만 선다', () => {
    renderPane({ route: inactiveRoute });

    expect(screen.getByRole('button', { name: t.actions.activate })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.deactivate })).toBeNull();
  });

  it('사유가 있으면 「다시 사용」이 잠기고 사유가 보인다', () => {
    renderPane({
      route: inactiveRoute,
      activateDisabledReason: t.actionReasons.activateNoSteps,
    });

    expect(screen.getByRole('button', { name: t.actions.activate })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.activateNoSteps)).toBeInTheDocument();
  });

  it('사유가 없으면 「다시 사용」을 누를 수 있다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane({ route: inactiveRoute });

    await user.click(screen.getByRole('button', { name: t.actions.activate }));

    expect(props.onActivate).toHaveBeenCalledTimes(1);
  });

  it('「사용 중지」를 누르면 상위가 확인 창을 연다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane();

    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));

    expect(props.onDeactivate).toHaveBeenCalledTimes(1);
  });
});
