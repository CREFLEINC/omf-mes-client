import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import {
  PuActionBar,
  PuButton,
  PuNote,
  PuScanField,
  PuScreen,
  PuSection,
  PuStack,
} from '../../patterns/pop-uniform';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { toApiError } from '../../patterns/request';
import { useWorkerSession } from '../../patterns/worker-session';
import { ConfirmView } from './confirm-view';
import {
  blockersOfConflict,
  completeFailureOf,
  directCodeOf,
  isAlreadyCompleted,
  isCompletable,
  lookupFailureOf,
  serverMessageOf,
  type Completion,
  type CompletionResult,
} from './model';
import { AlreadyView, ResultView } from './outcome-views';
import {
  openedShipmentRequestKey,
  useCompleteShipment,
  useLookupShipmentRequest,
  useOpenedShipmentRequest,
} from './queries';
import { SearchDialog } from './search-dialog';
import './uniform.css';

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
 * 화면 유형은 T-P-S 단독형이다: 머리줄, 스캔 칸, 본문(빈 안내 → 확인 화면 → 결과), 아래 작업 줄의 [출하 완료].
 * 지시서는 세 입구(PDA 화면 QR · 인쇄 QR · [지시서 검색])로 열고, 모두 같은 확인 값(`:lookup`)을 본다.
 *
 * - [출하 완료]는 한 번 누르면 끝난다 — 확인 화면이 곧 확인 창이다(C-9 의 「마지막 확인 단계」).
 * - 완료 결과는 다음 스캔까지 남는다. 「이미 출하 완료」는 붉은 오류가 아니라 노란 안내다.
 * - ⛔ ERP 송신 여부는 이 화면 어디에도 보이지 않는다(사용자 결정 2026-11-18). 출하 내역(W-04-12)에서만 본다.
 * - 쓰기는 사번이 있어야 나간다 — 서버가 `X-Worker-No` 로 완료 작업자를 남긴다.
 */
export const PopShipmentCompleteScreen = () => {
  const titleId = useId();
  const inputId = useId();
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

  const queryClient = useQueryClient();
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
   * 지시서를 연다(스캔·검색·[직접 입력]). 실패하면 열려 있던 화면은 그대로 두고 칸 아래 띠만 낸다 — 잘못
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
        /* 머리줄 [새로고침]이 다시 읽을 값으로 둔다(`useOpenedShipmentRequest`). */
        queryClient.setQueryData(openedShipmentRequestKey(completion.code), completion);
        show(completion, via);
        onOpened?.(completion);
      },
      onError: (error) => {
        const reason = lookupFailureOf(toApiError(error));
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

  /** 스캔(Enter · 스캐너 끝) — 스캐너 받기는 공통 스캔 칸(`PuScanField`)이 한다. */
  const send = (raw: string): void => {
    const code = raw.trim();
    if (code === '') return;
    /* 보내기 전에 비운다 — 그사이 읽힌 다음 코드가 앞 코드 뒤에 붙지 않게(`material-input-scan` 과 같다). */
    setDraft('');
    open(code, 'scan');
    inputRef.current?.focus();
  };

  /**
   * [직접 입력] 창 — 손으로 친 지시서 번호(SR-…)도 연다. 앞머리 `SHPREQ:` 는 화면이 붙인다(W-2).
   * 창은 공통 스캔 칸의 [직접 입력] 창(`PuScanField` `manual` · 제목 없음 · 글자판)이다.
   */
  const sendDirect = (entered: string): void => {
    const typed = entered.trim();
    if (typed === '') return;
    setDraft('');
    open(directCodeOf(typed), 'direct', false, undefined, typed);
    inputRef.current?.focus();
  };

  /*
   * 머리줄 [새로고침] — 연 지시서를 같은 코드로 다시 읽어 «그 자리에서» 바꾼다(사용자 지시 2026-11-20). 확인 화면·
   * 검색 창·스캔 칸은 그대로다(검색 창 목록은 `useQuery` 라 함께 다시 받는다). 다시 읽지 못하면 앞 값을 두고 칸 아래
   * 띠만 낸다.
   */
  const openedCode =
    view.kind === 'confirm' || view.kind === 'already' ? view.completion.code : null;
  const opened = useOpenedShipmentRequest(openedCode);
  useEffect(() => {
    const fresh = opened.data;
    if (fresh === undefined) return;
    setView((current) =>
      (current.kind === 'confirm' || current.kind === 'already') &&
      current.completion.code === fresh.code &&
      current.completion !== fresh
        ? { ...current, completion: fresh }
        : current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 새로 받은 때만 바꾼다(409 가 그린 사유를 덮지 않게)
  }, [opened.dataUpdatedAt]);
  useEffect(() => {
    if (opened.errorUpdatedAt === 0 || shownRequestNo === null) return;
    setNotice({ tone: 'error', text: t.scan.failed, detail: t.scan.previousStill(shownRequestNo) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 실패한 때만 알린다
  }, [opened.errorUpdatedAt]);

  /* 조회·완료가 끝나고 검색 창이 닫혀 있으면 스캔 칸이 포커스를 되찾는다 — 다음 스캔이 사라지지 않게. */
  useEffect(() => {
    if (!lookup.isPending && !complete.isPending && !isSearching) inputRef.current?.focus();
  }, [lookup.isPending, complete.isPending, isSearching]);

  const confirm = view.kind === 'confirm' ? view : null;
  const canComplete =
    confirm !== null && isCompletable(confirm.completion) && workerNo !== null && !lookup.isPending;

  /*
   * 보내는 중 표시 — 렌더를 기다리지 않는 잠금이다. `complete.isPending` 은 다음 렌더에야 참이 되어, 두 번 빠르게
   * 누르면 두 요청이 나갔다(실화면 검증 2026-11-20: 두 번 눌러 두 번 보냄 → 두 번째가 409 로 성공 화면을 덮음).
   */
  const sending = useRef(false);

  const runComplete = (): void => {
    if (confirm === null || workerNo === null || !canComplete || complete.isPending) return;
    if (sending.current) return;
    sending.current = true;
    setFailure(null);
    complete.mutate(
      { completion: confirm.completion, workerNo },
      {
        onSettled: () => {
          sending.current = false;
        },
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
          /* 409 가 실어 온 막는 이유를 그대로 그린다 — 다시 조회하지 않는다. 다른 단말이 바꾼 판정은 머리줄 [새로고침]으로 읽는다. */
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

  /* 지시서를 연 동안 스캔 칸이 초록 「스캔 완료」다(POP 스캔 칸 공통). */
  const isOpened = view.kind !== 'idle';

  const actionBar = (
    <PuActionBar label={t.bar.label}>
      <PuButton
        variant="primary"
        disabled={!canComplete || complete.isPending}
        onClick={runComplete}
      >
        {complete.isPending ? t.bar.completing : t.bar.complete}
      </PuButton>
    </PuActionBar>
  );

  return (
    <main className="pop-ui" aria-labelledby={titleId}>
      <h1 id={titleId} className="psc-title">
        {t.title}
      </h1>

      <PopWorkerMissingBanner workerNo={workerNo} />

      <PuScreen actionBar={actionBar}>
        <PuStack fill>
          <PuSection className="psc-top" grow={false} label={t.scan.label}>
            <PuScanField
              label={t.scan.label}
              inputRef={inputRef}
              value={draft}
              done={isOpened}
              error={
                notice === null ? undefined : (
                  <>
                    <span>{notice.text}</span>
                    {notice.detail !== undefined && <span> {notice.detail}</span>}
                  </>
                )
              }
              manual={{ label: t.scan.manualLabel }}
              onChange={setDraft}
              onSubmit={send}
              onManualSubmit={sendDirect}
            />
            {/* [지시서 검색] — 스캔 칸 옆(분할 LOT 라벨 위 구획의 「스캔 칸 + 옆 칸」 배치). */}
            <PuButton
              className="psc-search-btn"
              icon="search"
              onClick={() => {
                setIsSearching(true);
              }}
            >
              {t.scan.search}
            </PuButton>
          </PuSection>
          <div className="psc-content">
            {lookup.isPending && <PuNote live>{t.scan.looking}</PuNote>}
            {failure !== null && <PuNote tone="bad">{failure}</PuNote>}
            {view.kind === 'confirm' && <ConfirmView completion={view.completion} />}
            {view.kind === 'already' && <AlreadyView completion={view.completion} />}
            {view.kind === 'done' && <ResultView result={view.result} workerNo={workerLabel} />}
          </div>
        </PuStack>
      </PuScreen>

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
