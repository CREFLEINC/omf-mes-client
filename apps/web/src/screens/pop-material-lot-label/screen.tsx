import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { toLookupDisplayState } from '../../patterns/lookup-display';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { popTouchClass } from '../../patterns/pop-touch';
import { toIssueFailure } from './failure';
import { IssueOutcome } from './issue-outcome';
import { useItemNameSources, useSupplierLookup, useUomLookup } from './lookups';
import { useLabelIssue } from './mutations';
import { PageNav } from './page-nav';
import { toLinePageView } from './pagination';
import { PrinterStatusIndicator } from './printer-status';
import {
  useLotNo,
  usePrinters,
  useReceipts,
  useReissueReasons,
  useTargetRows,
  type IssuedView,
} from './queries';
import { ReceiptList } from './receipt-list';
import { ReissueDialog } from './reissue-dialog';
import { TargetCard } from './target-card';
import { toHeadPrinter } from './types';

const t = messages.popMaterialLotLabel;
const tDevice = messages.popMaterialLotLabel.device;

/**
 * 빈 목록의 안내를 고른다 — **왜 비었는지가 셋으로 갈린다.**
 *
 * 사전부착 자재를 걸러 내므로 **입하 건은 있는데 보일 자재가 없는** 상태가 정상적으로 생긴다.
 * 그때 「발행할 자재가 없습니다」만 내면 「전체 N건」과 나란히 서서 서로 어긋나 보인다.
 */
const emptyMessage = (
  isBeyondLast: boolean,
  receiptCount: number,
  view: IssuedView,
  hasNextPage: boolean,
): string => {
  if (isBeyondLast) return t.receipts.beyondLast;

  if (view === 'issued') {
    return receiptCount > 0 ? t.receipts.issuedEmptyOnThisPage : t.receipts.issuedEmpty;
  }

  if (receiptCount === 0) return t.receipts.empty;

  /*
   * ⚠ 미발행 보기는 입하 건을 발행 여부로 거르지 않아(#1241) 다 발행한 건도 쪽을 차지한다. 뒤쪽에
   *   미발행 자재가 남아 있을 수 있으니 「발행 완료를 보라」는 마지막 쪽에서만 말한다.
   */
  return hasNextPage ? t.receipts.emptyOnThisPageMore : t.receipts.emptyOnThisPage;
};

const ISSUED_VIEWS: readonly IssuedView[] = ['unissued', 'issued'];

/**
 * `P-01-01` 자재LOT 등록·라벨 발행 (POP).
 *
 * 스펙 §3 배치를 따른다 — **좌: 입하 목록(미부착) / 우: 발번 대상.** 세로로 쌓지 않는다.
 * 1024×768에서 세로 여유가 119px뿐이라 구획을 쌓으면 아래가 잘린다.
 *
 * 목록은 스펙대로 **한 단계**다 — 입하번호·품목·수량·공급사·입하일이 한 줄에 함께 온다.
 * 계약이 그것을 두 경로로 나눠 주므로 화면이 합친다(`useTargetRows`).
 */
export const PopMaterialLotLabelScreen = () => {
  const [page, setPage] = useState(1);
  /**
   * 줄 쪽 — **화면이 줄을 다시 쪽으로 자른 것**이다(`pagination`). 서버 쪽은 「건」 단위라 건이
   * 한 쪽에 다 들어가면 늘 1쪽이고, 그러면 줄이 아무리 많아도 이전·다음이 꺼져 있었다(#32).
   *
   * ⚠ **큰 수는 「마지막 줄 쪽」을 뜻한다.** 앞 건 쪽으로 돌아갈 때 그 쪽의 줄 수를 아직 모르므로
   *   범위를 넘겨 두고 `toLinePageView` 가 잡아 준다.
   */
  const [linePage, setLinePage] = useState(1);
  const [issuedView, setIssuedView] = useState<IssuedView>('unissued');
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [isReissueOpen, setReissueOpen] = useState(false);

  /*
   * 귀속 사번은 **셸이 아는 값**이다(진입점 화면 소관 · 이 저장소 #157). 쓰기가 헤더로
   * 요구하므로 없으면 부를 수 없고, 그 사실을 감추지 않고 사유로 보인다(공유계약 F-1·F-6).
   */
  const { workerNo, terminalId } = usePopIdentity();

  const issue = useLabelIssue({ workerNo });
  /*
   * ⛔ **실행 중에는 목록을 주기 갱신하지 않는다.** 도는 사이에 고른 줄이 목록에서 빠지면 발번
   *    대상 카드가 빈 상태로 돌아가 「인쇄 중인데 아무것도 고르지 않은 화면」이 된다(#1241).
   */
  const isIssuing = issue.step !== null;

  // 첫 쪽이면 조건을 싣지 않는다 — 서버 기본값이 1이라 URL에 없는 편이 조건을 정직하게 드러낸다.
  const receipts = useReceipts(issuedView, page === 1 ? {} : { page }, isIssuing);
  const targets = useTargetRows(receipts.data?.items ?? [], issuedView, isIssuing);
  const printers = usePrinters();

  /*
   * ⭐ **품목 이름은 「보이는 줄」의 것만 푼다**(omf-all-around#27). 마스터 목록 조회는 한 쪽만
   *    돌려줘, 품목이 9천여 건인 현장에서 첫 쪽 밖 품목이 통째로 「알 수 없음」으로 섰다.
   *    공급사는 단건 조회가 단말 토큰에 열려 있지 않아 목록을 끝까지 받는다 — `lookups` 머리말.
   */
  const itemNames = useItemNameSources(targets.rows.map((row) => row.itemId));
  const supplierLookup = useSupplierLookup();
  const uomLookup = useUomLookup(true);

  const result = receipts.data;
  /*
   * ⚠ **세는 단위가 둘이다.** 서버 쪽 나눔은 입하 «건» 단위이고 목록 줄은 «자재»다. 그래서 줄
   * 쪽은 화면이 따로 셈하고(`toLinePageView`), 줄 쪽을 다 넘기면 다음 건 쪽으로 이어 넘어간다.
   */
  const pageView =
    result === undefined ? null : toLinePageView(result.page, targets.rows.length, linePage);
  /**
   * 이 쪽에 세울 줄 — **잘릴 줄은 다음 쪽으로 넘긴다**(사용자 지시 2026-09-19). 목록에 스크롤을
   * 두지 않으므로, 잘라 보이면 그 줄에는 닿을 방법이 없다.
   */
  const visibleRows = pageView === null ? [] : targets.rows.slice(pageView.start, pageView.end);
  const selectedRow =
    visibleRows.find((row) => row.inboundReceiptLineId === selectedLineId) ?? null;

  const lot = useLotNo(selectedRow?.lotId ?? null);
  const reissueReasons = useReissueReasons(isReissueOpen);
  const headPrinter = toHeadPrinter(printers.data ?? []);

  /*
   * ⛔ **결과는 그 결과를 만든 줄의 것이다.** 다른 자재를 고르면 앞 자재의 실패가 따라오지
   * 않는다 — 그 판정을 여기 한 곳에서 하고, 알림과 단추가 같은 값을 본다.
   *
   * ⛔ **고른 줄이 목록에서 빠져도 결과는 남긴다**(#1241). 발행 기록이 생긴 줄은 미발행 목록에서
   *    곧바로 빠지므로, 줄 대신 **고른 id** 로 가른다 — 줄로 가르면 「라벨이 나오지 않았습니다」가
   *    소리 없이 사라진다.
   */
  const isResultOfSelected = issue.result.lineId !== null && issue.result.lineId === selectedLineId;
  /*
   * 출력 권한이 없는 단말(403)에서는 **재시도 수단을 주지 않는다**(스펙 §5-2). 단말 전체를
   * 미리 막지는 않는다 — 게이트는 서버가 갖고, 화면은 받은 답에만 반응한다(§5-5).
   */
  const isPrintForbidden = isResultOfSelected && toIssueFailure(issue.result) === 'issueForbidden';

  /**
   * 등록·인쇄 한 번을 시작한다.
   *
   * ⛔ **사번이 없으면 부르지 않는다** — 서버가 거부한다. 단추도 함께 막혀 있지만, 판정을
   * 부르는 자리에도 두어 다른 경로로 새는 것을 막는다.
   */
  /** 라벨에 적을 단위 코드. 이름을 못 풀었으면 적지 않는다 — 「불러오는 중」이 라벨에 찍히면 안 된다. */
  const uomCodeOf = (uomId: number): string | null => {
    const state = toLookupDisplayState(uomLookup, uomId);

    return state.kind === 'named' ? state.label : null;
  };

  const startIssue = (reissueReasonCode: string | null): void => {
    if (selectedRow === null || workerNo === null) return;
    /*
     * ⛔ **막힌 단말에서는 나가지 않는다.** 단추도 함께 막혀 있지만, 판정을 나가는 자리에도 두어
     * 다른 경로(대화상자·스캐너)가 생겨도 새지 않게 한다 — `mutations` 의 사번 판정과 같은 규율.
     */
    if (isPrintForbidden) return;

    issue.run({
      row: selectedRow,
      // 프린터 배정이 정해지기 전에는 한 대 전제다 — 고른 것이 없으면 서버 기본값에 맡긴다.
      printerName: headPrinter?.printerName ?? null,
      reissueReasonCode,
      uomCode: uomCodeOf(selectedRow.uomId),
    });
  };

  /** 한 건이라도 실패하면 목록이 불완전하다 — 일부만 보이는 것을 「전부」로 내지 않는다. */
  const isListError = receipts.isError || targets.isError;

  /**
   * 쪽 이동 — **줄 쪽을 먼저 넘기고, 다 넘기면 건 쪽으로 넘어간다.**
   *
   * ⛔ 쪽을 옮기면 고른 줄이 화면에서 사라진다 — 남겨 두면 보이지 않는 것을 가리킨다.
   */
  const goPrev = (): void => {
    setSelectedLineId(null);

    if (pageView !== null && pageView.page > 1) {
      setLinePage(pageView.page - 1);

      return;
    }

    setPage((current) => Math.max(1, current - 1));
    /* 앞 건 쪽의 «마지막» 줄 쪽으로 간다 — 줄 수를 모르므로 범위를 넘겨 두고 잡히게 한다. */
    setLinePage(Number.MAX_SAFE_INTEGER);
  };

  const goNext = (): void => {
    setSelectedLineId(null);

    if (pageView !== null && pageView.page < pageView.totalPages) {
      setLinePage(pageView.page + 1);

      return;
    }

    setPage((current) => current + 1);
    setLinePage(1);
  };

  /** 목록을 지금 다시 받는다. 오류 배너의 「다시 불러오기」와 **같은 동작**이다. */
  const reloadList = (): void => {
    void receipts.refetch();
    targets.refetch();
  };

  return (
    /*
     * ⚠ **이 화면이 최상위 랜드마크다.** POP 라우트는 관리웹 셸을 지나지 않으므로(`routes/pop`)
     * `main`을 세워 주는 바깥이 없다 — 먼저 선 POP 화면들과 같은 형태다.
     */
    <main className="pop-lot-screen pop-ui" aria-label={t.title}>
      {/* 머리줄 어휘를 다른 POP 화면과 맞춘다 — 이름이 달라도 보이는 자리는 같아야 한다. */}
      <header className="pop-header">
        {/*
         * 표제는 **다른 POP 화면과 같은 어휘로 쓴다**(`pop-title`). DS `PageHeader` 로 세우면
         * 규격이 겨냥하는 자리(머리줄의 첫 자식)가 그 부품의 래퍼가 되어 표제 크기가 이
         * 화면에만 24px 로 남는다(실측 — 다른 화면은 26px).
         */}
        <h1 className="pop-title">{t.title}</h1>
        <div className="pop-context-right">
          <PrinterStatusIndicator
            printer={headPrinter}
            isLoading={printers.isPending}
            isError={printers.isError}
            onRetry={() => {
              void printers.refetch();
            }}
          />
          {/* 단말도 상시 보인다(스펙 §3 머리줄 `단말 POP-L1 ●`) — 다른 POP 화면과 같은 자리·순서다. */}
          <Chip status={terminalId === null ? 'warning' : 'info'}>
            {`${tDevice.terminalLabel} ${
              terminalId === null ? tDevice.terminalUnknown : String(terminalId)
            }`}
          </Chip>
        </div>
      </header>

      {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */}
      <PopWorkerMissingBanner workerNo={workerNo} />

      <div className="pop-lot-panes">
        <section className="pane pop-lot-pane" aria-label={t.receipts.paneLabel}>
          {/*
           * ⭐ **좌우 구획의 제목이 같은 자리·같은 급으로 선다** — 스펙 §3 도면이 둘을 나란히
           *    그렸다(`《입하 라인》 (미부착)` · `《채번 대상》`). 한쪽만 표의 캡션으로 서
           *    가운데에 있으면 같은 급으로 읽히지 않고, 안내 배너 «아래»에 놓여 차례도
           *    뒤집힌다(사용자 지적).
           *
           * ⛔ 오류일 때도 감추지 않는다 — 구획의 이름은 내용의 성패와 무관하다.
           */}
          <h2 className="pop-lot-pane-title">{t.receipts.title}</h2>
          {/*
           * ⭐ 발행 여부로 목록을 가른다(사용자 지시 2026-09-15 · #1241). 발행 완료 쪽이 없으면
           *    인쇄를 마친 자재가 목록에서 빠져 재인쇄할 길이 없었다.
           *
           * 바꾸면 쪽과 고른 줄을 푼다 — 남겨 두면 보이지 않는 줄을 가리킨다. 실행 중에는
           * 잠근다 — 쪽 이동과 같은 까닭이다.
           */}
          {/*
           * ⭐ 제목 아래·목록 바로 위에 목록 폭 2분할 탭으로 둔다(사용자 지시 2026-09-15) — 제목
           *    옆 작은 묶음 단추는 실행 단추로 읽혔다. 모양은 DS 탭(굵은 글자 + 강조색 밑줄)을
           *    따르되, DS `Tabs` 는 탭마다 내용 영역을 요구해 이 화면 전용 CSS 로 둔다(`pop.css`).
           */}
          <div
            className="pop-material-lot-filter"
            role="group"
            aria-label={t.receipts.filter.label}
          >
            {ISSUED_VIEWS.map((view) => (
              <button
                key={view}
                type="button"
                className={`pop-material-lot-filter-item ${popTouchClass('normal')}`}
                aria-pressed={issuedView === view}
                disabled={isIssuing}
                onClick={() => {
                  if (issuedView === view) return;
                  setSelectedLineId(null);
                  setPage(1);
                  setLinePage(1);
                  setIssuedView(view);
                }}
              >
                {t.receipts.filter[view]}
              </button>
            ))}
          </div>

          {isListError ? (
            <AlertBanner
              variant="error"
              title={t.receipts.loadFailed}
              action={
                <Button
                  className={popTouchClass('normal')}
                  variant="outlined"
                  size="xl"
                  onClick={reloadList}
                >
                  {t.receipts.retry}
                </Button>
              }
            />
          ) : (
            <>
              {/*
               * ⛔ **「무엇이 걸러졌는가」를 문장으로 두지 않는다.** 위의 발행 여부 탭이 그 일을
               *    한다. 세로 여유가 119px 뿐인 화면이라 배너 한 줄이 목록에서 그만큼을 가져간다.
               */}
              <ReceiptList
                rows={visibleRows}
                supplierLookup={supplierLookup}
                itemNames={itemNames}
                uomLookup={uomLookup}
                selectedId={selectedLineId}
                // 실행 중에 줄을 바꾸면 그 실행의 결과가 어디에도 서지 않는다.
                isLocked={isIssuing}
                onToggleSelect={(lineId) => {
                  // 같은 줄을 다시 누르면 해제한다 — 고른 것을 무를 수단이 없으면 갇힌다.
                  setSelectedLineId((current) => (current === lineId ? null : lineId));
                }}
                empty={emptyMessage(
                  pageView?.isBeyondLast === true,
                  result?.items.length ?? 0,
                  issuedView,
                  pageView?.canNext === true,
                )}
              />
              {/*
               * ⭐ **「갱신」은 쪽 이동 줄에 둔다**(omf-all-around#29). 이 줄은 이미 단추 높이를
               *    쓰고 있어 **세로를 더 먹지 않는다** — 세로 여유가 119px 뿐인 화면이다(스펙 §4).
               *    제목 줄에 얹으면 목록이 그만큼 짧아진다.
               */}
              <div className="pop-lot-list-foot">
                <Button
                  className={popTouchClass('normal')}
                  variant="outlined"
                  size="xl"
                  /* 실행 중에는 잠근다 — 쪽 이동·줄 선택과 같은 까닭이다. */
                  disabled={isIssuing}
                  onClick={reloadList}
                >
                  {t.receipts.refresh}
                </Button>
                {/*
                 * ⛔ 쪽을 옮기면 고른 줄이 풀린다 — 실행 중에 풀리면 그 실행의 결과가 어느 줄에도
                 * 서지 않는다. 목록 줄을 잠그면서 이 자리를 열어 두면 같은 구멍이 남는다.
                 */}
                {pageView === null ? null : (
                  <PageNav view={pageView} isLocked={isIssuing} onPrev={goPrev} onNext={goNext} />
                )}
              </div>
            </>
          )}
        </section>

        <section className="pane pop-lot-pane" aria-label={t.target.paneLabel}>
          <h2 className="pop-lot-pane-title">{t.target.title}</h2>
          <TargetCard
            row={selectedRow}
            itemNames={itemNames}
            uomLookup={uomLookup}
            supplierLookup={supplierLookup}
            lotNo={lot.data ?? null}
            isLotNoLoading={lot.isPending && selectedRow?.lotId !== null}
            isLotNoError={lot.isError}
            hasWorkerNo={workerNo !== null}
            runningStep={issue.step}
            isPrintForbidden={isPrintForbidden}
            isIssued={issuedView === 'issued'}
            onIssue={() => {
              startIssue(null);
            }}
            onReissue={() => {
              setReissueOpen(true);
            }}
          />
          {/*
           * ⛔ **결과는 그 결과를 만든 줄 밑에만 선다.** 끝난 뒤 다른 자재를 고르면 「인쇄
           * 했습니다」가 아직 찍지 않은 자재 밑에 서게 되고, 사람은 그것을 자기 것으로 읽는다.
           */}
          {isResultOfSelected ? <IssueOutcome result={issue.result} /> : null}
        </section>
      </div>

      {isReissueOpen ? (
        <ReissueDialog
          reasons={reissueReasons.data ?? []}
          isLoading={reissueReasons.isPending}
          isError={reissueReasons.isError}
          onCancel={() => {
            setReissueOpen(false);
          }}
          onConfirm={(reissueReasonCode) => {
            setReissueOpen(false);
            startIssue(reissueReasonCode);
          }}
        />
      ) : null}
    </main>
  );
};
