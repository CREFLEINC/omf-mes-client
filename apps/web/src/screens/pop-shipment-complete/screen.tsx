import { AlertBanner, Button, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useScannerSubmit } from '../../patterns/pop-scanner-submit';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { toApiError } from '../../patterns/request';
import { useWorkerSession } from '../../patterns/worker-session';
import { ConfirmView } from './confirm-view';
import {
  blockersOfConflict,
  completeFailureOf,
  directCodeOf,
  groupBlockers,
  hasMoreBelow,
  isAlreadyCompleted,
  isCompletable,
  lookupFailureOf,
  qtyWithUom,
  serverMessageOf,
  totalsOf,
  uomOf,
  type Completion,
  type CompletionResult,
} from './model';
import { AlreadyView, IdleView, ResultView } from './outcome-views';
import { useCompleteShipment, useLookupShipmentRequest } from './queries';
import { SearchDialog } from './search-dialog';

const t = messages.popShipmentComplete;

type Via = 'scan' | 'search' | 'direct';

type View =
  | { kind: 'idle' }
  | { kind: 'confirm'; completion: Completion; via: Via }
  | { kind: 'already'; completion: Completion }
  | { kind: 'done'; result: CompletionResult };

/** 스캔 칸 바로 아래 띠 — 어느 스캔의 답인지 칸 곁에 둔다(POP 공통). */
interface ScanNotice {
  tone: 'error' | 'warning';
  text: string;
  /** 아래에 남은 화면이 앞서 연 지시서라는 것을 밝힌다(둘러보기 W-3). */
  detail?: string;
}

/**
 * P-04-07 출하 완료(POP · 피처 010 · omf-all-around#305) — 관리웹 W-04-04 출하 처리를 대신한다.
 *
 * 화면 유형은 T-P-S 단독형이다: 머리줄, 스캔 칸, 본문(입구 안내 → 확인 화면 → 결과), 바닥 띠의 [출하 완료].
 * 지시서는 세 입구(PDA 화면 QR · 인쇄 QR · [찾기])로 열고, 모두 같은 확인 값(`:lookup`)을 본다.
 *
 * - [출하 완료]는 한 번 누르면 끝난다 — 확인 화면이 곧 확인 창이다(C-9 의 「마지막 확인 단계」).
 * - 완료 결과는 다음 스캔까지 남는다. 「이미 출하 완료」는 붉은 오류가 아니라 노란 안내다.
 * - ⛔ ERP 송신 여부는 이 화면 어디에도 보이지 않는다(사용자 결정 2026-11-18). 출하 내역(W-04-12)에서만 본다.
 * - 쓰기는 사번이 있어야 나간다 — 서버가 `X-Worker-No` 로 완료 작업자를 남긴다.
 */
export const PopShipmentCompleteScreen = () => {
  const titleId = useId();
  const barNoteId = useId();
  const identity = usePopIdentity();
  const workerSession = useWorkerSession();
  const workerNo = identity.workerNo?.trim() || workerSession?.worker.workerNo?.trim() || null;
  /* 결과 「작업자」는 이름(사번) — 세션 작업자가 같은 사번일 때만 이름을 안다(POP 홈과 같은 규칙). */
  const workerLabel =
    workerNo !== null &&
    workerSession?.worker.workerNo === workerNo &&
    workerSession.worker.workerName
      ? `${workerSession.worker.workerName} (${workerNo})`
      : workerNo;

  const [view, setView] = useState<View>({ kind: 'idle' });
  const [notice, setNotice] = useState<ScanNotice | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  /* 확인 화면이 아래로 더 이어지는가 — 바닥에 「아래로 밀면…」 단서를 붙인다(둘러보기 W-8). */
  const contentRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const measureMore = useCallback(() => {
    const box = contentRef.current;
    setMoreBelow(box !== null && hasMoreBelow(box));
  }, []);

  const lookup = useLookupShipmentRequest();
  const complete = useCompleteShipment();

  /** 확인 값을 받아 화면을 고른다. 완료된 지시서는 확인 화면 대신 「이미 출하 완료」다. */
  const show = (completion: Completion, via: Via): void => {
    setView(
      isAlreadyCompleted(completion)
        ? { kind: 'already', completion }
        : { kind: 'confirm', completion, via },
    );
  };

  /**
   * 지시서를 연다(스캔·찾기·[다시 확인]). 실패하면 열려 있던 화면은 그대로 두고 칸 아래 띠만 낸다 — 잘못
   * 찍은 LOT 라벨 하나로 보던 확인 화면이 닫히면 다시 스캔해야 한다.
   *
   * @param keepFailure 완료 실패 뒤 다시 읽는 경우 — 실패 까닭을 남겨 둔다.
   */
  /** 지금 화면에 남은 지시서 번호 — 새 코드 조회가 실패했을 때 띠에 밝힌다(W-3). */
  const shownRequestNo =
    view.kind === 'confirm' || view.kind === 'already'
      ? view.completion.shipmentRequestNo
      : view.kind === 'done'
        ? view.result.completion.shipmentRequestNo
        : null;

  const open = (
    code: string,
    via: Via,
    keepFailure = false,
    onOpened?: (completion: Completion) => void,
    typed?: string,
  ): void => {
    if (lookup.isPending || complete.isPending) return;
    setNotice(null);
    if (!keepFailure) setFailure(null);
    lookup.mutate(code, {
      onSuccess: (completion) => {
        complete.resetKey();
        show(completion, via);
        onOpened?.(completion);
      },
      onError: (error) => {
        const reason = lookupFailureOf(toApiError(error));

        if (reason === 'otherBusinessUnit') {
          setNotice({
            tone: 'error',
            text: t.bu012.otherBusinessUnit,
            detail: t.bu012.otherBusinessUnitDetail,
          });
          return;
        }

        const text =
          via === 'direct' && reason !== 'failed'
            ? t.scan.directNotFound(typed ?? code)
            : reason === 'notCode'
              ? t.scan.notCode(code)
              : reason === 'notFound'
                ? t.scan.notFound(code)
                : t.scan.failed;
        setNotice({
          tone: 'error',
          text,
          ...(shownRequestNo === null ? {} : { detail: t.scan.previousStill(shownRequestNo) }),
        });
      },
    });
  };

  const send = (raw: string): void => {
    const code = raw.trim();
    if (code === '') return;
    /* 보내기 전에 비운다 — 그사이 읽힌 다음 코드가 앞 코드 뒤에 붙지 않게(`material-input-scan` 과 같다). */
    setDraft('');
    open(code, 'scan');
    inputRef.current?.focus();
  };
  const scanner = useScannerSubmit(send, () => inputRef.current?.value ?? '');

  /** [직접 입력] — 손으로 친 지시서 번호(SR-…)도 연다. 앞머리 `SHPREQ:` 는 화면이 붙인다(W-2). */
  const sendDirect = (): void => {
    const typed = (inputRef.current?.value ?? draft).trim();
    if (typed === '') return;
    setDraft('');
    open(directCodeOf(typed), 'direct', false, undefined, typed);
    inputRef.current?.focus();
  };

  /* 화면이 바뀌거나 창 크기가 바뀌면 다시 잰다. 구를 때는 `onScroll` 이 잰다. */
  useEffect(() => {
    measureMore();
    window.addEventListener('resize', measureMore);
    return () => window.removeEventListener('resize', measureMore);
  }, [view, failure, measureMore]);

  /* 조회·완료가 끝나고 찾기 창이 닫혀 있으면 스캔 칸이 포커스를 되찾는다 — 다음 스캔이 사라지지 않게. */
  useEffect(() => {
    if (!lookup.isPending && !complete.isPending && !isSearching) inputRef.current?.focus();
  }, [lookup.isPending, complete.isPending, isSearching]);

  const submitScan = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    scanner.submit(draft);
  };

  const confirm = view.kind === 'confirm' ? view : null;
  const groups = confirm === null ? [] : groupBlockers(confirm.completion.blockers);
  const canComplete =
    confirm !== null && isCompletable(confirm.completion) && workerNo !== null && !lookup.isPending;

  const runComplete = (): void => {
    if (confirm === null || workerNo === null || !canComplete || complete.isPending) return;
    setFailure(null);
    complete.mutate(
      { completion: confirm.completion, workerNo },
      {
        onSuccess: (result) => {
          complete.resetKey();
          setNotice(null);
          setView({ kind: 'done', result });
        },
        onError: (error) => {
          const apiError = toApiError(error);
          const reason = completeFailureOf(apiError);
          /* 서버 문구를 함께 보인다 — 막힌 까닭을 작업자가 그대로 전할 수 있게(검증 1회차 F-3). */
          const message = serverMessageOf(apiError);
          const withMessage = (base: string): string =>
            message === null || message === base ? base : t.failure.withMessage(base, message);
          if (reason === 'network' || reason === 'other') {
            /* 같은 멱등 키로 다시 누른다 — 서버가 받았는지 모른다. */
            setFailure(reason === 'network' ? t.failure.network : withMessage(t.failure.other));
            return;
          }
          complete.resetKey();
          /* 409 가 실어 온 막는 이유를 그대로 그린다 — 다시 조회하지 않는다. 다른 단말이 바꾼 판정은 [다시 확인]으로 읽는다. */
          const blockers = reason === 'blocked' ? blockersOfConflict(apiError) : null;
          if (blockers !== null) {
            setFailure(t.failure.blocked);
            setView({ ...confirm, completion: { ...confirm.completion, blockers } });
            return;
          }
          if (reason === 'blocked') setFailure(t.failure.blocked);
          if (reason === 'changed') setFailure(withMessage(t.failure.changed));
          /*
           * 「이미 완료」는 다시 읽어 정말 완료됐으면 안내 화면으로 가고(오류 띠 없음), 완료되지 않았으면 서버가 다른
           * 까닭으로 거절한 것이다 — 확인 화면에 남아 오류를 알린다.
           */
          open(confirm.completion.code, confirm.via, true, (reread) => {
            if (reason === 'alreadyCompleted' && !isAlreadyCompleted(reread)) {
              setFailure(withMessage(t.failure.alreadyNotDone));
            }
          });
        },
      },
    );
  };

  const placeholder =
    view.kind === 'confirm'
      ? t.scan.replacePlaceholder
      : view.kind === 'done'
        ? t.scan.nextPlaceholder
        : t.scan.placeholder;

  const barNote =
    view.kind === 'idle'
      ? t.bar.idle
      : view.kind === 'already'
        ? t.bar.already
        : view.kind === 'done'
          ? t.bar.done
          : groups.length > 0
            ? t.bar.blocked(groups.length)
            : workerNo === null
              ? t.bar.workerMissing
              : null;
  const lockReason =
    view.kind === 'idle'
      ? t.bar.lock.idle
      : view.kind === 'already'
        ? t.bar.lock.already
        : view.kind === 'done'
          ? t.bar.lock.done
          : groups.length > 0
            ? t.bar.lock.blocked(groups.length)
            : workerNo === null
              ? t.bar.lock.worker
              : null;
  /* 완료 가능 — 시안 바닥 띠: 굵은 요약(「160 EA · LOT 4」) + 무엇이 생기는지. */
  const readyLead =
    barNote === null && confirm !== null
      ? t.bar.readyLead(
          qtyWithUom(totalsOf(confirm.completion).qty, uomOf(confirm.completion)),
          totalsOf(confirm.completion).lotCount,
        )
      : null;

  return (
    <main className="pop-shell pop-ui pop-ship" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
      </header>

      <PopWorkerMissingBanner workerNo={workerNo} />

      <div className="pop-ship-main">
        <form className="pop-ship-scan" onSubmit={submitScan}>
          <TextField
            ref={inputRef}
            size="xl"
            label={t.scan.label}
            placeholder={placeholder}
            value={draft}
            fullWidth
            autoComplete="off"
            onKeyDown={scanner.onKeyDown}
            onChange={(event) => {
              setDraft(event.target.value);
              scanner.noteInput(event.target.value);
            }}
          />
          <Button type="button" variant="outlined" size="xl" onClick={sendDirect}>
            {t.scan.submit}
          </Button>
          <Button
            type="button"
            variant="outlined"
            size="xl"
            onClick={() => {
              setIsSearching(true);
            }}
          >
            {t.scan.search}
          </Button>
        </form>

        <div className="scan-outcome">
          {lookup.isPending ? (
            <p className="field-note">{t.scan.looking}</p>
          ) : notice !== null ? (
            <AlertBanner variant={notice.tone} title={notice.text}>
              {notice.detail}
            </AlertBanner>
          ) : null}
        </div>

        <div className="pop-ship-content" ref={contentRef} onScroll={measureMore}>
          {failure !== null && (
            <div className="banner-slot">
              <AlertBanner variant="error">{failure}</AlertBanner>
            </div>
          )}
          {view.kind === 'idle' && <IdleView />}
          {view.kind === 'confirm' && <ConfirmView completion={view.completion} via={view.via} />}
          {view.kind === 'already' && <AlreadyView completion={view.completion} />}
          {view.kind === 'done' && <ResultView result={view.result} workerNo={workerLabel} />}
          {moreBelow && view.kind === 'confirm' && (
            <p className="pop-ship-more" aria-hidden="true">
              <Icon name="expand_more" size={20} />
              {t.lots.moreBelow}
            </p>
          )}
        </div>
      </div>

      <div className="pop-action-bar">
        <div className="pop-action-note" id={barNoteId} aria-live="polite">
          {readyLead !== null ? (
            /* ⚠ `field-note` 가 아니다 — POP 하단 안내 문장은 공통 규칙으로 숨지만(#291), 이 줄은 안내가 아니라
               누르면 무엇이 일어나는지의 요약이다(시안 P0407-After 바닥 띠 · 검증 1회차). */
            <p className="pop-ship-bar-ready">
              <Icon name="inventory" size={20} aria-hidden />
              <strong>{readyLead}</strong>
              <span aria-hidden="true">—</span>
              <span>{t.bar.readyNote}</span>
            </p>
          ) : (
            <>
              {/*
               * 잠긴 까닭 한 줄(둘러보기 W-9) — `field-note` 가 아니다. 긴 안내 문장(아래 field-note)은 POP 공통
               * 규칙으로 숨고(#291), 이 줄은 [출하 완료]가 왜 잠겼는지만 짧게 말한다.
               */}
              {lockReason !== null && (
                <p className="pop-ship-bar-lock">
                  <Icon name="lock" size={18} aria-hidden />
                  <span>{lockReason}</span>
                </p>
              )}
              <p className="field-note">{barNote}</p>
            </>
          )}
        </div>
        {confirm !== null && (
          <>
            <Button
              type="button"
              size="2xl"
              variant="outlined"
              disabled={lookup.isPending || complete.isPending}
              onClick={() => open(confirm.completion.code, confirm.via)}
            >
              {t.bar.recheck}
            </Button>
            <Button
              type="button"
              size="2xl"
              variant="outlined"
              disabled={complete.isPending}
              onClick={() => {
                setFailure(null);
                setNotice(null);
                setView({ kind: 'idle' });
              }}
            >
              {t.bar.close}
            </Button>
          </>
        )}
        <Button
          type="button"
          size="2xl"
          variant="filled"
          disabled={!canComplete || complete.isPending}
          aria-describedby={barNoteId}
          onClick={runComplete}
        >
          {complete.isPending ? t.bar.completing : t.bar.complete}
        </Button>
      </div>

      {isSearching && (
        <SearchDialog
          onClose={() => setIsSearching(false)}
          onPick={(code) => {
            setIsSearching(false);
            open(code, 'search');
          }}
        />
      )}
    </main>
  );
};
