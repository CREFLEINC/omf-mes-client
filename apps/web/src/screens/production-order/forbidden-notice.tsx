import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { ApiRequestError } from '../../patterns/request';

const t = messages.erpWorkOrderFlow.access;

/**
 * 권한 없음(403)인가. 정규화 전 상태 코드로 본다. 서버가 403을 오류 봉투(`errors[]`)에 담아 보내면
 * 정규화가 검증 오류로 접으며 상태 코드를 버리기 때문이다(LOT 추적 `load-failure.tsx`와 같다).
 */
export const isForbidden = (error: unknown): boolean =>
  error instanceof ApiRequestError && error.httpStatus === 403;

/**
 * 권한 없음 안내. 다시 조회해도 같은 답이라 [다시 시도]를 두지 않고, 없는 권한과 누구에게 요청할지를 말한다.
 * `menuPath`는 권한을 주는 메뉴 경로(사이드바 이름 그대로)다. 화면은 사이드바 자료를 부를 수 없어 라우트가 넘긴다.
 */
export const ForbiddenNotice = ({ menuPath }: { menuPath: string | null }) => (
  <AlertBanner variant="error" title={t.forbiddenTitle}>
    {menuPath === null ? t.forbiddenNoMenu : t.forbidden(menuPath)}
  </AlertBanner>
);
