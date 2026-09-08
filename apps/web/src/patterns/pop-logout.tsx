import { Button } from '@crefle/web-ui';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { setWorkerSession } from './worker-session';

/** 진입 화면 — 여기서는 「로그아웃」이 할 일이 없다. */
const ENTRY_PATH = '/pop/worker-assignment';

/**
 * 머리줄이 오른쪽을 비울지 말지를 여는 표식.
 *
 * ⛔ **버튼이 없는 화면에서는 비우지 않는다.** 자리만 비워 두면 진입 화면 머리줄 오른쪽에
 *    아무것도 없는 빈 칸이 남는다(실측 2026-09-08 — 사용자가 짚었다).
 */
const HEADER_FLAG = 'popLogout';

/**
 * **화면 어디서나 사번을 놓고 나가는 자리**(사용자 지시 2026-09-08).
 *
 * ⭐ **왜 화면 밖에 두는가.** POP 은 한 사람이 화면을 옮겨 다니며 쓰는 자리인데, 사번을 놓는
 * 길이 진입 화면에만 있었다 — 다른 화면으로 넘어가면 되돌아올 방법이 없어 단말을 껐다 켜야
 * 했다(실측). 화면 21개에 같은 버튼을 각각 붙이면 자리와 크기가 갈리므로, 라우터 바깥 겹에서
 * 한 번만 그린다.
 *
 * ⛔ **머리줄 위에 겹쳐 놓지 않는다.** 처음에는 떠 있는 버튼으로 두었더니 화면마다 다른 조작
 *    버튼을 가렸다 — 그래서 `.pop-header` 오른쪽에 **자리를 비워 두고**(`pop.css` 꼬리)
 *    그 자리에 앉힌다. 비운 만큼만 차지하므로 어느 화면의 무엇도 가리지 않는다.
 *
 * ⚠ **사번을 비우는 것으로 끝낸다.** 작업 세션(진행 중인 작업지시)까지 끊지 않는다 — 그것은
 *   서버가 가진 상태이고, 끊는 뜻의 조작은 「작업 중단」이 따로 있다. 여기서 겸하면 잠깐
 *   자리를 비우려던 사람이 작업을 끝내 버린다.
 */
export const PopLogoutButton = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const visible = pathname !== ENTRY_PATH;

  useEffect(() => {
    if (!visible) return;

    document.documentElement.dataset[HEADER_FLAG] = 'on';

    return () => {
      delete document.documentElement.dataset[HEADER_FLAG];
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="pop-logout">
      {/*
       * ⛔ **터치 등급(`pop-touch-*`)을 쓰지 않는다.** 그 등급은 「틀렸을 때 무엇이
       *    일어나는가」로 «크기를 키우는» 장치인데, 이 버튼은 작아야 한다는 것이
       *    요구다(사용자 지시 2026-09-08). 되돌리기도 쉽다 — 사번을 다시 넣으면 된다.
       */}
      <Button
        variant="filled"
        size="md"
        onClick={() => {
          setWorkerSession(null);
          void navigate(ENTRY_PATH, { replace: true });
        }}
      >
        로그아웃
      </Button>
    </div>
  );
};
