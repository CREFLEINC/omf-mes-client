import { AlertBanner, Button, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CreatedPoView } from './types';

const t = messages.poRegister;

/**
 * 상신이 어디까지 갔는가 — **화면이 확인한 것만 담는다.**
 *
 * | 갈래 | 무슨 일이 있었나 | 화면이 하는 말 |
 * | --- | --- | --- |
 * | `idle` | 전표만 만들어졌다 | 「만들었습니다」 + 사유 칸과 「승인 요청」 |
 * | `submitting` | 상신 요청이 나가는 중 | 위 + 「올리는 중」 |
 * | `submitted` | 결재에 올라갔다 | 「올렸습니다」 + **결재함 안내** |
 * | **`failed`** | **전표는 남고 상신만 실패했다** | 그 사실을 **정확히** 말하고 다시 올릴 길을 준다 |
 *
 * **넷째 갈래가 이 구획이 갈래를 갖는 이유다.** 통째로 실패라고 말하면 사용자가 처음부터 다시
 * 만들어 **전표가 두 벌** 남고, 통째로 성공이라고 말하면 결재에 올라가지 않은 발주를 올라간
 * 것으로 믿는다. 화면은 **등록 응답을 받았다** — 확인한 사실이라 말할 수 있다.
 */
export type SubmitPhase = 'idle' | 'submitting' | 'submitted' | 'failed';

export interface ResultPaneProps {
  created: CreatedPoView;
  phase: SubmitPhase;
  /** 친 사유 글자 그대로. **판정과 조립은 `reason-draft.ts` 한 곳이 한다** */
  reason: string;
  /** 사유 칸에 붙는 서버 오류. 화면이 잡은 것과 서버가 준 것이 **같은 칸에** 붙는다 */
  reasonError?: string;
  /** 상신이 막힌 사유. `null`이면 올릴 수 있다 — **사유 없이 잠그지 않는다**(배치 규범 4) */
  blockReason: string | null;
  /**
   * 상신 실패 배너 슬롯. **다시 누를 버튼 옆에 선다** — 다른 자리에 두면 무엇이 막았는지
   * 놓친 채 같은 버튼을 다시 누른다. 확인 창이 열려 있는 동안에는 창 안에 서므로 여기는 빈다.
   */
  banner: ReactNode;
  onChangeReason: (value: string) => void;
  /** 확인을 **요청한다** — 보내는 것은 확인 창을 지난 뒤다. */
  onRequestSubmit: () => void;
}

/**
 * 등록 결과와 상신 자리 — **화면이 확인한 것만 말한다.**
 *
 * | 말한다 | 말하지 않는다 |
 * | --- | --- |
 * | 「발주 전표 `SAMPLE-PO-…`를 만들었습니다」 · 서버가 준 **상태 코드 그대로** · 서버가 저장한 줄 수 | 「발주가 확정됐습니다」 — 상태의 뜻을 화면이 옮겨 적지 않는다(공유계약 G-2) |
 * | ERP 발주번호가 **비어 있다는 사실**과 언제 채워지는지 | 「ERP 연계에 실패했습니다」 — 아직 매칭 시점이 아닌 것과 실패는 다른 사실이다(`omf-mes#72`) |
 * | 「결재에 올렸습니다」 + **진행은 결재함에서** | **결재 대기 목록·진행 단계** — 결재함(W-CO-09)이 정본이다(계획 결정 11) |
 * | 「전표는 만들어졌고 결재에는 올라가지 않았습니다」 | 「처리에 실패했습니다」 — 전표가 남았는데 없는 것처럼 말하는 것이 된다 |
 * | — | **승인 요청 번호** — 응답이 내부 식별자 하나뿐이라 낼 번호가 없다(`omf-mes#44`) |
 *
 * **등록과 상신은 별개 동작이다**(착수 이슈 §6 ③ · 계획 결정 9). 이 구획은 등록이 끝난 뒤에만
 * 서므로 「승인 요청」이 등록 성공 뒤에야 존재한다 — 한 번의 조작이 두 요청을 잇지 않는다.
 *
 * **사라지는 알림으로 내지 않는다.** 전표번호는 적어 두거나 옮겨 적는 값이라 몇 초 뒤에
 * 없어지면 안 된다 — 배너가 살아 있는 영역으로 알리되(디자인 시스템이 `success`에 `status`를
 * 준다) 글자는 화면에 남는다. **전표번호는 네 갈래 어디에서도 남는다.**
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ResultPane = ({
  created,
  phase,
  reason,
  reasonError,
  blockReason,
  banner,
  onChangeReason,
  onRequestSubmit,
}: ResultPaneProps) => {
  const blockReasonId = useId();

  /**
   * **올린 뒤에는 사유 칸과 버튼을 두지 않는다.** 칠 수 있는데 보낼 수 없는 칸은 사용자가 쓴
   * 글을 버리게 만들고, 잠긴 버튼만 남기면 「무엇이 풀리는 조건인가」에 화면이 답하지 못한다 —
   * 그 자리는 결재함 안내가 대신한다(전례 재상신 구획과 같은 규율).
   */
  const canSubmit = phase !== 'submitted';

  return (
    <section className="pane" aria-label={t.result.label}>
      {phase === 'failed' ? (
        /* 부분 실패를 성공과 같은 모양으로 그리면 훑고 지나간다 — 사람이 이어서 할 일이 남았다. */
        <AlertBanner variant="warning" title={t.result.submitFailedTitle(created.purchaseOrderNo)}>
          {t.result.submitFailedDescription}
        </AlertBanner>
      ) : (
        <AlertBanner
          variant="success"
          title={
            phase === 'submitted'
              ? t.result.submittedTitle(created.purchaseOrderNo)
              : t.result.createdTitle(created.purchaseOrderNo)
          }
        >
          {phase === 'submitted' ? t.result.submittedDescription : t.result.createdDescription}
        </AlertBanner>
      )}

      {/* 나가는 중이라는 사실은 배너를 갈아 끼우지 않고 덧붙인다 — 전표를 만든 사실이 그대로 남는다. */}
      {phase === 'submitting' && <p className="field-note">{t.result.submitting}</p>}

      {/* 낼 번호가 없다는 사실은 **올린 뒤에만** 적는다 — 그전에는 물을 일이 없는 값이다. */}
      {phase === 'submitted' && <p className="field-note">{t.result.submittedNoRequestNo}</p>}

      {/*
       * **이름 하나에 값 하나로 짝을 맞춘다.** `<dt>` 하나 뒤의 `<dd>`는 전부 그 이름의 값이라,
       * 상태 칩을 전표번호 아래에 그대로 두면 보조기술이 「전표번호: SAMPLE-PO-…, SAMPLE_…」로
       * 읽는다 — 이름 없는 값이 아니라 **틀린 이름이 붙은 값**이 된다.
       */}
      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.result.purchaseOrderNo}</dt>
          <dd>{created.purchaseOrderNo}</dd>
        </div>
        <div className="field-cell">
          {/*
           * **어느 시점의 값인지를 라벨이 밝힌다.** 이 코드는 전표를 만들 때 서버가 준 것이고
           * 그 뒤 상신·승인으로 달라진다 — 상신 성공 뒤에도 **다시 읽어 오지 않는** 이유는
           * 그러면 이 구획이 상세 조회에 매여 **치던 값이 사라지는 축**(`omf-mes#43`)이 하나
           * 늘기 때문이다. 지금 상태는 결재함이 정본이다.
           */}
          <dt className="field-label">{t.result.createdStatusCode}</dt>
          <dd>
            <Chip variant="status" size="sm">
              {created.statusCode}
            </Chip>
          </dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.result.erpPurchaseOrderNo}</dt>
          <dd>
            {created.erpPurchaseOrderNo === null ? (
              <Chip variant="status" status="warning" size="sm">
                {t.result.erpUnmatched}
              </Chip>
            ) : (
              created.erpPurchaseOrderNo
            )}
          </dd>
        </div>
      </dl>

      {/* 비어 있는 사정은 **비어 있을 때만** 적는다 — 채워진 뒤에도 남기면 값이 의심스러워 보인다. */}
      {created.erpPurchaseOrderNo === null && (
        <p className="field-note">{t.result.erpUnmatchedNote}</p>
      )}

      <p>{t.result.lineCount(created.lineCount)}</p>

      {canSubmit && (
        <>
          {banner}

          {/*
           * **사유 칸은 이 구획에 있다.** 등록 폼에 두면 등록 뒤 폼이 잠길 때 함께 잠기고,
           * 상신하려면 잠긴 칸을 쳐야 하는 모양이 된다.
           */}
          <div className="field-cell">
            <TextField
              fullWidth
              label={t.submit.reason}
              value={reason}
              placeholder={t.submit.reasonPlaceholder}
              helperText={t.submit.reasonHelper}
              disabled={phase === 'submitting'}
              error={reasonError}
              onChange={(event) => {
                onChangeReason(event.target.value);
              }}
            />
          </div>

          <div className="form-actions">
            <div className="field-cell">
              <Button
                disabled={blockReason !== null}
                loading={phase === 'submitting'}
                aria-describedby={blockReason === null ? undefined : blockReasonId}
                onClick={onRequestSubmit}
              >
                {t.actions.requestApproval}
              </Button>
              {blockReason !== null && (
                <span id={blockReasonId} className="field-note">
                  {blockReason}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
