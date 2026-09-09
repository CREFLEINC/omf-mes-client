import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAccessiblePopScreens } from './pop-access';
import { POP_ENTRY_SCREEN_PATH } from './pop-screen-catalog';
import { PopSelect } from './pop-select';

/**
 * 머리줄이 [화면 이동] 자리를 비울지 말지를 여는 표식. 규칙은 `app/pop.css` 꼬리에 있다.
 *
 * ⛔ **버튼이 없는 화면에서는 비우지 않는다** — 진입 화면 머리줄에 빈 칸이 남는다
 *    (`patterns/pop-logout` 이 같은 이유로 같은 형태를 쓴다).
 */
const HEADER_FLAG = 'popScreenNav';

/**
 * 판정하지 못했을 때 보일 사유. 원인을 가르지 않고 뭉치면 관리자를 잘못 부른다.
 *
 * ⚠ **머리줄에 서는 문구라 짧아야 한다.** 이 자리는 화면 오른쪽 구석에 «떠서» 서고, 그 아래에
 *   설비·사번·연결 상태(`\.pop-context-right`)가 있다. 문장으로 적었더니 예약해 둔 폭을 넘어
 *   그것을 덮었다 — 그래서 머리줄에는 짧은 이름만 두고, 온전한 문장은 `title` 로 붙인다.
 */
const REASONS = {
  unknown: { short: '이동 가능 화면 미확인', full: '이동할 수 있는 화면을 확인하지 못했습니다' },
  empty: { short: '이동 가능 화면 없음', full: '이동할 수 있는 화면이 없습니다' },
} as const;

/**
 * **화면 어디서나 갈 수 있는 화면만 골라 옮겨 가는 자리**(공유계약 G-34).
 *
 * ⭐ **왜 화면 밖에 두는가.** 단말에는 주소창도 뒤로가기도 없어, 화면을 옮기는 길이 화면마다
 * 따로 있으면 작업자가 「여기서는 어디로 갈 수 있나」를 화면마다 새로 배워야 한다. [사용자
 * 전환]과 같은 겹(`app/pop-main` 의 `PopChrome`)에서 한 번만 그린다.
 *
 * ⭐ **팝업 규격은 선택 목록과 같다**(G-34). 후보는 이미 받아 둔 목록이라 검색이 API 를 다시
 * 부르지 않고, 페이지 위·아래와 전체 건수도 그 부품이 이미 가지고 있다 — 새로 만들면 규격이
 * 갈린다.
 *
 * ⛔ **저장하지 않은 입력을 묻지 않는다**(G-34). 확인 팝업을 끼우면 작업자가 그 팝업을 읽지
 * 않고 누르는 것을 배우게 되고, 정작 물어야 할 자리의 확인까지 같이 넘긴다.
 *
 * ⚠ **못 갈 때는 감추지 않고 비활성 + 사유다**(공유계약 G-2). 버튼이 사라지면 「이 단말은
 * 원래 이동이 안 되는가」와 「지금 확인이 안 되는가」를 구별할 수 없다.
 */
export const PopScreenNavButton = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();
  const visible = pathname !== POP_ENTRY_SCREEN_PATH;

  /* 지금 서 있는 화면은 뺀다 — 골라도 아무 일이 일어나지 않아 「눌리지 않는 항목」이 된다. */
  const candidates = access.screens.filter((candidate) => candidate.path !== pathname);
  const reason =
    access.state === 'unknown'
      ? REASONS.unknown
      : candidates.length === 0 && access.state !== 'loading'
        ? REASONS.empty
        : null;

  /*
   * ⚠ **사유가 설 때는 머리줄이 더 비워야 한다.** 표식에 값을 실어 그 사실을 알린다 — 늘
   *   넓게 비우면 사유가 없는 평시에 머리줄이 그만큼 좁아진다.
   */
  useEffect(() => {
    if (!visible) return;

    document.documentElement.dataset[HEADER_FLAG] = reason === null ? 'on' : 'reason';

    return () => {
      delete document.documentElement.dataset[HEADER_FLAG];
    };
  }, [visible, reason]);

  if (!visible) return null;

  return (
    <div className="pop-screen-nav">
      {reason === null ? null : (
        <span className="pop-screen-nav__reason" title={reason.full}>
          {reason.short}
        </span>
      )}
      <PopSelect
        aria-label="화면 이동"
        actionLabel="화면 이동"
        disabled={reason !== null || access.state === 'loading'}
        value={null}
        options={candidates.map((candidate) => ({
          value: candidate.path,
          label: `${candidate.code} ${candidate.name}`,
        }))}
        onChange={(path) => {
          if (path === null) return;

          void navigate(path);
        }}
      />
    </div>
  );
};
