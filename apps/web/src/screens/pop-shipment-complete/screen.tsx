import { AlertBanner, Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useScannerSubmit } from '../../patterns/pop-scanner-submit';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { toApiError } from '../../patterns/request';
import { useWorkerSession } from '../../patterns/worker-session';
import { ConfirmView } from './confirm-view';
import {
  completeFailureOf,
  formatQty,
  groupBlockers,
  isAlreadyCompleted,
  isCompletable,
  lookupFailureOf,
  totalsOf,
  type Completion,
  type CompletionResult,
} from './model';
import { AlreadyView, IdleView, ResultView } from './outcome-views';
import { useCompleteShipment, useLookupShipmentRequest } from './queries';
import { SearchDialog } from './search-dialog';

const t = messages.popShipmentComplete;

type Via = 'scan' | 'search';

type View =
  | { kind: 'idle' }
  | { kind: 'confirm'; completion: Completion; via: Via }
  | { kind: 'already'; completion: Completion }
  | { kind: 'done'; result: CompletionResult };

/** 스캔 칸 바로 아래 띠 — 어느 스캔의 답인지 칸 곁에 둔다(POP 공통). */
interface ScanNotice {
  tone: 'error' | 'warning';
  text: string;
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

  const [view, setView] = useState<View>({ kind: 'idle' });
  const [notice, setNotice] = useState<ScanNotice | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
  const open = (code: string, via: Via, keepFailure = false): void => {
    if (lookup.isPending || complete.isPending) return;
    setNotice(null);
    if (!keepFailure) setFailure(null);
    lookup.mutate(code, {
      onSuccess: (completion) => {
        complete.resetKey();
        show(completion, via);
      },
      onError: (error) => {
        const reason = lookupFailureOf(toApiError(error));
        setNotice({
          tone: 'error',
          text:
            reason === 'notCode'
              ? t.scan.notCode(code)
              : reason === 'notFound'
                ? t.scan.notFound(code)
                : t.scan.failed,
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
          const reason = completeFailureOf(toApiError(error));
          if (reason === 'network' || reason === 'other') {
            /* 같은 멱등 키로 다시 누른다 — 서버가 받았는지 모른다. */
            setFailure(reason === 'network' ? t.failure.network : t.failure.other);
            return;
          }
          complete.resetKey();
          if (reason === 'blocked') setFailure(t.failure.blocked);
          if (reason === 'changed') setFailure(t.failure.changed);
          open(confirm.completion.code, confirm.via, true);
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
              : t.bar.ready(
                  formatQty(totalsOf(view.completion).qty),
                  totalsOf(view.completion).lotCount,
                );

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
          <Button type="submit" variant="outlined" size="xl">
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
            <AlertBanner variant={notice.tone} title={notice.text} />
          ) : null}
        </div>

        <div className="pop-ship-content">
          {failure !== null && (
            <div className="banner-slot">
              <AlertBanner variant="error">{failure}</AlertBanner>
            </div>
          )}
          {view.kind === 'idle' && <IdleView />}
          {view.kind === 'confirm' && <ConfirmView completion={view.completion} via={view.via} />}
          {view.kind === 'already' && <AlreadyView completion={view.completion} />}
          {view.kind === 'done' && <ResultView result={view.result} workerNo={workerNo} />}
        </div>
      </div>

      <div className="pop-action-bar">
        <div className="pop-action-note" id={barNoteId} aria-live="polite">
          <p className="field-note">{barNote}</p>
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
