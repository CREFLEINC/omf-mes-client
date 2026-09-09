import { AlertBanner, Checkbox, Select, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { ISSUE_TYPE_OTHER } from './codes';
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
    /* ⛔ 「없다」와 「물어보지 못했다」를 갈라 적는다 — 같은 말로 적으면 없는 문제를 찾으러 간다. */
    case 'failed':
      return <AlertBanner variant="error">{r.routeFailed}</AlertBanner>;
  }
};

export interface RequestPaneProps {
  draft: DisposalDraft;
  showError: boolean;
  route: RouteState;
  qtyText: string;
  partners: readonly DisposalPartner[];
  isPartnersPending: boolean;
  isPartnersError: boolean;
  issueTypes: LookupSource;
  issueReasons: LookupSource;
  /**
   * 서버가 칸 옆에 놓으라고 준 오류.
   *
   * ⛔ **받아서 «내야» 한다.** `knownFields` 에 이름을 적어 두면 공통 훅이 그 오류를 인라인
   * 몫으로 빼는데, 화면이 안 내면 **배너에서도 빠져 어디에도 표시되지 않는다.**
   */
  fieldErrors: Record<string, string>;
  onChange: (patch: Partial<DisposalDraft>) => void;
}

/**
 * ② 폐기 요청 — **여기서 전표 본문이 다 채워진다.**
 *
 * ⭐ **사유가 처분 사유로 채워져 온다**(§5-5) — 결재함에서 이 문장이 목록 요약을 겸하므로
 * 인용해 두면 **승인자가 판정 근거를 바로 본다.** ⚠ 편집은 허용한다.
 *
 * ⛔ **자체 폐기·폐기 거래처·출고 유형·폐기 사유가 «여기» 선다**(통지 `#675` §2). 한때 이 넷을
 * 《③ 승인 후》 구획에 두었는데, **그 시점에는 저장될 수 없다** — 도착지 짝은 전표 «생성» 본문에
 * 실리고(`§5-7` 의 첫 호출) 그 뒤의 `:post` 본문은 영업일·발생시각 둘뿐이며 전표 헤더를 고칠
 * `PUT` 이 없다. 그대로 두면 **화면은 정상으로 보이는 채** 값이 나가지 않는다.
 *
 * ⭐ **자체 폐기를 체크하면 폐기 거래처를 비활성하고 값을 비운다**(DR-013 · 계약 명시) —
 * 나가서 없어지는 물건에는 도착지가 없다.
 *
 * ⛔ **폐기 «계정»을 묻는 칸이 없다** — 회계는 이 시스템 밖이다(DR-009). 없는 것이 정상이라
 * 그 사실을 적어 둔다.
 */
export const RequestPane = ({
  draft,
  showError,
  route,
  qtyText,
  partners,
  isPartnersPending,
  isPartnersError,
  issueTypes,
  issueReasons,
  fieldErrors,
  onChange,
}: RequestPaneProps) => {
  const partnerId = useId();
  const partnerNoteId = `${partnerId}-note`;
  const reasonId = useId();
  const reasonSelectId = `${reasonId}-select`;
  const reasonCodeErrorId = `${reasonId}-error`;

  const partnerNote = isPartnersError
    ? t.issue.partnerFailed
    : partners.length === 0 && !isPartnersPending
      ? t.issue.partnerPending
      : undefined;

  return (
    <section className="pane" aria-label={t.panes.request}>
      <h2>{t.panes.request}</h2>

      <TextArea
        label={t.request.reasonLabel}
        value={draft.reason}
        required
        fullWidth
        rows={3}
        maxLength={REASON_MAX}
        /* ⭐ 화면의 판정과 서버가 준 사유를 «함께» 본다 — 서버 것이 뒤에 와도 사라지지 않는다. */
        error={(showError ? reasonError(draft.reason) : undefined) ?? fieldErrors.reason}
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

      <div className="filter-bar">
        {/*
         * ⛔ **출고 유형은 고르는 값이 아니다** — 기타출고 고정이다(§4-B). 선택칸을 두면
         * 사용자가 «출하»를 고를 수 있고, 그러면 폐기가 출하로 나간다. 조회는 **이름을 얻는
         * 데만** 쓴다(통지 `#675` §5) — 코드를 그대로 보이면 사용자가 못 읽는다.
         */}
        <dl className="field-cell">
          <dt className="field-label">{t.issue.typeLabel}</dt>
          <dd>{lookupDisplayLabel(issueTypes, ISSUE_TYPE_OTHER)}</dd>
        </dl>
        <div className="field-cell wide-select">
          <label className="field-label" id={reasonId} htmlFor={reasonSelectId}>
            {t.issue.reasonLabel}
          </label>
          <Select
            id={reasonSelectId}
            options={issueReasons.entries.map((entry) => ({
              value: entry.value,
              label: entry.label,
            }))}
            value={draft.issueReasonCode === '' ? null : draft.issueReasonCode}
            placeholder={t.issue.reasonLabel}
            /*
             * ⛔ **오류를 칸에 «잇는다».** 잇지 않으면 화면에는 보이는데 소리로 읽는 사람은
             * 그 칸에 무엇이 잘못됐는지 듣지 못한다 — 이번에 고친 「어디에도 안 보인다」가
             * 그 사람에게는 그대로 남는다.
             *
             * ⚠ **DS `Select` 는 `aria-describedby` 를 받지 않는다**(받는 것은 `invalid` 와
             * `aria-labelledby` 뿐이다 · 실측). 그래서 오류 상태는 `invalid` 로 알리고, 글은
             * **라벨에 이어** 이름으로 함께 읽히게 한다 — 그 자리가 DS 가 내주는 유일한 길이다.
             */
            invalid={fieldErrors.reasonCode !== undefined}
            aria-labelledby={
              fieldErrors.reasonCode === undefined ? reasonId : `${reasonId} ${reasonCodeErrorId}`
            }
            onChange={(value) => onChange({ issueReasonCode: value })}
          />
          {fieldErrors.reasonCode !== undefined && (
            <span id={reasonCodeErrorId} className="field-error">
              {fieldErrors.reasonCode}
            </span>
          )}
        </div>
      </div>

      <div className="check-group">
        <Checkbox
          /*
           * ⛔ **이름을 `aria-label` 로 «못박는다».** 자식 글만 두면 실기 브라우저에서 접근성
           * 이름이 「on」으로 잡힌다(실측 — 표의 체크박스는 `aria-label` 이 있어 멀쩡했다).
           * jsdom 의 이름 계산은 자식 글을 집어 시험은 통과하므로, 시험만 믿으면 못 잡는다.
           */
          aria-label={t.issue.selfDisposal}
          checked={draft.isSelfDisposal}
          /* ⭐ 체크하면 거래처 값을 «함께» 비운다 — 남겨 두면 도착지 짝이 어긋난다. */
          onChange={(event) => onChange({ isSelfDisposal: event.target.checked, partnerId: '' })}
        >
          {t.issue.selfDisposal}
        </Checkbox>
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

      {/* A-11 — 「없어야 정상」인 것에 사유를 적는다. 조용히 빼면 빠뜨린 것으로 읽힌다. */}
      <p className="field-note">{t.withdrawn.account}</p>
    </section>
  );
};
