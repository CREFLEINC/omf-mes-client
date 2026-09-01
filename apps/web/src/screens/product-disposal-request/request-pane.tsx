import { AlertBanner, Checkbox, Select, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { LookupSource } from '../../patterns/lookup-display';
import type { RouteState } from './queries';
import { reasonError, REASON_MAX, type DisposalDraft } from './request-draft';
import type { DisposalPartner } from './types';

const t = messages.productDisposalRequest;

const RouteLine = ({ route }: { route: RouteState }) => {
  const r = t.request;

  switch (route.kind) {
    case 'pending':
      return <span className="field-note">{r.routeChecking}</span>;
    case 'found':
      return <span className="field-note">{r.routeFound}</span>;
    case 'missing':
      return <AlertBanner variant="error">{r.routeMissing}</AlertBanner>;
    case 'failed':
      return <AlertBanner variant="error">{r.routeFailed}</AlertBanner>;
    default:
      /* ⛔ 「없다」가 아니라 「물어보지 못했다」다 — 둘을 같은 말로 적으면 없는 문제를 찾으러 간다. */
      return <AlertBanner variant="info">{r.routeUnavailable}</AlertBanner>;
  }
};

export interface RequestPaneProps {
  draft: DisposalDraft;
  showError: boolean;
  route: RouteState;
  qtyText: string;
  onChange: (patch: Partial<DisposalDraft>) => void;
}

/**
 * ② 폐기 요청.
 *
 * ⭐ **사유가 처분 사유로 채워져 온다**(§5-5) — 결재함에서 이 문장이 목록 요약을 겸하므로
 * 인용해 두면 **승인자가 판정 근거를 바로 본다.** ⚠ 편집은 허용한다.
 *
 * ⛔ **폐기 «계정»을 묻는 칸이 없다** — 회계는 이 시스템 밖이다(DR-009). 없는 것이 정상이라
 * 그 사실을 적어 둔다.
 */
export const RequestPane = ({ draft, showError, route, qtyText, onChange }: RequestPaneProps) => (
  <section className="pane" aria-label={t.panes.request}>
    <h2>{t.panes.request}</h2>

    <TextArea
      label={t.request.reasonLabel}
      value={draft.reason}
      required
      fullWidth
      rows={3}
      maxLength={REASON_MAX}
      error={showError ? reasonError(draft.reason) : undefined}
      helperText={t.request.reasonHelp}
      onChange={(event) => onChange({ reason: event.target.value })}
    />

    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.request.qtyLabel}</dt>
        <dd>{qtyText}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.request.routeLabel}</dt>
        <dd>
          <RouteLine route={route} />
        </dd>
      </div>
    </dl>

    {/* A-11 — 「없어야 정상」인 것에 사유를 적는다. 조용히 빼면 빠뜨린 것으로 읽힌다. */}
    <p className="field-note">{t.withdrawn.account}</p>
  </section>
);

export interface IssuePaneProps {
  draft: DisposalDraft;
  partners: readonly DisposalPartner[];
  isPartnersPending: boolean;
  isPartnersError: boolean;
  issueTypes: LookupSource;
  issueReasons: LookupSource;
  onChange: (patch: Partial<DisposalDraft>) => void;
}

/**
 * ③ 승인 후 — 기타출고.
 *
 * ⭐ **승인은 자물쇠를 풀 뿐이다**(J-8) — 승인이 끝나도 출고는 «여기서 다시» 눌러야 한다.
 *
 * ⭐ **자체 폐기를 체크하면 폐기 거래처를 비활성하고 값을 비운다**(DR-013 · 계약 명시) —
 * 나가서 없어지는 물건에는 도착지가 없다.
 */
export const IssuePane = ({
  draft,
  partners,
  isPartnersPending,
  isPartnersError,
  issueTypes,
  issueReasons,
  onChange,
}: IssuePaneProps) => {
  const partnerId = useId();
  const partnerNoteId = `${partnerId}-note`;
  const typeId = useId();
  const reasonId = useId();

  const partnerNote = isPartnersError
    ? t.issue.partnerFailed
    : partners.length === 0 && !isPartnersPending
      ? t.issue.partnerPending
      : undefined;

  return (
    <section className="pane" aria-label={t.panes.issue}>
      <h2>{t.panes.issue}</h2>

      <div className="banner-slot">
        <AlertBanner variant="info">{t.issue.unlockNote}</AlertBanner>
      </div>

      <div className="filter-bar">
        <div className="field-cell wide-select">
          <label className="field-label" htmlFor={typeId}>
            {t.issue.typeLabel}
          </label>
          <Select
            id={typeId}
            options={issueTypes.entries.map((entry) => ({
              value: entry.value,
              label: entry.label,
            }))}
            value={draft.issueTypeCode === '' ? null : draft.issueTypeCode}
            placeholder={t.issue.typeFixed}
            onChange={(value) => onChange({ issueTypeCode: value })}
          />
        </div>
        <div className="field-cell wide-select">
          <label className="field-label" htmlFor={reasonId}>
            {t.issue.reasonLabel}
          </label>
          <Select
            id={reasonId}
            options={issueReasons.entries.map((entry) => ({
              value: entry.value,
              label: entry.label,
            }))}
            value={draft.issueReasonCode === '' ? null : draft.issueReasonCode}
            placeholder={t.issue.reasonLabel}
            onChange={(value) => onChange({ issueReasonCode: value })}
          />
        </div>
      </div>

      <div className="check-group">
        <Checkbox
          label={t.issue.selfDisposal}
          checked={draft.isSelfDisposal}
          /* ⭐ 체크하면 거래처 값을 «함께» 비운다 — 남겨 두면 도착지 짝이 어긋난다. */
          onChange={(event) => onChange({ isSelfDisposal: event.target.checked, partnerId: '' })}
        />
      </div>
      <p className="field-note">{t.issue.selfDisposalHelp}</p>

      <div className="field-cell wide-select">
        <label className="field-label" htmlFor={partnerId}>
          {t.issue.partnerLabel}
        </label>
        <Select
          id={partnerId}
          options={partners.map((partner) => ({
            value: String(partner.partnerId),
            label: partner.label,
          }))}
          value={draft.partnerId === '' ? null : draft.partnerId}
          placeholder={partners.length === 0 ? t.issue.partnerEmpty : t.issue.partnerPlaceholder}
          disabled={draft.isSelfDisposal}
          aria-describedby={partnerNote === undefined ? undefined : partnerNoteId}
          onChange={(value) => onChange({ partnerId: value })}
        />
        {partnerNote !== undefined && (
          <span id={partnerNoteId} className="field-note">
            {partnerNote}
          </span>
        )}
      </div>
    </section>
  );
};
