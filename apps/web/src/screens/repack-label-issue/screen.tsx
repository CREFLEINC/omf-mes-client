import { AlertBanner, Button, Card, Chip, Tooltip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { useIsOnline } from './connection';
import { useRepackLabelEntry } from './entry-context';
import { ErrorBanner } from './error-banner';
import { HandlingUnitPane } from './handling-unit-pane';
import { HistoryPane } from './history-pane';
import { IssuePane } from './issue-pane';
import { issueBody } from './issue-body';
import { useDocumentIssue } from './mutations';
import { PreviewDialog } from './preview-dialog';
import {
  useContentRows,
  useHandlingUnit,
  useIssueHistory,
  useIssueStanding,
  usePrinters,
  useReissueReasons,
} from './queries';
import { useTerminalGate } from './terminal-gating';
import { useIssuePrintRunner } from './use-issue-print';
import { needsReason, type DocumentIssue, type IssueStanding, type Printer } from './types';

const t = messages.repackLabelIssue;

/** 요약을 못 받았을 때의 자리. **「모른다」를 「0 번 발행」으로 말하지 않는다.** */
const UNKNOWN_STANDING: IssueStanding = {
  issueCount: null,
  lastIssuedAt: null,
  lastPrintOutcome: null,
};

/** 기본 프린터가 있으면 그것, 없으면 첫 번째. 없으면 `null`. */
const defaultPrinter = (printers: readonly Printer[]): Printer | null =>
  printers.find((printer) => printer.isDefault) ?? printers[0] ?? null;

/**
 * P-04-04 재구성 신규 라벨 발행.
 *
 * ## ⚠ 지금 서 있는 것은 발행·인쇄뿐이다
 *
 * 스펙의 ① 발행 대기 목록과 ② 신규 발번은 **계약이 표현하지 못해 만들지 않았다**
 * (`omf-mes#418` · 자세한 근거는 `types.ts` 머리). 대상 포장은 주소로 받고(`entry-context.ts`),
 * 앞단이 정해지면 그 파일 하나가 바뀐다.
 *
 * ⛔ **인쇄를 발행에 묶지 않는다**(K-4). 인쇄가 실패해도 발행 기록은 남아야 재인쇄로 복구된다.
 *
 * ⭐ **순서가 「발행 → 미리보기 → 인쇄」다**(착수 이슈 §6). 그리기 경로가 발행 기록 번호를 받아
 * **발행 전 미리보기가 계약에 없다.**
 */
export const RepackLabelIssueScreen = () => {
  const titleId = useId();
  const entry = useRepackLabelEntry();
  const identity = usePopIdentity();
  const gate = useTerminalGate(identity.terminalId, identity.processId);
  const isOnline = useIsOnline();

  const [reasonCode, setReasonCode] = useState('');
  const [pickedPrinter, setPickedPrinter] = useState('');

  const handlingUnit = useHandlingUnit(entry.handlingUnitId);
  const contents = useContentRows(handlingUnit.data?.contents ?? []);
  const standingQuery = useIssueStanding(entry.handlingUnitId);
  const history = useIssueHistory(entry.handlingUnitId);
  const printers = usePrinters();
  const reasons = useReissueReasons();
  const printRunner = useIssuePrintRunner(entry.workerNo);

  const standing = standingQuery.data ?? UNKNOWN_STANDING;

  const printerList = printers.data ?? [];
  /*
   * 기본 프린터를 **파생으로 정한다** — 응답이 온 뒤 `useEffect` 로 상태에 밀어 넣으면 그
   * 한 프레임 동안 고른 것이 없는 화면이 서고, 사용자가 그사이 고른 값을 덮는다.
   */
  const printerName =
    pickedPrinter !== '' ? pickedPrinter : (defaultPrinter(printerList)?.printerName ?? '');

  const issue = useDocumentIssue({
    workerNo: entry.workerNo ?? '',
    onSuccess: (result) => {
      const issued = result.items[0];

      if (issued === undefined) return;

      void printRunner.begin({
        documentIssueLogId: issued.documentIssueLogId,
        label: handlingUnit.data?.handlingUnit.handlingUnitNo ?? issued.target.displayName,
      });
    },
  });

  /*
   * 사유를 요구할 근거는 둘이다 — **발행 현황**과 **서버가 되돌린 422**.
   *
   * ⛔ **뒤엣것을 빼면 막다른 자리가 생긴다.** 현황 조회가 실패하면 화면은 재발행인지 모르고,
   * 그 상태로 보내면 서버가 사유를 요구한다 — 그때 사유 칸이 잠겨 있으면 **사용자가 고칠
   * 방법이 없다.** 서버가 지목한 것이 곧 「필요하다」의 근거다.
   */
  const reasonRequired = needsReason(standing) || issue.fieldErrors.reissueReasonCode !== undefined;

  const blockedReason = ((): string | null => {
    if (entry.handlingUnitId === null) return t.entry.missingHandlingUnit;
    if (entry.workerNo === null) return t.entry.missingWorker;
    if (gate.verdict !== 'allowed') return t.gate[gate.verdict];
    /*
     * ⛔ **끊긴 채로는 발행하지 않는다**(스펙 §6 · K-5). 라벨을 서버가 그리므로 기록만 남고
     * 인쇄할 것이 오지 않는다 — 회차만 오르고 종이는 없는 상태가 된다.
     */
    if (!isOnline) return t.gate.offline;

    return null;
  })();

  const submit = (): void => {
    const handlingUnitId = entry.handlingUnitId;

    if (handlingUnitId === null || entry.workerNo === null) return;
    /* 사유가 필요한데 비었으면 보내지 않는다 — 서버도 422 로 막지만 먼저 막는 자리가 화면이다. */
    if (reasonRequired && reasonCode === '') return;

    printRunner.reset();
    issue.write(issueBody({ handlingUnitId, printerName, reasonCode, reasonRequired }));
  };

  /**
   * 이미 발행한 적이 있어야 볼 것이 있다 — **가장 높은 회차**를 연다.
   *
   * ⛔ **목록의 첫 줄을 쓰지 않는다.** 계약은 「회차가 쌓인 그대로 돌려준다」이고 정렬을
   * 보장하지 않는다 — 오름차순으로 오면 첫 줄이 1회차라 **가장 오래된 라벨**이 열린다.
   */
  const latestIssue = (history.data ?? []).reduce<DocumentIssue | null>(
    (latest, issue) => (latest === null || issue.issueSeq > latest.issueSeq ? issue : latest),
    null,
  );

  const openPreview = (): void => {
    /*
     * ⭐ **방금 발행한 것을 먼저 쓴다.** 이력 조회가 실패하면 `latestIssue` 가 비는데, 그때도
     * 렌디션을 다시 받을 번호는 절차가 들고 있다 — 안 쓰면 회차만 오른 채 빠져나갈 길이 없다.
     */
    const target =
      printRunner.state.target ??
      (latestIssue === null
        ? null
        : {
            documentIssueLogId: latestIssue.documentIssueLogId,
            label: handlingUnit.data?.handlingUnit.handlingUnitNo ?? latestIssue.target.displayName,
          });

    if (target === null) return;

    void printRunner.begin(target);
  };

  const phase = printRunner.state.phase;
  const isSubmitting = issue.isSaving || phase === 'fetching' || phase === 'printing';
  const canPreview = isOnline && (latestIssue !== null || printRunner.state.target !== null);
  /* 사유가 필요한데 아직 고르지 않았으면 화면이 먼저 막는다(스펙 §6) — 서버도 422 로 막는다. */
  const isBlocked = blockedReason !== null || isSubmitting || (reasonRequired && reasonCode === '');

  return (
    <main className="pop-shell pop-ui" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {/*
         * 머리줄은 **설계 §3 도면 그대로 둘만 둔다** — 「재구성 신규 라벨 발행 … 박창고 ●온」.
         *
         * ⛔ 프린터를 여기에 다시 그리지 않는다 — 프린터는 아래 구획에서 «고르는» 자리이고,
         *    머리줄의 칩은 그것을 되풀이할 뿐이라 같은 것이 화면에 둘이 된다.
         * ⛔ 단말 번호도 두지 않는다 — 도면에 없고, 단말이 확인되지 않으면 그 사실이 발행을
         *    막는 사유로 이미 본문에 선다(§6).
         */}
        <div className="pop-context-right">
          <PopWorkerTag workerNo={entry.workerNo} />
          {/* 스펙 §3 헤더의 연결 표시. 발행을 막는 조건이기도 해서 상시 보인다. */}
          <Chip status={isOnline ? 'success' : 'error'}>
            {isOnline ? t.device.online : t.device.offline}
          </Chip>
        </div>
      </header>

      {handlingUnit.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.handlingUnit.loadFailed}>
            {messages.httpError.description}
          </AlertBanner>
        </div>
      )}

      {issue.error !== null && (
        <ErrorBanner error={issue.error} title={t.error.issueTitle} onRetry={submit} />
      )}

      {/*
        ⛔ **그림을 못 받은 것을 발행 실패로 말하지 않는다.** 기록은 남았다 — 다시 «발행»하면
        회차가 또 오르므로, 복구 경로는 미리보기를 다시 여는 것이다.
      */}
      {phase === 'renditionFailed' && (
        <div className="banner-slot">
          <AlertBanner
            variant="error"
            title={t.preview.failed}
            action={
              <Button variant="outlined" size="sm" onClick={openPreview}>
                {messages.common.retry}
              </Button>
            }
          >
            {t.print.failedBody}
          </AlertBanner>
        </div>
      )}

      {phase === 'shellUnavailable' && (
        <div className="banner-slot">
          <AlertBanner variant="info" title={t.print.issued}>
            {t.print.shellUnavailable}
          </AlertBanner>
        </div>
      )}

      {phase === 'failed' && (
        <div className="banner-slot">
          <AlertBanner
            variant="error"
            title={t.print.failedTitle}
            action={
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  void printRunner.print();
                }}
              >
                {t.print.retry}
              </Button>
            }
          >
            {t.print.failedBody}
          </AlertBanner>
        </div>
      )}

      {/*
        ⛔ **인쇄 실패와 갈라 세운다**(K-4 위에 한 겹 더). 종이는 이미 나왔으므로 「다시 인쇄」를
        권하면 같은 라벨이 한 장 더 나온다 — 여기서 남은 일은 보고를 다시 보내는 것뿐이다.
      */}
      {phase === 'reportFailed' && (
        <div className="banner-slot">
          <AlertBanner
            variant="warning"
            title={t.print.reportFailedTitle}
            action={
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  void printRunner.retryReport();
                }}
              >
                {t.print.reportRetry}
              </Button>
            }
          >
            {t.print.reportFailedBody}
          </AlertBanner>
        </div>
      )}

      {phase === 'succeeded' && (
        <div className="banner-slot">
          <AlertBanner variant="success" title={t.print.issued}>
            {t.print.succeeded}
          </AlertBanner>
        </div>
      )}

      {/*
       * ⭐ **구획을 세로로 쌓는다** — 설계 §3 도면이 ①②③④ 를 위에서 아래로 그렸다. 좌우
       *    2단(`pop-panes`)으로 세우면 도면과 읽는 차례가 달라지고, 오른쪽 단이 발행·이력을
       *    함께 안아 한 상자가 다른 상자의 두 배가 된다(실측).
       */}
      <div className="pop-repack-panes">
        <Card bordered className="pop-section" aria-label={t.handlingUnit.sectionLabel}>
          <h2 className="pane-title">{t.handlingUnit.sectionLabel}</h2>
          {/*
           * ⛔ **빈 상자를 두지 않는다.** 아직 못 받았을 때 아무 것도 그리지 않아, 표제만 남은
           *    상자가 화면 위에 떠 있었다(실측 · 사용자 지적) — 사용자는 그것이 「내용이 없다」인지
           *    「고장」인지 알 수 없다. 셋을 갈라 말한다(G-9).
           */}
          {entry.handlingUnitId === null ? (
            <p className="pop-empty-note">{t.entry.missingHandlingUnit}</p>
          ) : handlingUnit.data === undefined ? (
            <p className="pop-empty-note">
              {handlingUnit.isError ? t.handlingUnit.loadFailed : t.handlingUnit.loading}
            </p>
          ) : (
            <HandlingUnitPane
              handlingUnit={handlingUnit.data.handlingUnit}
              rows={contents.rows}
              namesFailed={contents.isNameError}
            />
          )}
        </Card>

        {/*
         * ⛔ **발행 구획을 «줄지 않는 것»으로 두지 않는다.** 그렇게 두었더니 사유·프린터·이력이
         *    쌓인 만큼 자리를 다 가져가고, 위의 대상 포장이 표제만 남기고 눌렸다(실측 · 사용자
         *    지적). 두 구획 다 줄어들 수 있게 두고, 대상 포장에 «바닥»을 준다(§3-1 ① 200).
         */}
        <Card bordered className="pop-section" aria-label={t.issue.sectionLabel}>
          {/* 회차는 표제 옆이다(사용자 지시) — 「무엇을 하는 자리인가」와 함께 읽힌다. */}
          <div className="pane-title pop-repack-head">
            <h2 className="pop-repack-head-name">{t.issue.sectionLabel}</h2>
            {standingQuery.isError ? null : (
              <span className="pop-repack-standing">
                {standing.issueCount === null || standing.issueCount === 0
                  ? t.issue.firstIssue
                  : t.issue.reissue(standing.issueCount)}
              </span>
            )}
          </div>
          <IssuePane
            standing={standing}
            standingFailed={standingQuery.isError}
            reasons={reasons.data ?? []}
            reasonsFailed={reasons.isError}
            reasonCode={reasonCode}
            onReasonChange={setReasonCode}
            reasonRequired={reasonRequired}
            reasonServerError={issue.fieldErrors.reissueReasonCode ?? null}
            printers={printerList}
            printersFailed={printers.isError}
            printerName={printerName}
            onPrinterChange={setPickedPrinter}
          />

          <h2 className="pane-title">{t.history.sectionLabel}</h2>
          <HistoryPane issues={history.data ?? []} isFailed={history.isError} />
        </Card>
      </div>

      {/*
       * 액션바 — **화면 바닥의 띠**(설계 §3 · 88). 구획 안이 아니라 여기다: 구획이 길어져도
       * 단추는 늘 같은 자리에 있고, 다른 POP 화면과도 자리가 같다.
       *
       * ⛔ **막힌 사유를 툴팁에만 두지 않는다.** 감싼 버튼이 `disabled` 라 포커스를 못 받고,
       *    터치 패널에는 hover 가 없어 **문구가 사용자에게 도달하지 않는다**(독립 검증 실측).
       *    띠 왼쪽 끝에 두어 단추와 같은 줄에서 읽힌다(전례 `P-04-02`).
       */}
      <div className="pop-action-bar pop-repack-actions">
        {blockedReason !== null && (
          <p className="pop-repack-blocked" role="status">
            {blockedReason}
            {gate.verdict === 'unavailable' && (
              <Button variant="outlined" size="sm" onClick={gate.retry}>
                {t.issue.gateRetry}
              </Button>
            )}
          </p>
        )}

        {/*
          ⚠ **발행 전에는 볼 것이 없다.** 그리기 경로가 발행 기록 번호를 받는다(착수 이슈 §6) —
          비활성으로 두되 **사유를 말한다.**
        */}
        {canPreview ? (
          <Button variant="outlined" size="2xl" onClick={openPreview}>
            {t.issue.preview}
          </Button>
        ) : (
          <Tooltip content={t.issue.previewBeforeIssue}>
            <Button variant="outlined" size="2xl" disabled>
              {t.issue.preview}
            </Button>
          </Tooltip>
        )}

        {/*
          ⭐ **`size="2xl"` 이 72px 이다** — 스펙 §7 이 지목한 치수이고 고정 커밋의 설치본에
          실제로 있다.
        */}
        <Button
          variant="filled"
          size="2xl"
          onClick={submit}
          loading={isSubmitting}
          disabled={isBlocked}
        >
          {t.issue.submit}
        </Button>
      </div>

      <PreviewDialog
        open={phase === 'preview' || phase === 'printing'}
        imageUrl={printRunner.state.imageUrl}
        isPrinting={phase === 'printing'}
        onPrint={() => {
          void printRunner.print();
        }}
        onClose={printRunner.dismiss}
      />
    </main>
  );
};
