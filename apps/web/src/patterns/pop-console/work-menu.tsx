import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { useAccessiblePopScreens } from '../pop-access';
import { usePopRegistration } from '../pop-registration';
import { destinationOf } from '../pop-screen-nav';
import { PopTaskBoard } from './task-board';

const t = messages.popChrome.console.menu;

export interface PopWorkMenuProps {
  pathname: string;
  search: string;
  onClose: () => void;
}

/**
 * **작업 메뉴** — 이 단말이 갈 수 있는 화면을 부서(업무 영역)별 타일로 보인다.
 *
 * ⭐ **[화면 이동] 드롭다운을 대신한다.** 5개씩 넘기는 목록은 화면이 20개에 이르면 원하는
 *    화면을 찾는 데 터치가 여러 번 든다. 영역별 타일은 한눈에 다 보이고 한 번에 간다.
 *
 * ⛔ **판정 근거는 같다**(`pop-access` · 공유계약 G-34). 서버가 허용한 코드와 설치된 화면의
 *    교집합만 세우고, 못 받았으면 감추지 않고 사유를 적는다(G-2).
 */
export const PopWorkMenu = ({ pathname, search, onClose }: PopWorkMenuProps) => {
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();
  const { restart } = usePopRegistration();

  const reason =
    access.state === 'loading'
      ? t.loading
      : access.state === 'unknown'
        ? t.unknown
        : access.state === 'empty'
          ? t.empty
          : null;

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      /* ⛔ 스치는 손에 닫히지 않는다 — POP 창 공통 규칙(#1005). */
      closeOnBackdropClick={false}
      title={t.title}
      footer={
        <>
          {/*
           * ⭐ **단말 재등록으로 들어가는 유일한 길**(P-CO-01 §5-1 · 공유계약 F-4) — 진입 페이지의
           *    머리줄에 있던 것을 옮겼다. 설치 담당자용이라 작업자 단추들과 떨어진 창 바닥에 둔다.
           *    잘못된 단말로 등록되면 사번부터 막히므로, 사번 없이도 눌려야 한다.
           *
           * ⛔ 큐가 남은 채 다른 단말로 바꾸는 것은 적용 단계가 막는다 — 여기서 막지 않는다.
           */}
          <Button
            className="pop-console-dialog-action"
            variant="text"
            onClick={() => {
              onClose();
              restart();
            }}
          >
            {messages.workerAssignment.registration.reRegister}
          </Button>
          <Button className="pop-console-dialog-action" variant="outlined" onClick={onClose}>
            {t.close}
          </Button>
        </>
      }
    >
      {reason !== null ? (
        <p className="pop-console-menu__reason">{reason}</p>
      ) : (
        <PopTaskBoard
          screens={access.screens}
          pathname={pathname}
          onPick={(screen) => {
            onClose();
            void navigate(destinationOf(screen, search));
          }}
        />
      )}
    </Dialog>
  );
};
