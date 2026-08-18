import { AlertBanner, Button, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { Posting } from './approval-progress';
import type { PostDraft, PostDraftErrors } from './post-request';

const t = messages.stockAdjust;

export interface PostPaneProps {
  /** 업무 번호 — **매임이 든 값**이다. 전기 응답이 준 번호가 아니다(D-15) */
  inventoryAdjustmentNo: string;
  /**
   * 접힌 두 번째 선택지가 **펼쳐져 있는가**(D-12).
   *
   * **화면이 든다** — 이 부품이 스스로 들면 대상이 바뀌어도 펼침이 남아, 앞 전표를 위해 연
   * 자리가 새 전표 위에 그대로 선다(매임의 축이 전표다).
   */
  isExpanded: boolean;
  /** 전기 본문의 두 값. **화면이 매임과 함께 든다** */
  draft: PostDraft;
  /** 화면이 잡은 오류. 칸마다 붙는다 */
  errors: PostDraftErrors;
  /** 서버가 준 필드 오류. **매임을 지난 것만 온다** — 남의 전표의 오류가 이 칸에 서지 않는다 */
  fieldErrors: Record<string, string>;
  /** 나가는 중인가 */
  isPosting: boolean;
  /** 전기가 **실패한 적이 있는가**. 전표는 남고 전기만 실패한 갈래를 정확히 말하는 자리다 */
  hasFailed: boolean;
  /** 전기됐는가 — **판정은 `readPosting` 한 곳이 한다**(C35) */
  posting: Posting;
  /** 왜 막혔는지. `null`이면 보낼 수 있다 — **사유 없이 잠그지 않는다** */
  blockReason: string | null;
  /**
   * 저장 실패 배너 슬롯. **다시 누를 버튼 옆에 선다** — 다른 자리에 두면 무엇이 막았는지
   * 놓친 채 같은 버튼을 다시 누른다. 확인 창이 열려 있는 동안에는 창 안에 서므로 여기는 빈다.
   */
  banner: ReactNode;
  onToggle: () => void;
  onChangeDraft: (patch: Partial<PostDraft>) => void;
  /** 확인을 **요청한다** — 보내는 것은 확인 창을 지난 뒤다. */
  onRequestPost: () => void;
}

/**
 * 전기 구획 — **이 화면에서 재고가 실제로 움직이는 유일한 자리다.**
 *
 * ### 왜 **접힌 두 번째 선택지**인가 (D-12 · 미결 `omf-mes#72`)
 *
 * 앞자리 주 버튼은 「조정 상신」이고 이 길은 펼쳐야 나온다. 결재선이 있는지 화면이 알 통로가
 * 계약에 없어(승인 유형 코드 미확정 · 상세가 내려주지 않음) **화면이 앞서 판정하지 않는다** —
 * 두 길을 함께 두되 기본을 상신으로 두고, 틀린 길은 **서버가 400으로 안전하게 막는다.**
 *
 * **상시 사유는 접혀 있을 때도 선다.** 이 길이 누구의 길인지 밝히지 않으면 결재선이 있는
 * 조정도 여기로 오고, 그때 사용자가 만나는 것은 이유를 알 수 없는 400이다.
 *
 * ### 「일어나는 일」 세 문장이 **잠겨 있을 때도** 서는 이유 (C38)
 *
 * 잠금과 함께 감추면 정작 눌릴 수 있는 상태에서만 경고가 뜨는데, 그때는 이미 누르러 온
 * 순간이라 읽지 않는다. **사라지는 알림(토스트)으로 옮기지 않는 이유도 같다** — 사라지는
 * 글자는 되돌릴 수 없는 조작 앞에서 아무것도 막지 못한다. 확인 창이 **같은 문구를 나눠 쓴다**
 * (`t.post.effect*`)라 두 자리가 갈릴 길이 없다.
 *
 * ### 잠그는 것과 잠그지 않는 것
 *
 * | 사정 | 화면이 아는가 | 이 구획 |
 * | --- | :-: | --- |
 * | 두 값이 갖춰지지 않았다 | **안다**(칸의 값이다) | **잠근다** + 사유 |
 * | 나가는 중이다(전기·상신) | 안다 | **잠근다** + 사유 |
 * | 승인이 끝났는가 | **모른다** — 값 목록 미확정(D-13) | ⛔ **잠그지 않는다**(C33·C37) |
 * | 결재선이 있는가 | **모른다** — 계약에 통로가 없다 | ⛔ 잠그지 않는다 — 서버가 400으로 막는다 |
 *
 * 모르는 것을 잠금으로 접으면 **자리표시가 빈 동안 이 버튼이 영영 잠긴다**(D-13) — 잠금이
 * 위험을 줄이는 것이 아니라 옮긴다. 잠금의 정본은 서버이고 계약이 그것을 명시했다.
 *
 * **이 구획은 결과 구획(등록·상신)과 형제다.** 그 안에 얹지 않는 이유는 그쪽의 사유 칸·버튼·
 * 배너가 **상신 성공과 함께 걷히는 한 덩어리**이기 때문이다 — 전기는 「승인 후」가 정상 경로라
 * (스펙 §5-6) 상신이 성공한 뒤에도 남아 있어야 한다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const PostPane = ({
  inventoryAdjustmentNo,
  isExpanded,
  draft,
  errors,
  fieldErrors,
  isPosting,
  hasFailed,
  posting,
  blockReason,
  banner,
  onToggle,
  onChangeDraft,
  onRequestPost,
}: PostPaneProps) => {
  const paneId = useId();
  const bodyId = `${paneId}-body`;
  const blockReasonId = `${paneId}-block`;

  /**
   * **전기한 뒤에는 두 칸과 버튼을 두지 않는다.** 칠 수 있는데 보낼 수 없는 칸은 사용자가
   * 무엇이 남았는지 헷갈리게 하고, 잠긴 버튼만 남기면 「무엇이 풀리는 조건인가」에 화면이
   * 답하지 못한다 — 그 자리는 전기 결과가 대신한다.
   */
  const canPost = posting.kind === 'notPosted';

  return (
    <section className="pane" aria-label={t.post.label}>
      <p>{t.post.lead}</p>

      {/*
       * **상시 사유** — 접혀 있을 때도 선다(D-12). 이 길이 누구의 길인지 여기서 밝히지 않으면
       * 결재선이 있는 조정도 이 길로 오고, 그때 만나는 것은 이유를 알 수 없는 400이다.
       */}
      <p className="field-note">{t.post.onlyWithoutRoute}</p>

      <div className="form-actions">
        <div className="field-cell">
          <Button
            variant="text"
            aria-expanded={isExpanded}
            aria-controls={bodyId}
            onClick={onToggle}
          >
            {t.actions.togglePost}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div id={bodyId}>
          {/*
           * **상시 문구는 버튼보다 앞에 둔다.** 뒤에 두면 누르고 난 뒤에야 눈에 들어온다.
           * 구획으로 감싸 이름을 붙이는 것은 스크린리더가 세 문장을 한 덩어리로 읽게 하려는 것이다.
           */}
          <section className="banner-slot" aria-label={t.post.effectsLabel}>
            <p className="field-label">{t.post.effectsLabel}</p>
            <p>{t.post.effectMovesStock}</p>
            <p>{t.post.effectApprovalIsNotPosting}</p>
            <p>{t.post.effectNoUndoHere}</p>
          </section>

          {posting.kind === 'posted' && (
            <>
              <AlertBanner variant="success" title={t.post.postedTitle(inventoryAdjustmentNo)}>
                {t.post.postedDescription}
              </AlertBanner>

              <dl className="filter-bar">
                <div className="field-cell">
                  <dt className="field-label">{t.post.adjustedAt}</dt>
                  {/*
                   * 200은 왔는데 시각이 비어 온 갈래가 실재한다(계약이 nullable로 두었다) —
                   * 빈 자리로 두면 「불러오지 못한 것」처럼 보이고, 지어내면 없는 사실을 말한다.
                   */}
                  <dd>
                    {posting.at.kind === 'known' ? posting.at.text : t.post.adjustedAtUnknown}
                  </dd>
                </div>
                <div className="field-cell">
                  <dt className="field-label">{t.post.statusAfterPost}</dt>
                  <dd>
                    {/* 값으로 분기하지 않고 그대로 낸다 — 무슨 뜻인지는 화면이 판정하지 않는다(G-2). */}
                    <Chip variant="status" size="sm">
                      {posting.statusCode}
                    </Chip>
                  </dd>
                </div>
              </dl>

              {/* 표의 장부·실물은 등록 시점의 값이다 — 다시 부르지 않는 사정을 밝힌다. */}
              <p className="field-note">{t.post.bookQtyStale}</p>
            </>
          )}

          {hasFailed && canPost && (
            /* 부분 실패를 성공과 같은 모양으로 그리면 훑고 지나간다 — 전표는 남았고 재고는 그대로다. */
            <AlertBanner variant="warning" title={t.post.failedTitle(inventoryAdjustmentNo)}>
              {t.post.failedDescription}
            </AlertBanner>
          )}

          {/* 나가는 중이라는 사실은 배너를 갈아 끼우지 않고 덧붙인다. */}
          {isPosting && <p className="field-note">{t.post.posting}</p>}

          {canPost && (
            <>
              {banner}

              <div className="form-grid">
                {/*
                 * 두 값은 **사용자가 확인하는 값**이다(공유계약 C-8·C-1). 기본값이 제출 순간이라
                 * 대부분 그대로 지나가고, 자정을 넘겨 일한 사람만 고친다 — 보조 문구가 그 사정을
                 * 밝힌다. 설치본에 `DatePicker`가 없어 네이티브 타입으로 대체한다.
                 */}
                <TextField
                  type="date"
                  label={t.post.businessDate}
                  value={draft.businessDate}
                  helperText={t.post.businessDateHelper}
                  disabled={isPosting}
                  error={errors.businessDate ?? fieldErrors.businessDate}
                  onChange={(event) => {
                    onChangeDraft({ businessDate: event.target.value });
                  }}
                />

                <TextField
                  type="datetime-local"
                  label={t.post.occurredAt}
                  value={draft.occurredAtLocal}
                  helperText={t.post.occurredAtHelper}
                  disabled={isPosting}
                  error={errors.occurredAt ?? fieldErrors.occurredAt}
                  onChange={(event) => {
                    onChangeDraft({ occurredAtLocal: event.target.value });
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
                    loading={isPosting}
                    aria-describedby={blockReason === null ? undefined : blockReasonId}
                    onClick={onRequestPost}
                  >
                    {t.actions.post}
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
        </div>
      )}
    </section>
  );
};
