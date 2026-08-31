import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ExistingRequestView } from './types';

const t = messages.materialIssueRequest;

/**
 * 서버가 준 시각 글자를 사람이 읽는 꼴로 다듬는다 — `2026-09-01T14:00:00+09:00` → `2026-09-01 14:00`.
 *
 * ⛔ **다시 계산하지 않는다.** `Date` 로 파싱해 되찍으면 브라우저 시간대에 따라 **다른 순간으로
 * 보인다** — 서버가 이미 offset 을 붙여 보낸 값이라 그 자리의 시각이 정본이다. 여기서는 글자를
 * 자르기만 한다.
 *
 * 꼴이 다르면 **건드리지 않고 그대로 보인다** — 못 알아본 값을 잘라 내면 없는 시각을 지어낸다.
 */
export const formatRequiredAt = (value: string | null): string => {
  if (value === null) return t.values.empty;

  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);

  return match === null ? value : `${match[1]} ${match[2]}`;
};

export interface ExistingRequestBannerProps {
  requests: readonly ExistingRequestView[];
  /** 전체 건수. 목록은 첫 쪽뿐이라 길이로 대신하지 않는다 */
  total: number;
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
export const ExistingRequestBanner = ({ requests, total }: ExistingRequestBannerProps) => {
  if (total === 0) return null;

  return (
    <div className="banner-slot">
      <AlertBanner variant="warning" title={t.warnings.existingRequestsTitle}>
        {t.warnings.existingRequests(total)}
        <ul>
          {requests.map((request) => (
            <li key={request.materialIssueRequestId}>
              {t.warnings.existingRequestRow(
                request.issueRequestNo,
                request.statusCode,
                formatRequiredAt(request.requiredAt),
              )}
            </li>
          ))}
        </ul>
        {/* 목록이 첫 쪽뿐임을 밝힌다 — 「N건」과 눈에 보이는 줄 수가 갈릴 수 있다. */}
        {total > requests.length && (
          <span className="field-note">{t.warnings.existingRequestsTruncated}</span>
        )}
      </AlertBanner>
    </div>
  );
};
