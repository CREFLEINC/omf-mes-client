import { messages } from '@omf-mes/i18n';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAccessiblePopScreens } from './pop-access';
import { useHeaderReservedWidth } from './pop-header-reserve';
import { POP_ENTRY_SCREEN_PATH, type PopScreen } from './pop-screen-catalog';
import { PopSelect } from './pop-select';

/** 머리줄 항목 사이 간격 — `.pop-context-right` 의 `--space-3` 과 같다(사용자 지시 2026-09-10). */
const HEADER_GAP_PX = 12;

/**
 * 머리줄이 [화면 이동] 자리를 비울지 말지를 여는 표식. 규칙은 `app/pop.css` 꼬리에 있다.
 *
 * ⛔ **버튼이 없는 화면에서는 비우지 않는다** — 진입 화면 머리줄에 빈 칸이 남는다
 *    (`patterns/pop-logout` 이 같은 이유로 같은 형태를 쓴다).
 */
const HEADER_FLAG = 'popScreenNav';

/**
 * 판정하지 못했을 때의 사유. 원인을 가르지 않고 뭉치면 관리자를 잘못 부른다.
 *
 * ⛔ **머리줄에 문장으로 적지 않는다**(사용자 지시 2026-09-09). 처음에는 버튼 옆에 문구를
 *    두었는데, 머리줄은 화면 이름과 설비·사번·연결 상태가 서는 자리라 사유가 그 줄에서
 *    가장 긴 글이 됐다. **비활성 버튼 자체가 「지금은 못 간다」를 말하고**, 왜인지는 버튼에
 *    손을 얹으면 나온다(공유계약 G-2 의 「사유 표시」는 이 형태로 지킨다).
 */
const REASONS = {
  unknown: '이동할 수 있는 화면을 확인하지 못했습니다',
  empty: '이동할 수 있는 화면이 없습니다',
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
/**
 * 갈 곳의 주소.
 *
 * ⭐ **작업지시 문맥은 주소 하나로만 흐른다**(사용자 승인 2026-09-15). 지금 보는 화면이
 *    작업지시를 달고 있고 갈 화면도 그 인자를 받는 화면이면, 그 값을 그대로 실어 준다. 싣지
 *    않으면 작업자가 자재 투입에서 생산 실적으로 갈 때 「작업지시를 받지 못했다」로 막혀
 *    작업 시작 화면까지 되돌아가야 했다(WIP-CHAIN-01 D10).
 *
 * ⛔ **받는다고 표기된 화면에만 싣는다.** 모르는 화면에 실으면 그 화면이 쓰지 않는 값이 주소에
 *    남고, 뒤에 같은 이름을 쓰게 되면 남이 남긴 값으로 조회가 선다. 표기는 `pop-screen-catalog`.
 */
const destinationOf = (screen: PopScreen, search: string): string => {
  if (screen.acceptsWorkOrderId !== true) return screen.path;

  const workOrderId = new URLSearchParams(search).get('workOrderId');
  if (workOrderId === null || workOrderId === '') return screen.path;

  return `${screen.path}?workOrderId=${encodeURIComponent(workOrderId)}`;
};

export const PopScreenNavButton = () => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();
  const visible = pathname !== POP_ENTRY_SCREEN_PATH;
  const box = useRef<HTMLDivElement>(null);

  /*
   * ⭐ 머리줄이 비울 폭을 문구 길이에 맞춘다(`pop-header-reserve`). 자리 폭에는 상태 칩과의
   *   간격 12 를 넣는다 — CSS 의 `--pop-screen-nav-w` 셈법(버튼 자리 + 간격)과 같다.
   */
  useHeaderReservedWidth(box, '--pop-screen-nav-w', visible, HEADER_GAP_PX);

  /* 지금 서 있는 화면은 뺀다 — 골라도 아무 일이 일어나지 않아 「눌리지 않는 항목」이 된다. */
  const candidates = access.screens.filter((candidate) => candidate.path !== pathname);
  const reason =
    access.state === 'unknown'
      ? REASONS.unknown
      : candidates.length === 0 && access.state !== 'loading'
        ? REASONS.empty
        : null;

  useEffect(() => {
    if (!visible) return;

    document.documentElement.dataset[HEADER_FLAG] = 'on';

    return () => {
      delete document.documentElement.dataset[HEADER_FLAG];
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="pop-screen-nav" ref={box}>
      <PopSelect
        aria-label={messages.popChrome.screenNav}
        actionLabel={messages.popChrome.screenNav}
        title={reason ?? undefined}
        disabled={reason !== null || access.state === 'loading'}
        value={null}
        options={candidates.map((candidate) => ({
          value: candidate.path,
          /* ⭐ 화면 코드(`P-01-01`)는 보이지 않고 이름만 보인다(사용자 지시 2026-09-15). */
          label: candidate.name,
        }))}
        onChange={(path) => {
          if (path === null) return;

          const screen = candidates.find((candidate) => candidate.path === path);
          if (screen === undefined) return;

          void navigate(destinationOf(screen, search));
        }}
      />
    </div>
  );
};
