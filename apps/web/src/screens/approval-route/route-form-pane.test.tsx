import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BUSINESS_UNIT_LABEL, routeViewFixtures } from './fixtures';
import { RouteFormPane, type RouteFormPaneProps } from './route-form-pane';
import type { RouteView } from './types';

const t = messages.approvalRoute;

const [withUnit, allUnits, inactiveRoute] = routeViewFixtures as [RouteView, RouteView, RouteView];

const renderPane = (overrides: Partial<RouteFormPaneProps> = {}) =>
  render(<RouteFormPane route={withUnit} businessUnitLabel={BUSINESS_UNIT_LABEL} {...overrides} />);

describe('RouteFormPane — 값 표기', () => {
  it('승인 유형과 사업부를 낸다', () => {
    renderPane();

    expect(screen.getByText('SAMPLE-TYPE-A')).toBeInTheDocument();
    expect(screen.getByText(BUSINESS_UNIT_LABEL)).toBeInTheDocument();
  });

  it('사업부를 비운 결재선은 「전 사업부 공통」으로 읽힌다', () => {
    renderPane({ route: allUnits, businessUnitLabel: t.values.allBusinessUnits });

    expect(screen.getByText(t.values.allBusinessUnits)).toBeInTheDocument();
  });

  it('어디에도 내부 번호가 없다', () => {
    const { container } = renderPane();

    // 선행 단언 — 값이 실제로 그려져야 「번호가 없다」가 뜻을 갖는다.
    expect(screen.getByText('SAMPLE-TYPE-A')).toBeInTheDocument();
    expect(container.textContent).not.toContain('9001');
    expect(container.textContent).not.toContain('9101');
  });

  it('값 구간이 양쪽 다 있으면 범위로 읽힌다', () => {
    renderPane();

    expect(screen.getByText(t.values.rangeBoth('100', '500'))).toBeInTheDocument();
  });

  it('값 구간을 비우면 「전 구간」으로 읽힌다', () => {
    renderPane({ route: allUnits });

    expect(screen.getByText(t.values.fullRange)).toBeInTheDocument();
  });

  it('한쪽만 있는 값 구간은 그 방향으로 읽힌다', () => {
    renderPane({ route: inactiveRoute });

    // 하한이 0이다 — 「없음」이 아니라 확정된 값이다.
    expect(screen.getByText(t.values.rangeFrom('0'))).toBeInTheDocument();
  });

  it('상한만 있는 값 구간도 그 방향으로 읽힌다', () => {
    renderPane({ route: { ...withUnit, minValue: null, maxValue: 500 } });

    expect(screen.getByText(t.values.rangeTo('500'))).toBeInTheDocument();
  });

  it('값 구간이 1차에 쓰이지 않는다는 사실을 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.notes.valueRangeUnused)).toBeInTheDocument();
  });

  it('사용 여부와 단계 수를 낸다', () => {
    renderPane();

    expect(screen.getByText(t.values.active)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('단계가 0이면 표식을 낸다', () => {
    renderPane({ route: allUnits, businessUnitLabel: t.values.allBusinessUnits });

    expect(screen.getByText(t.values.noSteps)).toBeInTheDocument();
  });

  it('미사용 결재선은 그 사실을 낸다', () => {
    renderPane({ route: inactiveRoute });

    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
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
    renderPane({ route: allUnits, businessUnitLabel: t.values.allBusinessUnits });

    expect(screen.getByText(t.notes.inProgressNone)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.inProgressSome(0))).not.toBeInTheDocument();
  });

  it('건수를 응답 값에서 가져온다', () => {
    renderPane({ route: { ...withUnit, inProgressCount: 7 } });

    expect(screen.getByText(t.notes.inProgressSome(7))).toBeInTheDocument();
  });

  /**
   * **사용 중지된 결재선에서야말로 이 문구가 필요하다.**
   *
   * 결재선을 끈 사람이 「그럼 이미 돌고 있는 것들은?」을 확인할 자리가 여기다 —
   * 끄기 확인 창은 닫히면 사라지지만 이 자리는 남는다. 사용 여부로 가리면
   * 문구가 존재하는 이유 그 자체가 사라진다.
   */
  it('사용 중지된 결재선에서도 진행 중 안내가 남는다', () => {
    renderPane({ route: { ...inactiveRoute, inProgressCount: 2 } });

    // 선행 단언 — 실제로 미사용 결재선이어야 이 감지기가 뜻을 갖는다.
    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
    expect(screen.getByText(t.notes.inProgressSome(2))).toBeInTheDocument();
  });

  it('사용 중지되고 진행 중인 요청도 없으면 그 사실을 말한다', () => {
    renderPane({ route: inactiveRoute });

    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
    expect(screen.getByText(t.notes.inProgressNone)).toBeInTheDocument();
  });
});

describe('RouteFormPane — 이 회차의 경계', () => {
  it('읽기 전용이라 입력칸도 저장 액션도 없다', () => {
    renderPane();

    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
