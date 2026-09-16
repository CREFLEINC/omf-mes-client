import type { ApiError } from '@omf-mes/api-client';
import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { SaveErrorBanner } from '../../patterns/master';

const t = messages.usersRoles;

/**
 * 서버가 마지막 관리자 제거를 막을 때 쓰는 코드. **계약이 정한 값이다.**
 *
 * 판정 기준은 「역할」이 아니라 **그 권한 보유자 수**다 — 고객이 새 역할을 만들어 같은 권한을
 * 준 경우를 역할로 세면 못 센다. 화면에는 그 수를 셀 근거가 없어 **미리 막지 않고** 서버의
 * 거부를 옮기기만 한다.
 */
export const LAST_ADMIN_CODE = 'LAST_ADMIN';

export interface PermissionSaveBannerProps {
  /** null이면 아무것도 렌더하지 않는다. */
  error: ApiError | null;
}

/** 이 저장 실패가 마지막 관리자 차단인가. `kind`를 가리지 않고 **코드만** 본다. */
const isLastAdmin = (error: ApiError): boolean =>
  'errors' in error && error.errors.some((item) => item.code === LAST_ADMIN_CODE);

/**
 * 기능 권한 저장 실패 배너.
 *
 * **마지막 관리자 차단만 화면의 말로 되말한다.** 서버 `code`는 계약이고 `message`는 말씨인데,
 * 이 거부는 「무엇을 하면 되는가」가 화면 쪽에 있다 — 다른 역할에 그 권한을 먼저 주라는
 * 안내는 이 격자를 보고 있는 사람만 바로 실행할 수 있다(공유계약 G-3).
 *
 * ⛔ **그 밖의 오류는 건드리지 않는다.** 되말하지 못하는 것까지 삼키면 서버가 새 오류를
 * 내려도 화면이 옛말만 하게 된다 — 공용 배너로 그대로 넘긴다.
 */
export const PermissionSaveBanner = ({ error }: PermissionSaveBannerProps): ReactNode => {
  if (error === null) return null;

  if (!isLastAdmin(error)) return <SaveErrorBanner error={error} />;

  return (
    <AlertBanner variant="error" title={t.permission.lastAdmin.title}>
      {t.permission.lastAdmin.description}
    </AlertBanner>
  );
};
