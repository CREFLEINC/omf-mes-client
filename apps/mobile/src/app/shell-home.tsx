import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

// 스캔 퍼스트 홈이 설 때까지의 임시 진입점이다. Capacitor 셸에는 주소창이 없어
// 링크가 없으면 붙인 화면을 열 수단이 없다.
export const ShellHome = () => {
  return (
    <nav aria-label="화면 목록">
      <ul>
        <li>
          <Link to="/material-location">{messages.materialLocation.title}</Link>
        </li>
      </ul>
    </nav>
  );
};
