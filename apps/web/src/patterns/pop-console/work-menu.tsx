import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { useAccessiblePopScreens } from '../pop-access';
import type { PopScreen } from '../pop-screen-catalog';
import { destinationOf } from '../pop-screen-nav';

const t = messages.popChrome.console.menu;

type MenuGroup = keyof typeof t.groups;

/**
 * 화면 코드의 업무 번호로 묶는다 — `P-01`·`P-06` 자재·창고, `P-02` 생산, `P-04` 출하, `P-05` 설비.
 *
 * ⚠ 새 업무 번호가 생기면 여기 한 줄을 더한다. 모르는 번호는 자재·창고 묶음에 둔다 — 감추면
 *   허용된 화면인데도 갈 길이 사라진다.
 */
export const menuGroupOf = (screen: PopScreen): MenuGroup => {
  if (screen.code.startsWith('P-02')) return 'production';
  if (screen.code.startsWith('P-04')) return 'shipping';
  if (screen.code.startsWith('P-05')) return 'equipment';

  return 'materials';
};

const GROUP_ORDER: readonly MenuGroup[] = ['production', 'materials', 'shipping', 'equipment'];

export interface PopWorkMenuProps {
  pathname: string;
  search: string;
  onClose: () => void;
}

/**
 * **작업 메뉴** — 이 단말이 갈 수 있는 화면을 업무별 타일로 보인다.
 *
 * ⭐ **[화면 이동] 드롭다운을 대신한다.** 5개씩 넘기는 목록은 화면이 20개에 이르면 원하는
 *    화면을 찾는 데 터치가 여러 번 든다. 묶음별 타일은 한눈에 다 보이고 한 번에 간다.
 *
 * ⛔ **판정 근거는 같다**(`pop-access` · 공유계약 G-34). 서버가 허용한 코드와 설치된 화면의
 *    교집합만 세우고, 못 받았으면 감추지 않고 사유를 적는다(G-2).
 */
export const PopWorkMenu = ({ pathname, search, onClose }: PopWorkMenuProps) => {
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();

  const groups = GROUP_ORDER.map((group) => ({
    group,
    screens: access.screens.filter((screen) => menuGroupOf(screen) === group),
  })).filter((entry) => entry.screens.length > 0);

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
      title={t.title}
      footer={
        <Button variant="outlined" size="xl" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      {reason !== null ? (
        <p className="pop-console-menu__reason">{reason}</p>
      ) : (
        <div className="pop-console-menu">
          {groups.map(({ group, screens }) => (
            <section key={group} className="pop-console-menu__group" aria-label={t.groups[group]}>
              <h3>{t.groups[group]}</h3>
              <div className="pop-console-menu__tiles">
                {screens.map((screen) => (
                  <Button
                    key={screen.path}
                    variant={screen.path === pathname ? 'filled' : 'outlined'}
                    size="2xl"
                    aria-current={screen.path === pathname ? 'page' : undefined}
                    onClick={() => {
                      onClose();
                      if (screen.path !== pathname) void navigate(destinationOf(screen, search));
                    }}
                  >
                    {screen.name}
                  </Button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Dialog>
  );
};
