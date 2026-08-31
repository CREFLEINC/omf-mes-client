import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ExistingRequestView } from './types';

const t = messages.materialIssueRequest;

export interface ExistingRequestBannerProps {
  requests: readonly ExistingRequestView[];
}

/**
 * 같은 W/O 앞으로 이미 발행된 요청 경고 — **막지 않는다**(스펙 §6은 중복 요청을 허용한다).
 *
 * ⚠ **「미출고 요청」이라 적지 않는다.** 스펙 §6은 미출고 요청만 경고하라고 했지만 화면은 그것을
 * 가려낼 수 없다 — `statusCode` 값 목록이 미정이라 문자열로 거를 수 없고, 목록 응답에는
 * 라인(`issuedQty`)이 실리지 않는다(계약 실측). 좁힐 수 없는 것을 좁힌 척하는 대신 **문면을
 * 넓혀** 발행된 요청 전부를 보이고, 상태 글자를 서버가 준 그대로 나열해 사용자가 판단하게 한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ExistingRequestBanner = ({ requests }: ExistingRequestBannerProps) => {
  if (requests.length === 0) return null;

  return (
    <div className="banner-slot">
      <AlertBanner variant="warning" title={t.warnings.existingRequestsTitle}>
        {t.warnings.existingRequests(requests.length)}
        <ul>
          {requests.map((request) => (
            <li key={request.materialIssueRequestId}>
              {t.warnings.existingRequestRow(
                request.issueRequestNo,
                request.statusCode,
                request.requiredAt ?? t.values.empty,
              )}
            </li>
          ))}
        </ul>
      </AlertBanner>
    </div>
  );
};
