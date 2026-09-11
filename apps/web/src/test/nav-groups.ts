import { fireEvent, screen, within } from '@testing-library/react';

/**
 * 사이드바의 접힌 묶음을 **전부 펼친다**(#1079).
 *
 * ⚠ **앱은 현재 묶음만 펼친 채 선다.** 그러므로 사이드바 **항목**을 읽는 시험은 먼저 여기를
 * 지나야 한다 — 지나지 않으면 「항목이 없다」가 **접혀 있어서인지 빠져서인지** 구별되지 않는다.
 * 셸 감지기와 라우트 대조 감지기가 둘 다 쓰므로 한 곳에 둔다(두 벌이면 한쪽만 고쳐지는 날이 온다).
 *
 * ⛔ **접힘 자체를 재는 시험은 이것을 쓰지 않는다.** 기본값이 이 함수로 덮이므로, 그 자리를 따로
 * 재는 감지기가 반드시 있어야 한다 — `app/layout.test.tsx` 의 「묶음 접기」·「현재 묶음」 묶음이
 * 그 몫이고, 그것을 지우면 앱이 전부 펼친 채로 돌아가도 게이트가 초록이다.
 *
 * 손잡이를 이름이 아니라 `aria-expanded="false"` 로 찾는다 — 묶음이 늘거나 이름이 바뀌어도
 * 따라온다. 사이드바 레일 접기 버튼은 펼친 상태에서 `aria-expanded="true"` 라 걸리지 않는다.
 */
export const expandAllNavGroups = (): void => {
  const sidebar = screen.queryByRole('navigation', { name: '주 메뉴' });

  /* 셸 밖 화면(로그인 등)을 태운 시험도 이 함수를 지날 수 있다 — 사이드바가 없으면 할 일이 없다. */
  if (sidebar === null) return;

  for (const toggle of within(sidebar).queryAllByRole('button', { expanded: false })) {
    fireEvent.click(toggle);
  }
};
