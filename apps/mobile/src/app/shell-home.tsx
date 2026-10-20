import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { useOutbox } from '../patterns/outbox';
import { useResumableTasks } from '../patterns/task-draft';
import { homeGroups } from './home-menu';
import './shell-home.css';

const t = messages.shellHome;

/**
 * 작업 목록.
 *
 * 관리웹은 좌측 레일로 옮겨 다니지만 이 셸은 그 자리를 두지 않는다 - 폭이 좁고 한 손으로
 * 장갑을 낀 채 쓰므로, 설계가 세 셸의 IA 를 각각 다르게 정했다. 관리웹은 메뉴 트리, POP 은
 * 태스크 모드, 모바일은 스캔 퍼스트 홈 타일이다.
 *
 * 타일은 두 줄로 세운다. 한 줄 카드로 두었을 때는 한 화면에 일곱 장만 들어가 아래 묶음은
 * 스크롤해야 보였다. 묶음 순서는 설계 IA 그대로다(`home-menu.ts`).
 *
 * 맨 위에는 지금 이 사람에게 걸린 것만 선다 - 적다가 나간 작업과 아직 못 보낸 기록. 없으면 서지
 * 않는다. 늘 세워 두면 0 이 자리만 차지한다.
 *
 * 글자 링크로 두지 않는다 - 기본 링크는 글자 높이만큼만 눌리고 그 높이는 손가락보다 작다.
 */
export const ShellHome = () => {
  const resumable = useResumableTasks();
  const { pending, rejected } = useOutbox();

  return (
    <nav aria-label={t.label} className="shell-home">
      {resumable.length === 0 ? null : (
        <section className="shell-home__group">
          <h2>{t.resume.label}</h2>
          <ul className="shell-home__resume">
            {resumable.map((task) => (
              <li key={task.to}>
                <Link
                  to={task.to}
                  className="shell-home__resume-card"
                  aria-label={t.resume.open(task.title)}
                >
                  <strong>{task.title}</strong>
                  <span>{task.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending === 0 && rejected.length === 0 ? null : (
        <section className="shell-home__group">
          <h2>{t.status.label}</h2>
          <ul className="shell-home__status">
            <li>
              <Link to="/outbox" className="shell-home__stat">
                <span>{t.status.pending}</span>
                <strong>{t.status.count(pending)}</strong>
              </Link>
            </li>
            <li>
              {/* 0 건을 경고색으로 그리면 문제가 없는데도 눈이 그리로 간다. */}
              <Link
                to="/rejections"
                className={
                  rejected.length === 0
                    ? 'shell-home__stat'
                    : 'shell-home__stat shell-home__stat--rejected'
                }
              >
                <span>{t.status.rejected}</span>
                <strong>{t.status.count(rejected.length)}</strong>
              </Link>
            </li>
          </ul>
        </section>
      )}

      {homeGroups.map((group) => (
        <section key={group.label} className="shell-home__group">
          <h2>{group.label}</h2>
          <ul className="shell-home__tiles">
            {group.screens.map((screen) => (
              <li key={screen.to}>
                <Link to={screen.to} className="shell-home__tile">
                  <Icon name={screen.icon} size={28} className="shell-home__icon" />
                  <strong>{screen.label}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
};
