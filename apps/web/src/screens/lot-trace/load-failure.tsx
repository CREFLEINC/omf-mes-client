import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { ApiRequestError } from '../../patterns/request';

const t = messages.lotTrace;

export type LoadCause = 'forbidden' | 'notFound' | 'other';

/**
 * 불러오기 실패의 원인. 권한 없음과 없는 LOT은 정규화 전 상태 코드로 본다. 서버가 403을 오류 봉투
 * (`errors[]`)에 담아 보내면 정규화가 검증 오류로 접으며 상태 코드를 버리기 때문이다.
 */
export const toLoadCause = (error: unknown): LoadCause => {
  if (!(error instanceof ApiRequestError)) return 'other';
  if (error.httpStatus === 403) return 'forbidden';
  if (error.httpStatus === 404) return 'notFound';
  return 'other';
};

export interface LoadFailureProps {
  error: unknown;
  /** 그 밖의 실패에 보일 제목. */
  title: string;
  description?: string;
  onRetry: () => void;
}

/**
 * 목록과 사슬의 불러오기 실패. 권한 없음(403)과 없는 LOT(404)은 다시 조회해도 같은 답이라
 * [다시 조회]를 두지 않고 원인과 할 일을 보인다. 그 밖의 실패만 [다시 조회]를 둔다.
 */
export const LoadFailure = ({ error, title, description, onRetry }: LoadFailureProps) => {
  const cause = toLoadCause(error);
  if (cause === 'forbidden') {
    return (
      <AlertBanner variant="error" title={t.access.forbiddenTitle}>
        {t.access.forbidden}
      </AlertBanner>
    );
  }
  if (cause === 'notFound') {
    return (
      <AlertBanner variant="warning" title={t.access.notFoundTitle}>
        {t.access.notFound}
      </AlertBanner>
    );
  }
  return (
    <AlertBanner
      variant="error"
      title={title}
      action={
        <Button size="sm" variant="outlined" onClick={onRetry}>
          {t.list.retry}
        </Button>
      }
    >
      {description}
    </AlertBanner>
  );
};
