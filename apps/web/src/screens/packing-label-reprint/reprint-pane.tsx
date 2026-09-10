import { Button, Checkbox, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';
import { DOCUMENT_TYPE_CODES, type CodeValue, type ReprintTarget } from './types';

const t = messages.packingLabelReprint;

export interface ReprintPaneProps {
  targets: readonly ReprintTarget[];
  selectedRowIds: readonly string[];
  onToggle: (rowId: string) => void;
  /** 회차를 못 받았다 — 값이 비는 사유를 말한다 */
  summaryFailed: boolean;
  reasons: readonly CodeValue[];
  reasonsFailed: boolean;
  reasonCode: string;
  onReasonChange: (code: string) => void;
  /** 고른 대상에 재발행이 섞여 있어 사유가 필요하다 */
  reasonRequired: boolean;
  /** 서버가 사유 칸에 준 오류 */
  reasonServerError: string | null;
  /** 재출력 자체가 막힌 사유(권한·사번·단말). `null` 이면 막히지 않았다 */
  blockedReason: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
}

/** 발행 회차 한 줄. **「모른다」와 「0회」를 다르게 말한다.** */
const issueCountText = (target: ReprintTarget): string => {
  if (target.issueCount === null) return t.targets.issueCountUnknown;

  return target.issueCount === 0 ? t.targets.neverIssued : t.targets.issueCount(target.issueCount);
};

/**
 * 우단 《재출력 대상》.
 *
 * ⭐ **사유 칸을 예외 흐름에 숨기지 않는다**(스펙 §5-1 ⭐). 이 화면은 재발행이 정상 경로라
 * 사유가 기본 입력이다 — 대화상자 뒤에 두면 매번 한 걸음이 더 든다.
 */
export const ReprintPane = ({
  targets,
  selectedRowIds,
  onToggle,
  summaryFailed,
  reasons,
  reasonsFailed,
  reasonCode,
  onReasonChange,
  reasonRequired,
  reasonServerError,
  blockedReason,
  isSubmitting,
  onSubmit,
}: ReprintPaneProps) => {
  const reasonId = useId();
  const noteId = `${reasonId}-note`;

  const hasSelection = selectedRowIds.length > 0;
  const reasonMissing = reasonRequired && reasonCode === '';
  const canSubmit = blockedReason === null && hasSelection && !reasonMissing && !isSubmitting;

  const reasonNote = ((): string | null => {
    if (reasonServerError !== null) return reasonServerError;
    if (reasonsFailed) return t.reason.loadFailed;
    if (reasons.length === 0) return t.reason.empty;
    if (!hasSelection) return null;

    return reasonRequired ? t.reason.required : t.reason.notNeeded;
  })();

  return (
    <>
      {targets.length === 0 ? (
        <p className="field-note">{t.targets.empty}</p>
      ) : (
        <ul className="pop-reprint-targets">
          {targets.map((target) => {
            const selected = selectedRowIds.includes(target.rowId);
            const isTag = target.documentTypeCode !== DOCUMENT_TYPE_CODES.packingLabel;
            const kind = isTag ? t.targets.identificationTag : t.targets.packingLabel;

            return (
              <li
                key={target.rowId}
                className={[
                  'pop-reprint-target',
                  /*
                   * ⭐ **인식표는 그 LOT 아래로 들여 세운다**(사용자 지시 2026-09-10). 같은
                   * LOT 을 두고 「라벨과 인식표」라는 두 갈래가 있는 것이지, 서로 다른 대상이
                   * 넷 있는 것이 아니다.
                   */
                  isTag ? 'pop-reprint-target--child' : '',
                  target.disabledReason === null ? '' : 'pop-reprint-target--locked',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {/*
                 * ⭐ **줄 전체가 누르는 자리다.** 설계 §7 이 이 선택을 `Checkbox`(다중) 로
                 * 지정했는데, 상자 자체는 손가락보다 작다. `<label>` 로 줄을 감싸면 종류·번호
                 * 어디를 눌러도 골라지므로 **부품은 설계대로 두고 누를 넓이만** 넓힌다.
                 *
                 * ⛔ 줄마다 [ 선택 ] 버튼을 세우지 않는다 — 설계가 지정한 부품이 아니고,
                 *    72px 짜리 버튼이 줄마다 서면 대상 셋만으로도 구획이 화면 밖으로 넘친다
                 *    (실측 — 사유·[ 재출력 ]이 잘려 보이지 않았다).
                 */}
                <div className="pop-reprint-target-head">
                  <Checkbox
                    checked={selected}
                    disabled={target.disabledReason !== null}
                    onChange={() => {
                      onToggle(target.rowId);
                    }}
                  >
                    {/*
                     * ⭐ **종류가 위, 번호가 아래다**(사용자 지시 2026-09-10). 종류는 무엇을
                     * 뽑는지이고 번호는 어느 것인지라, 층을 두면 목록을 훑을 때 종류가 먼저
                     * 읽힌다.
                     */}
                    <span className="pop-reprint-kind">{kind}</span>{' '}
                    <span className="pop-reprint-name">{target.displayName}</span>
                  </Checkbox>
                  {/*
                   * ⭐ **한 줄에서 다 읽힌다**(사용자 지시 2026-09-10) — 「종류·번호」가 왼쪽,
                   * 「발행 상태」가 오른쪽 끝이다. 세로로 쌓아 두었더니 줄 하나가 화면의 다섯
                   * 줄을 먹어, 대상 넷이면 사유·[재출력]이 접힘선 아래로 갔다.
                   *
                   * ⛔ **수량을 내지 않는다**(사용자 지시 2026-09-10) — 설계 §3 와이어에 없는
                   *    값이고, 담긴 수량은 왼쪽 《포장 단위》의 내용물 표가 이미 말한다.
                   *
                   * ⭐ 이력이 0 이면 재출력이 아니라 처음 뽑는 것이라 색을 가른다(스펙 §6).
                   *
                   * ⛔ **고를 수 없는 줄에는 이력 칩을 세우지 않는다.** 그 줄의 이력은 애초에
                   *    조회하지 않아(`useIssueSummary` 는 LOT 라벨만 묻는다) 「모른다」가 뜬 것인데,
                   *    못 뽑는 까닭은 이력이 아니라 개체를 알 수 없다는 것이다 — 아래 한 줄이
                   *    그것을 말한다.
                   */}
                  <span className="pop-reprint-target-meta">
                    {target.disabledReason === null && (
                      <Chip
                        status={
                          target.issueCount === null
                            ? 'warning'
                            : target.issueCount === 0
                              ? 'success'
                              : 'info'
                        }
                      >
                        {issueCountText(target)}
                      </Chip>
                    )}
                  </span>
                </div>
                {/* ⛔ 고를 수 없는 줄은 사유를 함께 낸다 — 비활성만 두면 왜 안 되는지 알 수 없다 */}
                {target.disabledReason !== null && (
                  <p className="field-note">{target.disabledReason}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {summaryFailed && <p className="field-error">{t.targets.summaryFailed}</p>}

      {/*
       * 구분선 — 설계 §3 도면이 대상 목록과 재출력 사유 사이에 그은 선이다. 위는 «무엇을
       * 다시 뽑을 것인가»이고 아래는 «왜 다시 뽑는가»라, 선 하나가 그 경계를 말한다.
       */}
      <div className="pop-reprint-rule" />

      <div className="field-cell pop-reprint-reason">
        <label className="field-label" htmlFor={reasonId}>
          {t.reason.label}
        </label>
        {/*
         * ⚠ **크기를 넘긴다.** 안 넘기면 DS 가 기본(40px)으로 그리고, POP 규칙이 트리거만
         *   56 으로 늘려 **칸이 자기 상자를 넘친다** — 아래 [ 재출력 ]과 겹쳐 보였다(실측).
         *   부품이 스스로 배치하게 두는 것이 맞다.
         */}
        <Select
          id={reasonId}
          size="xl"
          options={reasons.map((reason) => ({ value: reason.code, label: reason.codeName }))}
          value={reasonCode === '' ? null : reasonCode}
          onChange={onReasonChange}
          placeholder={t.reason.placeholder}
          disabled={reasons.length === 0}
          aria-describedby={reasonNote === null ? undefined : noteId}
        />
        {reasonNote !== null && (
          <span
            id={noteId}
            className={reasonMissing || reasonsFailed ? 'field-error' : 'field-note'}
          >
            {reasonNote}
          </span>
        )}
      </div>

      <Button size="2xl" className="pop-reprint-submit" disabled={!canSubmit} onClick={onSubmit}>
        {isSubmitting ? t.action.submitting : t.action.submit}
      </Button>

      {/*
       * 막힌 사유는 버튼 옆에 둔다 — 누를 수 없는 자리에서 이유를 찾는다.
       *
       * ⛔ **「대상을 고르세요」를 두지 않는다**(사용자 지시). 설계에 없는 문구였다 — 이 문서에
       *    「고르세요 · 선택하세요」가 0 건이다. 무엇을 고르는 자리인지는 바로 위 목록이 말한다.
       */}
      {blockedReason !== null && <p className="field-error">{blockedReason}</p>}
    </>
  );
};
