import { AlertBanner, Button, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CreatedAdjustmentView } from './types';

const t = messages.stockAdjust;

/**
 * ERP 송신 **적재** 여부의 세 갈래.
 *
 * **셋인 이유는 계약이 이 필드를 선택으로 두었기 때문이다** — 값이 오지 않는 갈래가 실재하므로
 * `?? false`로 접으면 아무 근거 없이 「적재되지 않았다」로 읽힌다(C23).
 *
 * **「적재」는 「전송」이 아니다**(계약 문면) — 그래서 어느 갈래의 문구에도 「전송 완료」라는
 * 낱말이 없다.
 */
type ErpQueueState = { kind: 'queued' } | { kind: 'notQueued' } | { kind: 'unknown' };

const readErpQueue = (queued: boolean | null): ErpQueueState => {
  if (queued === null) return { kind: 'unknown' };

  return queued ? { kind: 'queued' } : { kind: 'notQueued' };
};

const erpQueueText = (state: ErpQueueState): string => {
  switch (state.kind) {
    case 'queued':
      return t.result.erpQueued;
    case 'notQueued':
      return t.result.erpNotQueued;
    case 'unknown':
      return t.result.erpUnknown;
  }
};

/**
 * 상신이 어디까지 갔는가 — **화면이 확인한 것만 담는다**(D-15).
 *
 * | 갈래 | 무슨 일이 있었나 | 화면이 하는 말 |
 * | --- | --- | --- |
 * | `idle` | 전표만 만들어졌다 | 「만들었습니다」 + 사유 칸과 「조정 상신」 |
 * | `submitting` | 상신 요청이 나가는 중 | 위 + 「올리는 중」 |
 * | `submitted` | **202를 받았다** | 「올렸습니다」 + 결재 진행 |
 * | **`failed`** | **전표는 남고 상신만 실패했다** | 그 사실을 **정확히** 말하고 다시 올릴 길을 준다 |
 *
 * **넷째 갈래가 이 구획이 갈래를 갖는 이유다.** 통째로 실패라고 말하면 사용자가 처음부터 다시
 * 만들어 **전표가 두 벌** 남고, 통째로 성공이라고 말하면 결재에 올라가지 않은 조정을 올라간
 * 것으로 믿는다. 화면은 **등록 응답을 받았다** — 확인한 사실이라 말할 수 있다.
 *
 * ⛔ **목이 채워 준 값이 이 갈래를 정하지 않는다**(§5.2.5). 등록 응답에 승인 요청 번호가 실려
 * 와도 `submitted`가 되지 않는다 — 그 근거는 오직 **이 화면이 받은 202**다.
 */
export type SubmitPhase = 'idle' | 'submitting' | 'submitted' | 'failed';

export interface ResultPaneProps {
  created: CreatedAdjustmentView;
  phase: SubmitPhase;
  /** 친 사유 글자 그대로. **판정과 조립은 `reason-draft.ts` 한 곳이 한다** */
  reason: string;
  /** 사유 칸에 붙는 서버 오류. 화면이 잡은 것과 서버가 준 것이 **같은 칸에** 붙는다 */
  reasonError?: string;
  /** 상신이 막힌 사유. `null`이면 올릴 수 있다 — **사유 없이 잠그지 않는다** */
  blockReason: string | null;
  /**
   * 상신 실패 배너 슬롯. **다시 누를 버튼 옆에 선다** — 다른 자리에 두면 무엇이 막았는지
   * 놓친 채 같은 버튼을 다시 누른다. 확인 창이 열려 있는 동안에는 창 안에 서므로 여기는 빈다.
   */
  banner: ReactNode;
  /**
   * 결재 진행 구획 슬롯. **화면이 넘긴다** — 이 구획이 스스로 부르면 「언제 부르는가」의 판정이
   * 두 자리로 갈리고, 그 갈림이 곧 상신하지 않은 전표의 진행을 부르는 길이 된다(C36).
   */
  progress: ReactNode;
  onChangeReason: (value: string) => void;
  /** 확인을 **요청한다** — 보내는 것은 확인 창을 지난 뒤다. */
  onRequestSubmit: () => void;
}

/**
 * 등록 결과와 **상신 자리** — 화면이 확인한 것만 말한다.
 *
 * | 말한다 | 말하지 않는다 |
 * | --- | --- |
 * | 「조정 전표 `SAMPLE-IA-…`를 만들었습니다」 — **서버가 201로 받아들였다**는 사실 | 「등록 완료」·「승인 대기」 — 상태의 뜻을 화면이 옮겨 적지 않는다(공유계약 G-2) |
 * | 서버가 준 **상태 코드 그대로**와 **그것이 등록 시점의 값**이라는 사실 | 지금의 진행 상태 — 그 정본은 결재함이다 |
 * | **서버가 저장한** 줄 수 | 화면이 보낸 줄 수 — 둘이 갈리면 서버가 맞다 |
 * | ERP **대기열 적재** 세 갈래 | 「ERP로 전송됐습니다」 — 적재는 전송이 아니다 |
 * | 「결재에 올렸습니다」 — **202를 받았다**는 사실 | 승인·반려 조작 — 결재함(W-CO-09)이 소유한다(⛔ D-3) |
 * | 「전표는 만들어졌고 결재에는 올라가지 않았습니다」 | 「처리에 실패했습니다」 — 전표가 남았는데 없는 것처럼 말하는 것이 된다 |
 * | 재고가 **아직 움직이지 않았다**는 사실 | 전기 조작 — 뒤따르는 회차가 제 확인 창과 함께 세운다 |
 *
 * **등록과 상신은 별개 동작이다.** 이 구획은 등록이 끝난 뒤에만 서므로 「조정 상신」이 등록
 * 성공 뒤에야 존재한다 — 한 번의 조작이 두 요청을 잇지 않는다.
 *
 * ⚠ **목이 채워 주는 값에 기대지 않는다.** 목 서버는 등록 응답에 승인 요청 번호와 전기 시각을
 * 계약 예시값으로 채워 준다 — 그것을 읽어 「상신됨」·「전기됨」을 그리면 **화면이 확인하지 않은
 * 사실**을 말하게 된다. 그래서 표시 타입(`CreatedAdjustmentView`)에 그 자리가 아예 없고,
 * 갈래를 정하는 것은 **이 화면이 받은 응답**(`phase`)뿐이다.
 *
 * **사라지는 알림으로 내지 않는다.** 전표번호는 적어 두거나 옮겨 적는 값이라 몇 초 뒤에
 * 없어지면 안 된다 — 배너가 살아 있는 영역으로 알리되 글자는 화면에 남는다. **전표번호는 네
 * 갈래 어디에서도 남는다.**
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
  progress,
  onChangeReason,
  onRequestSubmit,
}: ResultPaneProps) => {
  const blockReasonId = useId();

  /**
   * **올린 뒤에는 사유 칸과 버튼을 두지 않는다.** 칠 수 있는데 보낼 수 없는 칸은 사용자가 쓴
   * 글을 버리게 만들고, 잠긴 버튼만 남기면 「무엇이 풀리는 조건인가」에 화면이 답하지 못한다 —
   * 그 자리는 결재 진행 구획이 대신한다.
   */
  const canSubmit = phase !== 'submitted';

  return (
    <section className="pane" aria-label={t.result.label}>
      {phase === 'failed' ? (
        /* 부분 실패를 성공과 같은 모양으로 그리면 훑고 지나간다 — 사람이 이어서 할 일이 남았다. */
        <AlertBanner
          variant="warning"
          title={t.result.submitFailedTitle(created.inventoryAdjustmentNo)}
        >
          {t.result.submitFailedDescription}
        </AlertBanner>
      ) : (
        <AlertBanner
          variant="success"
          title={
            phase === 'submitted'
              ? t.result.submittedTitle(created.inventoryAdjustmentNo)
              : t.result.createdTitle(created.inventoryAdjustmentNo)
          }
        >
          {phase === 'submitted' ? t.result.submittedDescription : t.result.createdDescription}
        </AlertBanner>
      )}

      {/* 나가는 중이라는 사실은 배너를 갈아 끼우지 않고 덧붙인다 — 전표를 만든 사실이 그대로 남는다. */}
      {phase === 'submitting' && <p className="field-note">{t.result.submitting}</p>}

      {/*
       * **이름 하나에 값 하나로 짝을 맞춘다.** `<dt>` 하나 뒤의 `<dd>`는 전부 그 이름의 값이라,
       * 상태를 전표번호 아래에 그대로 두면 보조기술이 「전표번호: SAMPLE-IA-…, SAMPLE_…」로
       * 읽는다 — 이름 없는 값이 아니라 **틀린 이름이 붙은 값**이 된다.
       */}
      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.result.inventoryAdjustmentNo}</dt>
          <dd>{created.inventoryAdjustmentNo}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.result.statusCode}</dt>
          <dd>
            {/* 값으로 분기하지 않고 그대로 낸다 — 무슨 뜻인지는 화면이 판정하지 않는다(G-2). */}
            <Chip variant="status" size="sm">
              {created.statusCode}
            </Chip>
          </dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.result.erp}</dt>
          <dd>{erpQueueText(readErpQueue(created.erpMessageQueued))}</dd>
        </div>
      </dl>

      <p className="field-note">{t.result.statusNote}</p>

      <p>{t.result.lineCount(created.lineCount)}</p>

      {/* 적재는 전송이 아니다 — 상대 시스템에서 아직 보이지 않는 것이 정상이다. */}
      <p className="field-note">{t.result.erpNote}</p>

      {canSubmit && (
        <>
          {banner}

          {/*
           * **사유 칸은 이 구획에 있다.** 등록 폼에 두면 등록 뒤 폼이 잠길 때 함께 잠기고,
           * 상신하려면 잠긴 칸을 쳐야 하는 모양이 된다.
           *
           * **헤더 사유(코드)와 다른 칸이다**(D-8) — 그쪽은 고르는 값이고 이쪽은 쓰는 글이다.
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
            {/*
             * 잠긴 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다 —
             * 잠긴 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
             * **열려 있으면 사유를 그리지 않는다** — 늘 서 있으면 읽히지 않는다.
             */}
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

      {/*
       * 결재 진행 — **화면이 넘긴 슬롯**이다. 언제 부르는가의 판정이 한 자리에 있어야
       * 상신하지 않은 전표의 진행을 부르는 길이 생기지 않는다(C36).
       */}
      {progress}
    </section>
  );
};
