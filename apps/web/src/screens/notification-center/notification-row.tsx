import { Link } from 'react-router';

import { NotificationCard, type NotificationCardProps } from './notification-card';
import { toTargetLink } from './target-link';

export type NotificationRowProps = NotificationCardProps;

/**
 * 목록 한 줄 — **카드와 「대상으로 이동」이 나란히 선다.**
 *
 * ⭐ **이동 수단을 카드 안에 두지 않는다**(결정 ⑦). 카드가 통째로 누를 수 있는 하나라, 그 안에
 * 또 다른 대화형 요소를 두면 **키보드 순회가 깨지고** 눌린 것이 어느 쪽인지 사용자가 가릴 수
 * 없다. 디자인 시스템도 같은 이유로 금한다.
 *
 * ⚠ **이 판의 `interactive` 카드는 `<button>`이 아니라 `<div role="button">`이다**(런타임 실측).
 * 그래서 「`button` 중첩이 없다」로 재면 뮤턴트를 물지 못한다 — 감지기는 **「카드 안에
 * `button`·`a`·`[role="button"]`이 없다」**로 세운다(T3이 그 형태로 세워 두었다).
 *
 * ⭐ **링크다 — 버튼이 아니다.** 이 수단이 하는 일은 **다른 화면으로 가는 것**이고, 링크로
 * 두면 새 창으로 열기·주소 복사가 되고 보조 기술이 「어디로 가는가」를 읽는다. 저장소의
 * 화면 간 이동에는 두 꼴이 다 있다 — 명령형 이동(`useNavigate`)과 **라우터 `<Link>`**이며,
 * 후자의 전례가 둘이다(`stocktaking/result-pane.tsx` · `over-receipt-split/created-receipts-pane.tsx`).
 * **뒤엣것이 이 화면과 구조가 같다**(목록의 각 줄이 자기 대상으로 가는 링크를 든다).
 * 디자인 시스템 `Button`에는 주소를 실을 자리가 없어(실측 — `ButtonHTMLAttributes`뿐) 그것을
 * 링크로 쓸 수 없고, 전례 둘도 **DS를 쓰지 않고 맨 `<Link>`**를 세운다.
 *
 * ⭐ **이동은 읽음 처리를 일으키지 않는다.** 링크가 카드 **밖**에 있어 클릭이 카드로 올라가지
 * 않는다 — 두 조작이 한 클릭에 겹치면 사용자가 무엇을 했는지 가릴 수 없다.
 *
 * ⭐ **밀어 넣는 이동이다.** 대상에서 **뒤로가기 한 번에 알림센터로 돌아오는 것**이 이 화면의
 * 정상 흐름이다(알림 → 대상 → 되돌아오기). `<Link>`의 기본이 그 동작이고, 감지기가 그것을 고정한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const NotificationRow = ({ view, title, ...card }: NotificationRowProps) => {
  /*
   * ⭐ **갈 곳이 있을 때만 링크를 만든다**(`target-link.ts`가 대응표를 소유한다).
   * 대응표에 없는 유형에 링크를 세우면 눌러서 첫 화면으로 튕기고, 그것이 공유계약 A-10
   * 규칙 2가 막으려던 일이다. 그때 사용자가 얻는 것은 **카드 제목에 그대로 남는 원본 코드**다.
   *
   * ⭐ **카드가 든 제목을 그대로 넘긴다.** 링크 이름이 원본 코드를 쓰면 보조 기술 사용자에게
   * 카드는 「합성 이벤트 가」로, 그 옆 링크는 「SYN-EVENT-01 …」로 들려 **둘을 잇는 글자가 없다.**
   * 못 푼 코드는 제목 자체가 원문이므로(T2의 낙하 규율) 그때는 링크도 원문을 든다.
   */
  const link = toTargetLink(view, title);

  return (
    <div className="notification-row">
      <NotificationCard view={view} title={title} {...card} />
      {link !== null && (
        /*
         * 보이는 글자는 짧게, **접근성 이름에 대상을 담는다.** 목록에 링크가 여럿 서므로
         * 이름이 같으면 음성 조작도 보조 기술도 어느 것을 부르는지 가릴 수 없다.
         * ⚠ 보이는 글자를 이름에 그대로 담는다 — 담지 않으면 보이는 글자로 부를 수 없다.
         */
        <Link to={link.to} aria-label={link.label}>
          {link.shortLabel}
        </Link>
      )}
    </div>
  );
};
