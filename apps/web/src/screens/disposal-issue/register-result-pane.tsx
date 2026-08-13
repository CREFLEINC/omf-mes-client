import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.disposalIssue;

/**
 * 결과가 보이는 줄 하나. **서버가 되돌려 준 배열에서 나온다**(계획 결정 15) —
 * 화면이 보낸 줄을 되비추면 서버가 무엇을 만들었는지가 아니라 화면이 무엇을 보냈는지를
 * 말하는 것이 된다.
 */
export interface ResultLineSummary {
  ordinal: number;
  item: string;
  lot: string;
  qty: string;
}

/** 만들어진 전표. **내부 번호는 하나도 담기지 않는다**(`omf-mes#44`). */
export interface CreatedIssueSummary {
  goodsIssueNo: string;
  /** 서버가 준 상태 코드 **그대로**. 화면이 「등록 완료」로 바꿔 적지 않는다(공유계약 G-2) */
  statusCode: string;
  lines: readonly ResultLineSummary[];
}

/**
 * 연쇄가 어디까지 갔는가 — **화면이 확인한 것만 담는다**(승인 기록 정정 1-1).
 *
 * | 갈래 | 무슨 일이 있었나 | 화면이 하는 말 |
 * | --- | --- | --- |
 * | `submitting` | 전표는 만들어졌고 상신 요청이 나가는 중 | 「만들었습니다」 + 「올리는 중」 |
 * | `submitted` | 둘 다 끝났다 | 「올렸습니다」 |
 * | **`partial`** | **전표만 만들어졌다** — 상신이 실패했다 | 그 사실을 **정확히** 말하고 이어서 상신할 길을 준다 |
 *
 * **셋째 갈래가 이 구획의 존재 이유다.** 통째로 실패라고 말하면 사용자가 처음부터 다시 만들어
 * **전표가 두 벌** 남고, 통째로 성공이라고 말하면 결재에 올라가지 않은 품의를 올라간 것으로
 * 믿는다. 이 화면은 **첫 응답을 받았다** — 확인한 사실이라 말할 수 있다.
 */
export type SubmitOutcome =
  | { kind: 'submitting'; issue: CreatedIssueSummary }
  | { kind: 'submitted'; issue: CreatedIssueSummary }
  | { kind: 'partial'; issue: CreatedIssueSummary };

export interface RegisterResultPaneProps {
  outcome: SubmitOutcome;
  /**
   * 전송 중인가. **이 버튼도 잠금 안에 있다**(리뷰 Nit C1).
   *
   * 대상을 바꾸는 길이 전부 한 문을 지나므로 보내는 동안에는 이 조작도 그 문에서 막힌다 —
   * 잠그지 않으면 **눌러도 아무 일이 없는 버튼**이 되고, 그 형태는 이 저장소가 되풀이해
   * 결함으로 부르는 것이다. 사유는 버튼 옆에 선다(배치 규범 4).
   */
  isLocked?: boolean;
  /**
   * 만들어진 품의를 이력 탭에서 연다. **탭을 말없이 바꾸지 않는다**(계획 결정 6) —
   * 누르는 것은 사용자이고, 그래야 방금 무엇을 만들었는지 보던 자리가 사라지지 않는다.
   */
  onOpenIssue: () => void;
}

/**
 * 상신 결과 구획 — **화면이 확인한 것만 말한다**(계획 결정 15).
 *
 * | 말한다 | 말하지 않는다 |
 * | --- | --- |
 * | 「폐기 품의 전표 `GI-…`를 만들었습니다」 · 서버가 준 **상태 코드 그대로** · 서버가 되돌려 준 **라인 목록** | 「재고가 차감됐습니다」 — 이 조작은 전기가 아니다 |
 * | 「결재에 올렸습니다」 | **승인 요청 번호** — 응답이 내부 식별자 하나뿐이라 낼 번호가 없다(`omf-mes#44`) |
 * | 「전표는 만들어졌고 상신이 실패했습니다」 + 전표 번호 | 「처리에 실패했습니다」 — 전표가 남았는데 없는 것처럼 말하는 것이 된다 |
 *
 * **부분 실패를 경고로 낸다.** 성공 갈래와 같은 모양으로 그리면 사용자가 훑고 지나가는데,
 * 그 상태는 **사람이 이어서 해야 할 일이 남은** 상태다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const RegisterResultPane = ({
  outcome,
  isLocked = false,
  onOpenIssue,
}: RegisterResultPaneProps) => {
  const { issue } = outcome;
  const lockedReasonId = `${issue.goodsIssueNo}-open-locked`;

  return (
    <section className="pane" aria-label={t.result.label}>
      {outcome.kind === 'partial' ? (
        <AlertBanner variant="warning" title={t.result.partialTitle(issue.goodsIssueNo)}>
          {t.result.partialDescription}
        </AlertBanner>
      ) : (
        <AlertBanner
          variant="success"
          title={
            outcome.kind === 'submitted'
              ? t.result.submittedTitle(issue.goodsIssueNo)
              : t.result.createdTitle(issue.goodsIssueNo)
          }
        >
          {outcome.kind === 'submitted' ? t.result.submittedDescription : t.result.submitting}
        </AlertBanner>
      )}

      {/* 상신까지 끝났을 때만 승인 요청 번호의 자리를 밝힌다 — 낼 번호가 없다는 사실이다. */}
      {outcome.kind === 'submitted' && (
        <p className="field-note">{t.result.submittedNoRequestNo}</p>
      )}

      {/* 상신이 남았다는 사실은 **부분 실패에서만** 적는다 — 진행 중에는 배너가 이미 말한다. */}
      {outcome.kind === 'partial' && <p className="field-note">{t.result.notSubmittedYet}</p>}

      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.issueSummary.goodsIssueNo}</dt>
          <dd>{issue.goodsIssueNo}</dd>
        </div>
        <div className="field-cell">
          {/*
           * 상태 코드를 **그대로** 낸다 — 값 목록이 확정되지 않아 뜻을 옮길 근거가 없다.
           *
           * **어느 시점의 값인지를 라벨이 밝힌다**(리뷰 t5 M2). 이 값은 **전표를 만들 때**
           * 서버가 준 것이고, 그 뒤 상신·전기로 달라진다 — 밝히지 않으면 같은 전표를 두 탭이
           * 서로 다른 상태로 말하는 것처럼 읽힌다. 지금 상태를 여기서 다시 읽어 오지 않는
           * 이유는 그러면 이 구획이 상세 조회에 매여 **치던 값이 사라지는 축**(`omf-mes#43`)이
           * 하나 늘기 때문이다.
           */}
          <dt className="field-label">{t.result.createdStatusCode}</dt>
          <dd>{issue.statusCode}</dd>
        </div>
      </dl>

      <p>{t.result.lineCount(issue.lines.length)}</p>
      <ul>
        {issue.lines.map((line) => (
          <li key={line.ordinal}>{t.result.linePair(line.item, line.lot, line.qty)}</li>
        ))}
      </ul>

      <div className="form-actions">
        <div className="field-cell">
          <Button
            variant="outlined"
            disabled={isLocked}
            aria-describedby={isLocked ? lockedReasonId : undefined}
            onClick={onOpenIssue}
          >
            {t.actions.openIssue}
          </Button>
          {isLocked && (
            <span id={lockedReasonId} className="field-note">
              {t.actionReasons.openIssueLocked}
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
