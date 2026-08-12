import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { RouteView } from './types';

const t = messages.approvalRoute;

/**
 * 값 구간 표기 — 네 갈래다.
 *
 * **비운 것이 확정된 뜻이다.** 「전 구간」을 대시나 빈 칸으로 두면 자료가 빠진 것으로 읽혀
 * 정반대가 된다. 한쪽만 있는 구간도 조건이라 그 방향이 읽혀야 한다.
 */
const describeValueRange = (route: RouteView): string => {
  const { minValue, maxValue } = route;

  if (minValue === null && maxValue === null) return t.values.fullRange;
  if (minValue !== null && maxValue !== null) {
    return t.values.rangeBoth(String(minValue), String(maxValue));
  }

  return minValue === null ? t.values.rangeTo(String(maxValue)) : t.values.rangeFrom(String(minValue));
};

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

export interface RouteFormPaneProps {
  route: RouteView;
  /**
   * 사업부 이름. **화면이 풀어 넘긴다** — 「전 사업부 공통」을 포함한 다섯 갈래의 판정은
   * 참조를 아는 쪽이 하고, 이 구획은 결과 문자열만 낸다.
   */
  businessUnitLabel: string;
}

/**
 * 고른 결재선의 내용 — **이 회차에는 읽기 표시뿐이다.**
 *
 * 입력칸도 저장 액션도 두지 않는다. 등록·수정·사용 전환은 뒤 회차가 이 구획에 얹는다.
 *
 * **진행 중 건수를 상시 자리에 둔다.** 사용 중지 확인 창에만 두면 결재선을 *고치는* 사람은
 * 자기가 무엇에 영향을 주지 *않는지*를 끝내 모른다 — 진행 중인 요청은 지금의 결재선으로 끝난다.
 * 건수는 결재선 응답이 직접 실어 오는 파생값이라 화면이 세지 않는다.
 *
 * **「이 결재선이 지금 상신에 쓰입니다」라고 말하지 않는다.** 같은 유형·사업부로 사용 중인
 * 결재선이 둘 이상일 수 있고 고르는 규칙은 서버가 갖는다 — 화면은 자기가 아는 사실만 말한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RouteFormPane = ({ route, businessUnitLabel }: RouteFormPaneProps) => {
  const items: SummaryItem[] = [
    { key: 'approvalTypeCode', label: t.fields.approvalTypeCode, value: route.approvalTypeCode },
    { key: 'businessUnit', label: t.fields.businessUnit, value: businessUnitLabel },
    { key: 'valueRange', label: t.fields.valueRange, value: describeValueRange(route) },
    {
      key: 'status',
      label: t.fields.status,
      value: route.isActive ? t.values.active : t.values.inactive,
    },
    {
      key: 'stepCount',
      label: t.fields.stepCount,
      value: route.stepCount === 0 ? t.values.noSteps : String(route.stepCount),
    },
  ];

  return (
    <section className="pane" aria-label={t.panes.detail}>
      {/* 폼이 아니라 **값 표기**다(배치 규범 3) — 입력칸이 없으므로 이름·값 짝으로 낸다. */}
      <dl className="filter-bar">
        {items.map((item) => (
          <div className="field-cell" key={item.key}>
            <dt className="field-label">{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="field-note">{t.notes.valueRangeUnused}</p>

      <p className="field-note">
        {route.inProgressCount === 0
          ? t.notes.inProgressNone
          : t.notes.inProgressSome(route.inProgressCount)}
      </p>
    </section>
  );
};
