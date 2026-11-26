import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
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
  /* 단계 수는 결재 단계 카드 제목 옆으로 옮겼다(사용자 지시 2026-11-24). */
  it('제목 아래 한 줄에 승인 유형과 사용 유무를 낸다', () => {
    renderPane();

    expect(screen.getByRole('heading', { name: t.panes.basicInfo })).toBeInTheDocument();
    expect(screen.getByText('폐기 출고')).toBeInTheDocument();
    expect(screen.getByText(t.values.active)).toBeInTheDocument();
  });

  /**
   * 계약의 수정 본문에 승인 유형이 없다 — 왜 못 고치는지를 밝히지 않으면 결함으로 읽힌다.
   * 칸 아래 문장 대신 라벨 옆 ⓘ 로 둔다(관리웹 정리 시안 A).
   */
  it('승인 유형을 고칠 수 없다는 사실은 라벨 옆 ⓘ 로 밝힌다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: t.notes.approvalTypeFixed })).toBeInTheDocument();
    expect(screen.queryByText(t.notes.approvalTypeFixed)).toBeNull();
    expect(screen.queryByLabelText(t.fields.approvalTypeCode)).toBeNull();
  });

  it('미사용 결재선은 그 사실을 낸다', () => {
    renderPane({ route: inactiveRoute });

    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
  });

  it('어디에도 내부 번호가 없다', () => {
    const { container } = renderPane();

    // 선행 단언 — 값이 실제로 그려져야 「번호가 없다」가 뜻을 갖는다.
    expect(screen.getByText('폐기 출고')).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: t.notes.inProgressSome(3) })).toBeInTheDocument();
  });

  /* 안내는 「결재선 기본 정보」 제목 오른쪽 ⓘ — 마우스를 올리면 문구가 보인다(사용자 지시 2026-11-25). */
  it('진행 중 안내는 기본 정보 제목 옆 ⓘ 로 선다', () => {
    renderPane();

    const heading = screen.getByRole('heading', { name: t.panes.basicInfo });
    const tip = screen.getByRole('button', { name: t.notes.inProgressSome(3) });

    expect(heading.parentElement).toContainElement(tip);
    expect(tip).toHaveClass('info-tip');
    expect(screen.queryByText(t.notes.inProgressSome(3))).not.toBeInTheDocument();
  });

  it('진행 중인 요청이 없어도 그 사실을 말한다', () => {
    renderPane({ route: allUnits });

    expect(screen.getByRole('button', { name: t.notes.inProgressNone })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.notes.inProgressSome(0) }),
    ).not.toBeInTheDocument();
  });

  it('건수를 응답 값에서 가져온다', () => {
    renderPane({ route: { ...withUnit, inProgressCount: 7 } });

    expect(screen.getByRole('button', { name: t.notes.inProgressSome(7) })).toBeInTheDocument();
  });

  /**
   * **사용 중지된 결재선에서야말로 이 문구가 필요하다.** 끄기 확인 창은 닫히면 사라지지만
   * 이 자리는 남는다 — 사용 여부로 가리면 문구가 존재하는 이유 그 자체가 사라진다.
   */
  it('사용 중지된 결재선에서도 진행 중 안내가 남는다', () => {
    renderPane({ route: { ...inactiveRoute, inProgressCount: 2 } });

    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.notes.inProgressSome(2) })).toBeInTheDocument();
  });

  /** 등록에는 아직 자원이 없다 — 없는 건수를 0으로 채워 보이면 사용자가 자료로 읽는다. */
  it('등록 폼에는 진행 중 안내가 없다', () => {
    renderPane({ mode: 'create', route: null, values: emptyRouteFormValues() });

    expect(screen.queryByRole('button', { name: t.notes.inProgressNone })).not.toBeInTheDocument();
    expect(screen.queryByText(t.values.active)).not.toBeInTheDocument();
  });
});

describe('RouteFormPane — 비움 경고 (전체 교체의 뜻)', () => {
  /* 비운 사업부의 뜻은 칸 아래 문구 대신 선택지 이름 「전체 사업부」가 말한다(사용자 지시 2026-11-25). */
  it('사업부를 비우면 칸에 「전체 사업부」가 보인다', () => {
    renderPane({ values: { ...routeFormValuesFixture, businessUnitId: '' } });

    expect(screen.getByRole('combobox', { name: t.fields.businessUnit })).toHaveTextContent(
      t.values.allBusinessUnitsOption,
    );
  });

  /* 잘림 · 실패 같은 사업부 선택지 안내는 그대로 칸 아래에 선다. */
  it('사업부 선택지 안내는 그대로 칸 아래에 선다', () => {
    renderPane({ businessUnitNote: t.filters.lookupFailed });

    expect(screen.getByText(t.filters.lookupFailed)).toBeInTheDocument();
  });

  /*
   * 비웠을 때의 뜻은 칸 아래가 아니라 「수량 범위」 ⓘ 의 둘째 줄이다(사용자 지시 2026-11-25) — 비웠든 채웠든 칸 아래에
   * 늘 펼친 문장이 서지 않는다.
   */
  it('값 구간을 둘 다 비워도 칸 아래 문구는 없고 그 뜻은 ⓘ 에 있다', () => {
    renderPane({ values: { ...routeFormValuesFixture, minValue: '', maxValue: '' } });

    expect(screen.queryByText(t.notes.valueRangeEmpty)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `${t.notes.valueRangeUnused}\n${t.notes.valueRangeEmpty}`,
      }),
    ).toBeInTheDocument();
  });

  it('값 구간을 한쪽이라도 채워도 칸 아래 문구는 없다', () => {
    renderPane({ values: { ...routeFormValuesFixture, minValue: '100', maxValue: '' } });

    expect(screen.queryByText(t.notes.valueRangeEmpty)).not.toBeInTheDocument();
  });

  /* 칸 아래에 늘 펼쳐 두지 않고 「수량 범위」 라벨 옆 ⓘ 로 둔다(관리웹 정리 시안 A). 두 문장, 고르지 않는다는 말이 먼저. */
  it('값 구간이 결재선을 고르지 않는다는 사실과 비움의 뜻은 수량 범위 라벨 옆 ⓘ 로 밝힌다', () => {
    renderPane();

    const tip = screen.getByRole('button', {
      name: `${t.notes.valueRangeUnused}\n${t.notes.valueRangeEmpty}`,
    });
    expect(tip).toBeInTheDocument();
    expect(screen.queryByText(t.notes.valueRangeUnused)).toBeNull();
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
  /* 폼의 「선택 없음」은 「전체 사업부」로 읽힌다(사용자 지시 2026-11-25). 값은 종전대로 비움이다. */
  it('사업부 선택칸에 「전체 사업부」 선택지가 있다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane();

    await user.click(screen.getByRole('combobox', { name: t.fields.businessUnit }));
    await user.click(screen.getByRole('option', { name: t.values.allBusinessUnitsOption }));

    expect(props.onChange).toHaveBeenCalledWith({ businessUnitId: '' });
  });

  /* 칸 안 흐린 글자는 「하한 값을 입력하세요」 · 「상한 값을 입력하세요」, 접근 이름은 하한 · 상한 그대로(사용자 지시 2026-11-25). */
  it('하한 · 상한 칸의 흐린 글자가 입력 안내다', () => {
    renderPane();

    expect(screen.getByLabelText(t.fields.minValue)).toHaveAttribute(
      'placeholder',
      t.fields.minValuePlaceholder,
    );
    expect(screen.getByLabelText(t.fields.maxValue)).toHaveAttribute(
      'placeholder',
      t.fields.maxValuePlaceholder,
    );
    expect(t.fields.minValuePlaceholder).toBe('하한 값을 입력하세요');
    expect(t.fields.maxValuePlaceholder).toBe('상한 값을 입력하세요');
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
    expect(screen.getByRole('button', { name: t.actions.saveRoute })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.discardChanges })).toBeDisabled();
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
      approvalTypeOptions: [{ value: 'GOODS_ISSUE_DISPOSAL', label: 'GOODS_ISSUE_DISPOSAL' }],
    });

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();
  });

  it('주 액션이 「등록」이다', () => {
    renderPane(createProps);

    expect(screen.getByRole('button', { name: t.actions.submitCreate })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.saveRoute })).toBeNull();
  });

  /** 등록 중에는 사용 전환할 대상이 아직 없다 — 자원이 만들어지지 않았다. */
  it('사용 전환 액션이 없다', () => {
    renderPane(createProps);

    expect(screen.queryByRole('button', { name: messages.common.deactivate })).toBeNull();
    expect(screen.queryByRole('button', { name: t.actions.activate })).toBeNull();
  });

  /* 수량 범위는 팝업 너비에 맞춰 줄 전체를 쓴다 — 하한 · 상한이 반씩 나눈다(사용자 지시 2026-11-25). */
  it('등록 팝업의 수량 범위는 줄 전체를 쓰고, 상세에서는 종전 한 칸이다', () => {
    const { unmount } = renderPane(createProps);

    const range = screen.getByRole('group', { name: t.fields.valueRange });
    expect(range).toHaveClass('approval-route-range', 'form-grid-full');
    unmount();

    renderPane();
    expect(screen.getByRole('group', { name: t.fields.valueRange })).not.toHaveClass(
      'form-grid-full',
    );
  });

  /** 등록의 「취소」는 폼을 닫는 것이라 고친 것이 없어도 눌러야 한다. */
  it('고친 것이 없어도 취소를 누를 수 있다', () => {
    renderPane({ ...createProps, isDirty: false });

    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeEnabled();
  });

  /* 등록은 팝업이다(사용자 지시 2026-11-25 · 공통코드 「그룹 추가」와 같다). */
  it('등록 폼은 「결재선 등록」 팝업으로 서고 바닥에 [취소][등록]이 있다', () => {
    renderPane(createProps);

    const dialog = screen.getByRole('dialog', { name: t.panes.create });

    expect(
      within(dialog).getByRole('combobox', { name: t.fields.approvalTypeCode }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: messages.common.cancel }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: t.actions.submitCreate }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.panes.create })).toBeNull();
  });

  it('팝업의 취소는 등록 폼을 닫는 처리로 간다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane({ ...createProps, isDirty: false });

    await user.click(
      within(screen.getByRole('dialog', { name: t.panes.create })).getByRole('button', {
        name: messages.common.cancel,
      }),
    );

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  /* 필수 칸이 비면 빨간 테두리(#333 · 공통코드 등록 팝업과 같다). 고르면 걷힌다. */
  it('승인 유형이 비면 빨간 테두리 표시가 붙고 고르면 걷힌다', () => {
    const { rerender, props } = renderPane({
      ...createProps,
      approvalTypeOptions: [{ value: 'PURCHASE_ORDER', label: 'P/O' }],
    });
    const cellOf = (): HTMLElement | null =>
      screen.getByRole('combobox', { name: t.fields.approvalTypeCode }).closest('.field-cell');

    expect(cellOf()).toHaveClass('users-roles-required-empty');
    expect(screen.getByRole('combobox', { name: t.fields.approvalTypeCode })).toHaveTextContent(
      t.fields.approvalTypePlaceholder,
    );

    rerender(
      <RouteFormPane
        {...props}
        values={{ ...emptyRouteFormValues(), approvalTypeCode: 'PURCHASE_ORDER' }}
      />,
    );

    expect(cellOf()).not.toHaveClass('users-roles-required-empty');
  });

  /* 유형을 고르기 전의 「승인 유형을 고르세요.」 사유 글은 걷었다 — 등록 단추만 꺼진다(사용자 지시 2026-11-25). */
  it('유형을 고르기 전에는 등록이 꺼지고 사유 글은 없다', () => {
    renderPane({ ...createProps, saveDisabledReason: t.actionReasons.createNoType });

    expect(screen.getByRole('button', { name: t.actions.submitCreate })).toBeDisabled();
    expect(screen.queryByText(t.actionReasons.createNoType)).toBeNull();
  });

  /* 등록 팝업에서는 활성 중복 사유 글을 [등록] 아래에 내지 않는다 — 단추만 꺼진다(사용자 지시 2026-11-25). */
  it('활성 중복으로 막혀도 팝업에는 사유 글이 없고 등록만 꺼진다', () => {
    renderPane({ ...createProps, saveDisabledReason: t.actionReasons.duplicateActive });

    expect(screen.getByRole('button', { name: t.actions.submitCreate })).toBeDisabled();
    expect(screen.queryByText(t.actionReasons.duplicateActive)).toBeNull();
  });

  /* 고른 사업부에 이미 쓰는 승인 유형은 선택지에서 뺀다(사용자 지시 2026-11-25). */
  it('감출 유형을 받으면 그 유형만 선택지에서 빠진다', async () => {
    const user = userEvent.setup();
    renderPane({
      ...createProps,
      approvalTypeOptions: [
        { value: 'PURCHASE_ORDER', label: 'P/O' },
        { value: 'GOODS_ISSUE_DISPOSAL', label: '폐기 출고' },
      ],
      hiddenApprovalTypeCodes: new Set(['PURCHASE_ORDER']),
    });

    await user.click(screen.getByRole('combobox', { name: t.fields.approvalTypeCode }));

    expect(screen.queryByRole('option', { name: 'P/O' })).toBeNull();
    expect(screen.getByRole('option', { name: '폐기 출고' })).toBeInTheDocument();
  });

  /* 다 빠졌다고 「값 목록을 못 받았다」 안내를 내지 않는다 — 안내는 빼기 전 목록으로 판단한다. */
  it('모든 유형이 감춰져도 값 목록 안내는 서지 않는다', () => {
    renderPane({
      ...createProps,
      approvalTypeOptions: [{ value: 'PURCHASE_ORDER', label: 'P/O' }],
      hiddenApprovalTypeCodes: new Set(['PURCHASE_ORDER']),
    });

    expect(screen.queryByText(messages.pendingCode.note)).toBeNull();
    expect(screen.getByRole('combobox', { name: t.fields.approvalTypeCode })).toHaveTextContent(
      t.fields.approvalTypePlaceholder,
    );
  });

  /* 이 화면의 모든 창은 닫기(X)가 없다(사용자 지시 2026-11-25). */
  it('등록 팝업에 닫기(X) 단추가 없다', () => {
    renderPane(createProps);

    const dialog = screen.getByRole('dialog', { name: t.panes.create });
    expect(within(dialog).queryByRole('button', { name: '닫기' })).toBeNull();
  });

  it('중복 확인 안내를 받으면 팝업 안에 낸다', () => {
    renderPane({ ...createProps, duplicateUnknownNote: t.notes.duplicateUnknownCreate });

    expect(
      within(screen.getByRole('dialog', { name: t.panes.create })).getByText(
        t.notes.duplicateUnknownCreate,
      ),
    ).toBeInTheDocument();
  });
});

describe('RouteFormPane — 저장이 막힌 자리', () => {
  it('사유가 있으면 저장 버튼이 잠기고 사유가 보인다', () => {
    renderPane({ saveDisabledReason: t.actionReasons.duplicateActive });

    expect(screen.getByRole('button', { name: t.actions.saveRoute })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.duplicateActive)).toBeInTheDocument();
  });

  /* 고친 것이 없을 때는 꺼진 단추로만 — 같은 안내를 되풀이하지 않는다(사용자 지시 2026-11-24). */
  it('고친 것이 없으면 저장 버튼만 잠기고 사유 글은 내지 않는다', () => {
    renderPane({ saveDisabledReason: t.actionReasons.saveNoChanges });

    expect(screen.getByRole('button', { name: t.actions.saveRoute })).toBeDisabled();
    expect(screen.queryByText(t.actionReasons.saveNoChanges)).toBeNull();
  });

  it('사유가 없으면 저장 버튼이 열린다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane();

    await user.click(screen.getByRole('button', { name: t.actions.saveRoute }));

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
    expect(screen.getByRole('button', { name: t.actions.saveRoute })).toBeEnabled();
  });
});

describe('RouteFormPane — 사용 전환 액션', () => {
  /* 「사용 중지」 · 「다시 사용」은 결재선 기본 정보 제목 줄 오른쪽 끝 — 바닥 줄에는 취소 · 저장만(사용자 지시 2026-11-25). */
  it.each([
    ['사용 중지', withUnit, null, messages.common.deactivate],
    ['다시 사용', inactiveRoute, null, t.actions.activate],
    ['잠긴 다시 사용', inactiveRoute, t.actionReasons.activateNoSteps, t.actions.activate],
  ] as const)('%s 단추는 제목 줄 마지막에 서고 바닥 줄에 없다', (_label, route, reason, name) => {
    const { container } = renderPane({ route, activateDisabledReason: reason });

    const titleRow = container.querySelector('.approval-route-head-title-row') as HTMLElement;
    const button = within(titleRow).getByRole('button', { name });
    expect(titleRow.lastElementChild).toContainElement(button);
    expect(titleRow.lastElementChild).toHaveClass('approval-route-head-action');
    expect(button.className).toMatch(/_sm_/);

    const footer = container.querySelector('.form-actions') as HTMLElement;
    expect(within(footer).queryByRole('button', { name })).toBeNull();
    expect(
      within(footer)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([t.actions.discardChanges, t.actions.saveRoute]);
  });

  it('사용 중인 결재선에는 「사용 중지」만 선다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.activate })).toBeNull();
  });

  /* 다른 마스터 화면과 같은 모양 — 작은 외곽선 단추 + 금지 아이콘(사용자 지시 2026-11-25). */
  it('「사용 중지」는 금지 아이콘이 붙은 작은 단추다', () => {
    renderPane();

    const button = screen.getByRole('button', { name: messages.common.deactivate });
    expect(button).toHaveTextContent('block');
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
