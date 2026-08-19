import { messages } from '@omf-mes/i18n';

import type { NotificationView } from './types';

/**
 * 「대상으로 이동」의 대응표 — **이 파일 하나가 소유한다.**
 *
 * 계약은 알림의 대상을 **유형 코드 + 번호** 두 칸으로 가리킨다(다형 참조 · 공유계약 A-10).
 * 데이터베이스 외래키가 없어 무결성이 보장되지 않고, 그래서 **어디로 갈지 모르는 값이 온다.**
 *
 * ⭐ **이 앱에 도착할 주소가 있는 유형만 연다.** 계약 설명이 든 네 유형 중 성립하는 것은
 * 하나뿐이다(실측 · 계획 결정 ④):
 *
 * | 유형 | 이 앱의 도착지 | 성립하나 |
 * | --- | --- | :-: |
 * | `APPROVAL_REQUEST` | `/approval/inbox?rq=<번호>` — 그 화면이 `rq`를 조건 없이 읽어 곧바로 상세를 연다(실측 `approval-inbox/filters.ts`의 `readSelectedRequestId`) | ✅ |
 * | `LOT` | ⛔ 재고 현황은 **창고 번호가 함께 있어야** 선택을 읽는다. 알림은 그것을 주지 않는다 |  |
 * | `WORK_ORDER` | ⛔ 생산실행 화면이 아직 없다 |  |
 * | `NONCONFORMANCE` | ⛔ 품질 화면이 아직 없다 |  |
 *
 * 「계약 대응표에는 있는데 이 앱에 화면이 없다」는 스펙이 다루지 않은 제3의 상황이다.
 * A-10 규칙 2의 목적이 **「어디로 갈지 모르면 열지 않는다」**이므로 같은 처리를 적용한다 —
 * 주소를 지어내면 사용자는 눌러서 첫 화면으로 튕긴다.
 *
 * ⛔ **표 밖 유형에 「이 유형은 아직 화면이 없다」 같은 문구를 만들지 않는다.** 사용자가 할 수
 * 있는 조치가 없고, 스펙이 정한 것은 「**원본 코드를 그대로 보인다**」뿐이다 — 그 코드가 담당자에게
 * 전할 단서다.
 *
 * **유형이 늘면 이 파일에 줄 하나를 더한다.** 표가 흩어지면 「어디까지 열려 있는가」를 한눈에
 * 볼 수 없고, 도착지가 생긴 화면과 표가 어긋나도 드러나지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.notificationCenter;

export interface TargetLink {
  to: string;
  /** 링크의 접근 이름. 목록에 링크가 여럿이라 **어느 대상인지**가 이름에 들어간다 */
  label: string;
  /** 보이는 글자. 짧게 두되 **접근성 이름이 이 글자를 담는다** — 담지 않으면 음성 조작이 부를 수 없다 */
  shortLabel: string;
}

/**
 * 도착 주소를 만드는 함수들. **키가 곧 대응표다.**
 *
 * 값을 함수로 두는 이유는 주소마다 번호를 싣는 자리가 다르기 때문이다 — 지금은 질의 인자
 * 하나뿐이지만 경로 조각을 쓰는 유형이 오면 그 유형만 다른 함수를 갖는다.
 */
const DESTINATIONS: Record<string, (targetId: number) => string> = {
  APPROVAL_REQUEST: (targetId) => `/approval/inbox?rq=${String(targetId)}`,
};

/**
 * 이 알림이 갈 수 있는 곳. **갈 수 없으면 `null`이고, 그때 링크를 만들지 않는다.**
 *
 * ⭐ **두 칸이 다 있어야 한다.** 계약이 유형과 번호를 **각각 선택**으로 두어 한쪽만 오는 것을
 * 막지 않는다 — 유형만 있으면 어느 건인지 모르고, 번호만 있으면 어느 표의 것인지 모른다.
 * 한쪽으로 주소를 지어내면 눌러서 엉뚱한 건이 열리거나 첫 화면으로 튕긴다.
 *
 * ⭐ **이름은 화면이 만든 제목을 쓴다** — 원본 코드가 아니다. 카드 제목이 풀린 이름인데 그
 * 옆 링크만 코드를 들면 보조 기술 사용자에게 **둘을 잇는 글자가 없다.** 못 푼 코드는 제목
 * 자체가 원문이므로(T2의 낙하 규율) 그때는 링크도 원문을 든다 — 이 함수는 판정하지 않는다.
 */
export const toTargetLink = (view: NotificationView, title: string): TargetLink | null => {
  const { targetTypeCode, targetId } = view;

  if (targetTypeCode === null || targetId === null) return null;

  const destination = DESTINATIONS[targetTypeCode];

  if (destination === undefined) return null;

  return {
    to: destination(targetId),
    label: t.actions.openTarget(title),
    shortLabel: t.actions.openTargetShort,
  };
};
