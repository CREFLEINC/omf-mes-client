import { Checkbox, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { NotificationFilters } from './filters';
import type { NotificationPeriod } from './period';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.notificationCenter;

export interface NotificationFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 값. 이 부품은 자기 상태를 들지 않는다 */
  period: NotificationPeriod;
  filters: NotificationFilters;
  /** 유형 선택지. 「전체」를 포함해 화면이 만들어 넘긴다 */
  eventOptions: SelectOption[];
  /** 선택지 목록의 한계 안내(조회 실패). 정상이면 넘기지 않는다 */
  eventNote?: string;
  onChangePeriod: (period: NotificationPeriod) => void;
  onChangeFilters: (filters: NotificationFilters) => void;
}

/**
 * 조회 조건 줄 — 기간 · 「안 읽음만」 · 유형 셋.
 *
 * ⭐ **「조회」 버튼을 두지 않는다.** 세 컨트롤이 전부 **완결된 값만 방출**하기 때문이다 —
 * `DatePicker mode="range"`는 완결 쌍만, 그것도 `from ≤ to`로만 내보내고(디자인 시스템이
 * 보장한다 · 실측), 체크상자와 선택칸은 애초에 중간 상태가 없다.
 *
 * 전례 둘(`master-change`·`integration-sync`)이 「모아서 적용」을 쓰는 이유는 **자유 입력 칸이
 * 있어** 치는 도중의 반쪽 값으로 요청이 나가기 때문이다. 이 화면에는 그 칸이 하나도 없으므로
 * 그 형태를 가져오면 **누를 이유가 없는 버튼**과, 그 버튼이 요구하는 비활성 사유 문구가
 * 함께 따라온다. 조작 하나가 곧 조회다.
 *
 * ⛔ **조건 칩을 두지 않는다.** 조건이 셋뿐이고 그중 기간은 풀 수 없으며(필수), 남는 둘은
 * 현재 값이 컨트롤 자리에 이미 보인다 — 칩은 같은 사실을 두 번 말한다.
 *
 * ⛔ **자기 상태를 들지 않는다.** 주소가 정본이라 값은 전부 부모가 준다. 전례들이 `useState`와
 * 되돌림 effect를 두는 이유는 「모아서 적용」 때문인데, 즉시 적용에는 되돌릴 중간 상태가 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const NotificationFilterBar = ({
  period,
  filters,
  eventOptions,
  eventNote,
  onChangePeriod,
  onChangeFilters,
}: NotificationFilterBarProps) => {
  const periodId = useId();

  return (
    <div className="filter-bar">
      {/*
       * 기간은 **한 컨트롤**이다 — 시작·종료 두 칸이 아니라 `mode="range"` 하나다.
       * 주소 키(`from`·`to`)와 요청 인자는 그대로다. 바뀐 것은 고르는 수단뿐이다.
       *
       * 컨트롤이 역전·반쪽을 만들지 못하지만 `resolvePeriod`의 그 갈래는 그대로 둔다 —
       * 주소는 사용자가 직접 고칠 수 있고 조회 조건의 정본은 주소다. 컨트롤이 막는 것과
       * 화면이 막는 것은 다른 층이다.
       */}
      <div className="field-cell">
        <label className="field-label" htmlFor={periodId}>
          {t.fields.period}
        </label>
        <DatePicker
          id={periodId}
          mode="range"
          value={[period.from === '' ? null : period.from, period.to === '' ? null : period.to]}
          onChange={([from, to]) => {
            onChangePeriod({ from, to });
          }}
        />
      </div>

      {/*
       * 「안 읽음만」은 체크상자다.
       *
       * **근거는 값이 둘뿐이라는 것이다** — 켜고 끄는 것 말고 고를 것이 없어, 선택칸으로 두면
       * 「전체」와 「안 읽음」 두 항목짜리 목록을 여닫는 조작이 켜고 끄기 하나를 대신한다.
       * 형제 화면들의 boolean 조건 둘(`stocktaking`의 진행 중만 · `putaway-rule`의 사용 중만)이
       * 같은 형태다.
       *
       * ⚠ **화면 스펙 §4의 배치 도식과 갈라선 자리다.** 그 도식은 이 조건을 「유형」과 같은
       * 드롭다운 표기로 그려 **선택칸으로 읽힌다**(§7의 DS 매핑은 컴포넌트를 지정하지 않아
       * 그 축에서는 어긋나지 않는다). 어느 쪽이 정본인지는 설계가 정할 자리이므로 질문
       * `omf-mes#165`로 올려 두었고, **답이 오면 그쪽을 따른다.**
       *
       * ⚠ 정보 설계가 달라지는 점을 함께 적어 둔다 — 선택칸은 「전체」라는 말을 화면에 보이고
       * 체크상자는 보이지 않는다. 그 차이가 이 질문의 실질이다.
       */}
      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          checked={filters.unreadOnly}
          onChange={(event) => {
            onChangeFilters({ ...filters, unreadOnly: event.target.checked });
          }}
        >
          {t.fields.unreadOnly}
        </Checkbox>
      </div>

      <SelectField
        label={t.fields.eventCode}
        options={eventOptions}
        value={filters.eventCode}
        note={eventNote}
        wide
        onChange={(value) => {
          onChangeFilters({ ...filters, eventCode: value });
        }}
      />
    </div>
  );
};
