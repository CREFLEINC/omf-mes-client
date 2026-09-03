import { AlertBanner, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ReissueReasonOption } from './queries';

const t = messages.shippingPackingLabel.reissue;

export interface ReissuePaneProps {
  /** 고른 대상 중 이미 발행된 건수. 왜 이 구획이 펼쳐졌는지를 말한다. */
  alreadyIssuedCount: number;
  reasons: ReissueReasonOption[];
  isLoading: boolean;
  isError: boolean;
  value: string | null;
  onChange: (reissueReasonCode: string) => void;
}

/**
 * ③ 재출력 구획 — **재발행일 때만 펼친다.**
 *
 * ⚠ 늘 띄워 두면 그 184px 가 목록에서 빠져 **대상이 세 줄로 줄어든다**(스펙 §3-1). 세로
 * 예산의 슬랙이 0 이라 이 구획은 접었다 편다.
 *
 * ⛔ **사유 없이 보낼 수 없다.** 규약이 아니라 **DB 제약**이다 —
 * `ck_document_reissue_reason CHECK (issue_seq = 1 OR reissue_reason_code IS NOT NULL)` 이
 * 저장 자체를 막는다(스펙 §5-4). 화면이 먼저 막는 이유는 사용자가 이유 없이 실패를 보지
 * 않게 하기 위해서다.
 *
 * ⛔ **선택지를 화면이 지어내지 않는다.** 비어 오면 재발행을 열지 않고 **왜 못 하는지**
 * 보인다(공유계약 F-1 · G-2).
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ReissuePane = ({
  alreadyIssuedCount,
  reasons,
  isLoading,
  isError,
  value,
  onChange,
}: ReissuePaneProps) => {
  const isChoosable = !isLoading && !isError && reasons.length > 0;

  return (
    <section className="pop-slabel-reissue" aria-label={t.title}>
      <AlertBanner variant="warning">{t.notice(alreadyIssuedCount)}</AlertBanner>

      {isError ? <AlertBanner variant="error">{t.loadFailed}</AlertBanner> : null}
      {!isError && !isLoading && reasons.length === 0 ? (
        <AlertBanner variant="warning">{t.empty}</AlertBanner>
      ) : null}

      {isChoosable ? (
        <div className="pop-slabel-field">
          <span className="field-label">
            {t.label} <span className="pop-slabel-required">{t.required}</span>
          </span>
          <Select
            aria-label={t.label}
            size="xl"
            placeholder={t.placeholder}
            value={value}
            options={reasons.map((reason) => ({ value: reason.code, label: reason.name }))}
            onChange={onChange}
          />
        </div>
      ) : null}

      {/*
       * ⚠ **회차가 쌓인다는 것과 인쇄면에도 찍힌다는 것을 함께 말한다**(공유계약 K-1 · K-6).
       * 물리적으로 유통되는 라벨이라 현장에 1회차와 2회차가 함께 굴러다닌다 — 인쇄면에
       * 회차가 없으면 어느 것이 최신인지 알 수 없다.
       */}
      <p className="field-note pop-slabel-wide-note">{t.guide}</p>
    </section>
  );
};
