import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useState } from 'react';

import { useIsOnline } from './connection';
import { KeypadPanel } from './keypad-panel';
import { readOutboxSize, readWorkerDirectory, writeWorkerDirectory } from './pop-bridge';
import { useTerminal, useWorkerDirectory, useWorkerLookup } from './queries';
import { pickExact, verifyWorker, type WorkerResponse } from './verify';
import { looksUnusual } from './worker-no';
import { usePopIdentity } from '../../../patterns/pop-identity';
import { PuNote, PuScreen, puToast } from '../../../patterns/pop-uniform';
import { setWorkerSession } from '../../../patterns/worker-session';
import './uniform.css';

/**
 * 홈의 사번 입력(P-CO-01 → 홈 · omf-all-around#334) — 사번이 확인되지 않은 동안 홈 내용 자리에 선다.
 * 확인하면 단말의 현재 작업자(`worker-session`)가 정해지고, 같은 자리에서 홈 내용으로 바뀐다(주소 이동 없음).
 *
 * ⭐ **이 화면은 인증이 아니라 귀속이다**(§5-1). 인증은 단말 토큰이 이미 통과시켰고, 여기서는 「누가 한 일로
 * 기록할 것인가」만 정한다. 확인 방식(서버 조회 · 연결 상태 판정 · 오프라인 목록)은 옛 사번 입력 화면과 같다.
 *
 * ⛔ **세션을 만들지 않는다**(§5-4). 서버가 사번 세션을 갖지 않는다 — 단말이 현재 작업자를 들고 있다가
 * 매 쓰기 요청에 `X-Worker-No` 로 싣는다.
 */

const t = messages.workerAssignment;

/**
 * 확인을 누른 사번과 **그때의 연결 상태**.
 *
 * ⭐ 확인은 시작한 경로로 끝나야 한다 — 도중에 연결이 바뀌었다고 다른 경로로 갈아타면 화면이 안내한 것과
 * 다른 데서 답이 오고, 두 경로가 각자 답을 내면 나중 것이 앞선 것을 덮는다.
 */
interface Submitted {
  workerNo: string;
  offline: boolean;
}

/**
 * 지정 시각을 화면 문자열로. **단말이 놓인 곳의 시간으로 낸다** — 현장 사람이 읽는 값이다. 초는 버린다.
 */
const formatAssignedAt = (now: Date): string =>
  now.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export const PopHomeLogin = () => {
  /** 키패드가 채우는 값. 확인을 누르기 전에는 조회하지 않는다. */
  const [workerNo, setWorkerNo] = useState('');
  /** 확인을 누른 사번. 이 값이 있어야 조회가 돈다 */
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** [사번 확인]을 눌렀는데 6자리 숫자가 아니었다 — 다시 칠 때까지 안내를 둔다(omf-all-around#288). */
  const [isUnusualShown, setUnusualShown] = useState(false);
  /**
   * 아직 보내지 못한 기록 수(교대 뒤 알림 · §6). ⛔ 큐의 사번은 바꾸지 않는다(B-3 이력 불변) — 그때 그
   * 사람의 기록이므로 세어서 알리기만 한다. 세지 못하면 0(알리지 않음).
   */
  const [pendingQueue, setPendingQueue] = useState(0);

  /* ⛔ 신원은 서버가 확인해 준 것만 쓴다(공유계약 F-4) — 주소에서 받지 않는다. */
  const { terminalId } = usePopIdentity();
  const terminal = useTerminal(terminalId);
  const isOnline = useIsOnline();
  const homePlantId = terminal.data?.plantId ?? null;

  useEffect(() => {
    void readOutboxSize().then(setPendingQueue);
  }, []);

  /**
   * ⭐ **연결돼 있을 때 목록을 미리 받아 둔다**(§5-6 · C-11) — 오프라인에서 사번을 확인할 근거는 이것뿐이다.
   * ⛔ 공장 없이 전 공장을 받아 두는 것으로 메우지 않는다 — 옆 공장 사번이 이 단말에서 통과한다.
   */
  const directory = useWorkerDirectory(homePlantId, isOnline);
  const directoryData = directory.data;

  useEffect(() => {
    if (directoryData === undefined) return;

    void writeWorkerDirectory(homePlantId, directoryData, new Date().toISOString());
  }, [directoryData, homePlantId]);

  /* ⛔ 확인은 시작한 경로로 끝낸다 — 지금 연결 상태가 아니라 «누를 때»의 상태를 본다. */
  const lookup = useWorkerLookup(
    submitted !== null && !submitted.offline ? submitted.workerNo : null,
  );
  const lookupData = lookup.data;

  /**
   * 확인 결과를 화면 상태로 옮긴다. ⛔ 렌더 중에 옮기지 않는다(거부 결과가 매 렌더 다시 들어간다).
   * ⛔ 미등록과 비재직을 가른다(§6) — 문구도 사용자가 할 일도 다르다.
   */
  const settle = useCallback(
    (found: WorkerResponse | undefined) => {
      const result = verifyWorker(found, homePlantId);

      setSubmitted(null);

      if (result.kind === 'unknown') {
        setError(t.error.unknown);
        return;
      }

      if (result.kind === 'inactive') {
        setError(t.error.inactive);
        return;
      }

      setError(null);
      setWorkerNo('');
      /* ⚠ 다른 공장 소속은 막지 않고 알린다(§6) — 확인과 함께 홈 내용으로 바뀌므로 알림으로 보인다. */
      if (result.isOtherPlant) puToast(t.current.otherPlant, 'warn');
      /* 같은 자리에서 홈 내용으로 바뀐다 — 홈이 현재 작업자를 읽는다. */
      setWorkerSession({
        worker: result.worker,
        assignedAt: formatAssignedAt(new Date()),
        isOtherPlant: result.isOtherPlant,
      });
    },
    [homePlantId],
  );

  useEffect(() => {
    if (submitted === null || submitted.offline || lookupData === undefined) return;

    settle(pickExact(lookupData, submitted.workerNo));
  }, [submitted, lookupData, settle]);

  /**
   * 오프라인 확인 — **미리 받아 둔 목록으로 본다**(§5-6). ⛔ 막지 않는다.
   * ⛔ 목록을 한 번도 받지 못했으면 통과시키지 않는다(§6 · C-11).
   */
  useEffect(() => {
    if (submitted === null || !submitted.offline) return;

    let cancelled = false;

    void readWorkerDirectory(homePlantId).then((cached) => {
      if (cancelled) return;

      if (cached === null) {
        setSubmitted(null);
        setError(t.error.noDirectory);
        return;
      }

      settle(pickExact(cached, submitted.workerNo));
    });

    return () => {
      cancelled = true;
    };
  }, [submitted, homePlantId, settle]);

  /* 조회 자체가 실패했다. **사번이 틀렸다고 말하지 않는다** — 다른 문제다. */
  useEffect(() => {
    if (submitted === null || submitted.offline || !lookup.isError) return;

    setSubmitted(null);
    setError(t.error.lookupFailed);
  }, [submitted, lookup.isError]);

  return (
    <PuScreen className="home-login">
      <div className="home-login-box">
        <KeypadPanel
          workerNo={workerNo}
          onChange={(value) => {
            setUnusualShown(false);
            setWorkerNo(value);
          }}
          onSubmit={() => {
            setError(null);
            /* ⛔ 6자리 숫자가 아니면 조회하지 않고 다시 입력하게 한다(사용자 지시 2026-11-17). */
            if (looksUnusual(workerNo)) {
              setUnusualShown(true);
              return;
            }
            /* 누르는 «순간»의 연결 상태를 함께 담는다 — 그 경로로 끝까지 간다. */
            setSubmitted({ workerNo, offline: !isOnline });
          }}
          isChecking={submitted !== null && (submitted.offline || lookup.isFetching)}
          error={error}
          offlineNote={isOnline ? null : t.offline.note}
          isUnusualShown={isUnusualShown}
          confirmedWorkerNo={null}
        />
        {pendingQueue > 0 && <PuNote tone="warn">{t.current.pendingQueue(pendingQueue)}</PuNote>}
      </div>
    </PuScreen>
  );
};
