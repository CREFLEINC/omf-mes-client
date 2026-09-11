import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

const t = messages.shellNav;

export interface NavGroupProps {
  label: string;
  /** 이 묶음이 가진 화면 수. 접혀 있을 때 **안에 무엇이 얼마나 있는지** 알리는 유일한 값이다. */
  count: number;
  isOpen: boolean;
  /**
   * 지금은 손잡이가 상태를 바꿀 수 없다 — **검색이 펼침을 쥐고 있는 동안**이다.
   *
   * ⛔ 누름을 그냥 받으면 화면은 안 바뀌는데 접힘 상태가 뒤집혀, 검색어를 지운 뒤에 그 결과가
   * 드러난다. 잠근 사실을 **보이게** 두는 것이 조용히 무시하는 것보다 낫다.
   */
  isLocked?: boolean;
  onToggle: () => void;
  /** 열렸을 때만 넘어온다 — 부르는 쪽이 닫힌 묶음의 항목을 **만들지도 않는다**. */
  children: ReactNode;
}

/**
 * 접을 수 있는 사이드바 묶음 — **DS `SidebarSection` 을 대신한다**(#1079).
 *
 * ⭐ **DS 를 고쳐 쓰지 않고 대신한 이유.** `SidebarSection` 은 라벨을 `aria-hidden` 인 `<div>` 로
 * 그린다 — 누를 수 없고, 바깥에서 그 요소를 바꿀 문도 없다. 접기는 **라벨이 손잡이가 되는 일**이라
 * 라벨을 소유하지 않으면 만들 수 없다. DS 에 변형을 요청할 후보이지만, 그전에 제품에서 검증한다
 * (워크플로 §13 — 새 원시 요소는 제품에서 먼저, 세 번째 사용처에서 DS 승격 검토).
 *
 * ⛔ **닫힌 묶음의 항목을 감추지 않고 「만들지 않는다」.** `display: none` 으로 감추면 DS 사이드바의
 * 화살표 키 순회가 `querySelectorAll('[data-sidebar-item]')` 로 돌기 때문에 **보이지 않는 항목에
 * 초점이 간다.** 그래서 `children` 은 열렸을 때만 넘어온다 — 부르는 쪽의 규율이고, 이 컴포넌트가
 * 강제할 수 없어 여기 적어 둔다.
 *
 * ⚠ **항목 수를 접근명에 싣는다.** 접힌 묶음은 이름만 남아, 누르기 전에는 안이 비었는지 열셋인지
 * 알 수 없다. 눈으로는 숫자를 함께 그리고 보조기술에는 접근명으로 같은 사실을 준다.
 */
export const NavGroup = ({
  label,
  count,
  isOpen,
  isLocked = false,
  onToggle,
  children,
}: NavGroupProps) => {
  /*
   * ⛔ **묶음 이름으로 id 를 만들지 않는다.** `aria-controls` 는 IDREF 라 공백을 담을 수 없는데
   * 「시스템 관리」에는 공백이 있고 「설비/툴」에는 `/` 가 있다 — 이름을 그대로 쓰면 참조가
   * 조용히 끊겨 보조기술이 「무엇을 펼치는 버튼인지」를 잃는다. 손으로 치환하는 것도 답이 아니다
   * (치환 뒤 두 이름이 같아질 수 있다). React 가 주는 유일한 값을 쓴다.
   */
  const controlsId = useId();

  return (
    <div className="nav-group" role="group" aria-label={label}>
      <button
        type="button"
        className="nav-group-toggle"
        aria-expanded={isOpen}
        aria-controls={controlsId}
        /*
         * ⛔ **접근명에 펼침 여부를 넣지 않는다.** `aria-expanded` 가 이미 그것을 말하므로 넣으면
         * 같은 말을 두 번 하고, 음성 제어 사용자는 **상태에 따라 다른 이름**을 외워야 한다.
         * 이름에 싣는 것은 「누르기 전에 알 수 없는 것」 하나 — 안에 몇 개가 있는지다.
         */
        aria-label={t.group.name(label, count)}
        disabled={isLocked}
        onClick={onToggle}
      >
        {/*
         * 장식이다 — 펼침 여부는 `aria-expanded` 가 말하므로 읽어 주면 같은 말을 두 번 한다.
         * DS `Icon` 은 `label` 이 없으면 스스로 `aria-hidden` 이 되므로 따로 적지 않는다.
         */}
        <Icon
          name={isOpen ? 'expand_more' : 'chevron_right'}
          size={20}
          className="nav-group-chevron"
        />
        <span className="nav-group-label">{label}</span>
        <span className="nav-group-count">{count}</span>
      </button>
      {/*
       * ⚠ **닫혀 있어도 이 그릇은 남긴다.** `aria-controls` 가 가리키는 요소가 사라지면 끊긴
       * 참조가 되고, 보조기술이 「무엇을 펼치는 버튼인지」를 잃는다. 비는 것은 안쪽이다.
       */}
      <div id={controlsId} className="nav-group-items">
        {isOpen ? children : null}
      </div>
    </div>
  );
};
