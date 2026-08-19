import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { NotificationCard, type NotificationCardProps } from './notification-card';
import { toTargetLink } from './target-link';

const t = messages.notificationCenter;

export type NotificationRowProps = NotificationCardProps;

/**
 * 목록 한 줄 — **카드와 「대상으로 이동」이 나란히 선다.**
 *
 * ⭐ **이동 버튼을 카드 안에 두지 않는다**(결정 ⑦). 카드가 통째로 누를 수 있는 하나라, 그 안에
 * 또 다른 대화형 요소를 두면 **키보드 순회가 깨지고** 눌린 것이 어느 쪽인지 사용자가 가릴 수
 * 없다. 디자인 시스템도 같은 이유로 금한다.
 *
 * ⚠ **이 판의 `interactive` 카드는 `<button>`이 아니라 `<div role="button">`이다**(런타임 실측).
 * 그래서 「`button` 중첩이 없다」로 재면 뮤턴트를 물지 못한다 — 감지기는 **「카드 안에
 * `button`·`a`·`[role="button"]`이 없다」**로 세운다(T3이 이미 그 형태로 세워 두었다).
 *
 * ⭐ **이동은 읽음 처리를 일으키지 않는다.** 버튼이 카드 **밖**에 있어 클릭이 카드로 올라가지
 * 않는다 — 두 조작이 한 클릭에 겹치면 사용자가 무엇을 했는지 가릴 수 없다.
 *
 * ⚠ **링크가 아니라 버튼이다.** 디자인 시스템 `Button`에 `href`가 없고(실측 — `ButtonHTMLAttributes`만
 * 받는다), 해시 클래스를 겨눠 `<a>`를 흉내 내는 것은 이 저장소가 금한 형태다. 저장소의 화면 간
 * 이동은 전부 이 꼴이다(`document-progress`·`approval-inbox`·`iqc-skip-approval`). **대신 잃는
 * 것을 적어 둔다** — 새 창으로 열기와 주소 복사가 되지 않는다. 디자인 시스템에 링크 버튼이
 * 생기면 그때 이 자리를 바꾼다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const NotificationRow = ({ view, ...card }: NotificationRowProps) => {
  const navigate = useNavigate();

  /*
   * ⭐ **갈 곳이 있을 때만 버튼을 만든다**(`target-link.ts`가 대응표를 소유한다).
   * 대응표에 없는 유형에 버튼을 세우면 눌러서 첫 화면으로 튕기고, 그것이 공유계약 A-10
   * 규칙 2가 막으려던 일이다. 그때 사용자가 얻는 것은 **카드 제목에 그대로 남는 원본 코드**다.
   */
  const link = toTargetLink(view);

  return (
    <div className="notification-row">
      <NotificationCard view={view} {...card} />
      {link !== null && (
        <Button
          variant="outlined"
          size="sm"
          aria-label={link.label}
          onClick={() => {
            void navigate(link.to);
          }}
        >
          {t.actions.openTargetShort}
        </Button>
      )}
    </div>
  );
};
