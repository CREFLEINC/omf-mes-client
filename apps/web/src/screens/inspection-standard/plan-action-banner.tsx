import { AlertBanner } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { SaveErrorBanner } from '../../patterns/master';

const t = messages.inspectionStandard;

/**
 * 이 화면이 뜻을 아는 거부 코드. 계약이 두 자리에 명시했다.
 * - 승인은 확정된 버전이 있어야 한다(`CONFIRMED_VERSION_REQUIRED`)
 * - 확정은 검사 항목이 1건 이상이어야 한다(`LINE_REQUIRED`)
 */
const KNOWN_CODES: Record<string, string> = {
  CONFIRMED_VERSION_REQUIRED: t.serverErrors.confirmedVersionRequired,
  LINE_REQUIRED: t.serverErrors.lineRequired,
};

/** 여러 줄일 때만 목록으로 낸다. 한 줄을 목록으로 내면 없는 항목 구분이 생긴다. */
const BannerLines = ({ lines }: { lines: string[] }): ReactNode => {
  if (lines.length <= 1) return lines[0] ?? null;

  return (
    <ul>
      {lines.map((line, index) => (
        <li key={`${String(index)}-${line}`}>{line}</li>
      ))}
    </ul>
  );
};

export interface PlanActionBannerProps {
  /** null이면 아무것도 렌더하지 않는다. */
  error: ApiError | null;
  /** 409가 있는 경로에만 준다. 없는 경로에 주면 헛수고를 시킨다 */
  onReload?: () => void;
}

/**
 * 승인·사용 중지·확정 같은 액션의 실패 배너.
 *
 * **화면이 뜻을 아는 거부 코드에만 화면 문구를 붙이고 나머지는 공통 저장 배너에 맡긴다.**
 * 서버가 그 코드에 빈 문구를 주는 일이 실제로 있어서 코드만으로 안내가 서야 하기 때문이다.
 * 서버가 함께 준 문구가 있으면 그것도 덧붙인다 — 삼키면 어디에도 보이지 않는 오류가 된다.
 *
 * 공통 배너를 통째로 대체하지 않는 이유는 409·403·네트워크·상태 잠김의 처리가 이미 거기 있고,
 * 이 화면만의 사정은 위 두 코드뿐이기 때문이다.
 */
export const PlanActionBanner = ({ error, onReload }: PlanActionBannerProps) => {
  if (error === null) return null;

  if (error.kind === 'validation') {
    const lines: string[] = [];

    for (const item of error.errors) {
      const known = KNOWN_CODES[item.code];

      if (known !== undefined) lines.push(known);
      if (item.message !== '') lines.push(item.message);
    }

    if (lines.length > 0) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="error" title={messages.httpError.title}>
            <BannerLines lines={lines} />
          </AlertBanner>
        </div>
      );
    }
  }

  return <SaveErrorBanner error={error} onReload={onReload} />;
};
