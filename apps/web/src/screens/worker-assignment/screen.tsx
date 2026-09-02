import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useState } from 'react';

import { useIsOnline } from './connection';
import { KeypadPanel } from './keypad-panel';
import { readOutboxSize, readWorkerDirectory, writeWorkerDirectory } from './pop-bridge';
import { useTerminal, useWorkerDirectory, useWorkerLookup } from './queries';
import { pickExact, verifyWorker, type WorkerResponse } from './verify';
import { WorkerCard } from './worker-card';
import { setWorkerSession, useWorkerSession } from '../../patterns/worker-session';

/**
 * P-CO-01 작업자 지정 — **POP 진입점**이다(스펙 §3).
 *
 * ```
 * 헤더 64      단말 이름 · 설치 위치            ● 연결됨
 * 본문 704     좌 《사번 입력》 512 │ 우 《현재 작업자》 512
 * ```
 * 액션바가 없다 — 확인은 키패드 옆에 둔다.
 *
 * ⭐⭐ **이 화면은 인증이 아니라 귀속이다**(§5-1). 인증은 단말 토큰이 이 화면 «전»에 이미
 * 통과시켰고, 여기서는 「누가 한 일로 기록할 것인가」만 정한다.
 *
 * ⛔ **세션을 만들지 않는다**(§5-4). 서버가 사번 세션을 갖지 않는다 — 단말이 현재 작업자를
 * 들고 있다가 **매 쓰기 요청에 `X-Worker-No` 로 싣는다.** 그래서 「언제 지우나」가 화면
 * 문제가 되고, 지금은 **지우지 않는다**(교대는 사람이 누르고, 단말 재시작으로 사라진다).
 *
 * ⛔ **아무것도 저장하지 않는다.** 사번은 단말 메모리에만 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.workerAssignment;

/**
 * 확인을 누른 사번과 **그때의 연결 상태**.
 *
 * ⭐ **상태를 함께 담는 이유가 있다.** 확인은 시작한 경로로 끝나야 한다 — 도중에 연결이
 * 바뀌었다고 다른 경로로 갈아타면 화면이 안내한 것과 다른 데서 답이 오고, 두 경로가 각자
 * 답을 내면 나중 것이 앞선 것을 덮는다.
 */
interface Submitted {
  workerNo: string;
  offline: boolean;
}

/**
 * 지정 시각을 화면 문자열로. **단말이 놓인 곳의 시간으로 낸다** — 현장 사람이 읽는 값이다.
 *
 * 초는 버린다. 분 단위면 「언제부터 내 사번으로 남는가」를 아는 데 충분하고, 초까지 두면
 * 화면이 정밀해 보이지만 실제로 그만한 정밀도가 의미를 갖는 자리가 아니다.
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

export const WorkerAssignmentScreen = () => {
  /** 키패드가 채우는 값. 확인을 누르기 전에는 조회하지 않는다. */
  const [workerNo, setWorkerNo] = useState('');
  /** 확인을 누른 사번. 이 값이 있어야 조회가 돈다 */
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  /**
   * 현재 작업자 — **메모리에만 둔다**(§5-4). 저장하지 않으므로 단말을 다시 켜면 사라지고,
   * ⛔ **화면 밖 자리에 둔다** — 컴포넌트 안에 두면 다른 화면으로 넘어갈 때 사라진다.
   */
  const session = useWorkerSession();
  const [error, setError] = useState<string | null>(null);
  /** 교대할 때 알릴 미전송 건수. 0이면 알릴 것이 없다. */
  const [pendingQueue, setPendingQueue] = useState(0);

  /**
   * ⚠ **단말 식별자를 줄 자리가 이 저장소에 아직 없다** — 셸이 여는 통로가 단말 토큰·캐시·
   * 큐·출력물만 내주고 식별자를 내주지 않는다. 그래서 단말 조회가 서지 않고, 헤더는 이름
   * 대신 없음 표시를 낸다. ⛔ 지어내지 않는다.
   *
   * ⭐ 통로가 생기면 **이 한 자리**에 식별자를 넣으면 된다.
   */
  const terminalId: number | null = null;
  const terminal = useTerminal(terminalId);

  const isOnline = useIsOnline();
  const homePlantId = terminal.data?.plantId ?? null;

  /**
   * ⭐ **연결돼 있을 때 목록을 미리 받아 둔다**(§5-6 · C-11) — 오프라인에서 사번을 확인할
   * 근거는 이것뿐이다. 받아 두는 것과 쓰는 것이 시점이 다르므로, 받는 즉시 셸 캐시에 넣는다.
   *
   * ⛔ **지금은 한 번도 돌지 않는다.** 「해당 공장」이 스펙의 조건인데 공장은 단말이 알려주고,
   * 단말을 지목할 값이 이 저장소에 아직 없다(위 `terminalId`). 그래서 실기의 오프라인 확인은
   * **언제나 「목록을 아직 받지 못했습니다」로 떨어진다** — 읽는 쪽은 서 있고 **받아 두는 쪽이
   * 비어 있다.**
   *
   * ⛔ **공장 없이 전 공장을 받아 두는 것으로 메우지 않는다** — 옆 공장 사번이 이 단말에서
   * 통과한다. 단말 값을 얻는 경로가 서면 위 `terminalId` 한 자리를 채우는 것으로 이 연쇄가
   * 통째로 살아난다.
   */
  const directory = useWorkerDirectory(homePlantId, isOnline);
  const directoryData = directory.data;

  useEffect(() => {
    if (directoryData === undefined) return;

    void writeWorkerDirectory(homePlantId, directoryData, new Date().toISOString());
  }, [directoryData, homePlantId]);

  /*
   * ⛔ **확인은 시작한 경로로 끝낸다.** 지금 연결 상태가 아니라 **누를 때의 상태**를 본다 —
   * 확인 중에 연결이 돌아왔다고 도중에 서버 조회로 갈아타면, 화면은 「미리 받아 둔 목록으로
   * 확인합니다」라고 말해 놓고 다른 데서 답을 가져온다. 실제로 그렇게 만들었다가 확인 도중
   * 연결이 돌아오는 순간 「등록되지 않은 사번입니다」가 뜨는 것을 잡았다.
   */
  const lookup = useWorkerLookup(
    submitted !== null && !submitted.offline ? submitted.workerNo : null,
  );

  const lookupData = lookup.data;

  /**
   * 확인 결과를 화면 상태로 옮긴다.
   *
   * ⛔ **렌더 중에 옮기지 않는다.** 조회 결과를 렌더 흐름에서 바로 상태로 넣으면 거부 결과가
   * 매 렌더마다 다시 들어가 렌더가 멈추지 않는다 — 실제로 그렇게 만들었다가 잡았다.
   *
   * ⛔ **미등록과 비재직을 가른다**(§6) — 문구도 사용자가 할 일도 다르다. 미등록 문구에는
   * **입력값을 담는다**: 오타를 눈으로 확인할 수 있어야 한다.
   */
  const settle = useCallback(
    (typed: string, found: WorkerResponse | undefined) => {
      const result = verifyWorker(found, homePlantId);

      setSubmitted(null);

      if (result.kind === 'unknown') {
        setError(t.error.unknown(typed.trim()));
        return;
      }

      if (result.kind === 'inactive') {
        setError(t.error.inactive);
        return;
      }

      setError(null);
      setWorkerSession({
        worker: result.worker,
        /*
         * 지정 시각은 지금이다 — 화면이 그 순간을 남긴다.
         *
         * ⛔ **현지 시간으로 낸다.** `toISOString()` 은 세계 표준시라 한국에서 오전 9시에
         * 지정해도 「00:00」으로 보인다 — 「언제부터 이 사람으로 기록되는가」를 알리는 칸이
         * 아홉 시간 어긋난 값을 말하게 된다. 베트남 공장이면 일곱 시간이다.
         */
        assignedAt: formatAssignedAt(new Date()),
        isOtherPlant: result.isOtherPlant,
      });
      setWorkerNo('');
    },
    [homePlantId],
  );

  useEffect(() => {
    if (submitted === null || submitted.offline || lookupData === undefined) return;

    settle(submitted.workerNo, pickExact(lookupData, submitted.workerNo));
  }, [submitted, lookupData, settle]);

  /**
   * 오프라인 확인 — **미리 받아 둔 목록으로 본다**(§5-6). ⛔ 막지 않는다: POP은 오프라인
   * 내성이 요구되고, 재직 여부는 판정이 아니라 표시라 캐시해도 C-6에 걸리지 않는다.
   *
   * ⛔ **목록을 한 번도 받지 못했으면 통과시키지 않는다**(§6 · C-11). 확인할 근거가 없는데
   * 통과시키면 아무 사번으로나 남의 이름이 기록에 붙는다.
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

      settle(submitted.workerNo, pickExact(cached, submitted.workerNo));
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
    <div className="pop-screen">
      {/*
       * ⛔ **머리글·이동 경로를 두지 않는다.** 스펙 §3/E-1 의 세로 예산은 헤더 64 + 본문 704
       * = 768 이고 「슬랙이 0」이라, 도면에 없는 줄을 얹을 자리가 없다. 관리웹 화면의 전례를
       * 따르지 않는 자리다.
       *
       * ⭐ **그래서 이 라우트는 관리웹 셸 밖에 선다**(`routes/pop.tsx`의 `popRoutes`). 셸 안에 두면
       * 상단 바와 본문 여백이 768 «위에» 얹혀 단말에서 본문 아래가 잘린다 — 스펙 §1 이
       * 이 화면의 IA 위치를 「POP > 진입」으로 둔 것과도 어긋난다.
       */}
      {/*
       * 헤더 — 단말 이름·설치 위치와 연결 상태(§3). ⚠ 단말 조회가 서지 않는 동안에는
       * 이름을 지어내지 않고 없음 표시를 낸다.
       */}
      <section className="pop-terminal-header" aria-label={t.header.label}>
        {/*
         * 왼쪽 끝 — 제품 이름(§3 도면). 현장 단말은 이 화면 하나만 띄운 채 하루를 나므로
         * 「지금 보고 있는 것이 무엇인가」를 말하는 자리가 여기뿐이다.
         */}
        <strong className="pop-terminal-header__brand">{t.header.brand}</strong>

        {/*
         * 가운데 — 단말 코드와 설치 위치. ⚠ **설치 위치는 아직 낼 수 없다**: 단말을 지목할
         * 값을 얻을 경로가 이 저장소에 없어 조회가 서지 않는다. ⛔ 지어내지 않고 없음
         * 표시를 낸다 — 모르는 값과 없는 값을 같은 모양으로 그리지 않는다(G-9).
         */}
        <p className="field-note">
          {t.header.label} {terminal.data?.terminalCode ?? t.header.emptyValue}
        </p>
        {/* ⭐ 오프라인이어도 «막지 않는다»(§6) — 지금 어느 상태인지만 밝힌다. */}
        <Chip variant="status" size="sm" status={isOnline ? 'success' : 'warning'}>
          {isOnline ? t.header.online : t.header.offline}
        </Chip>
      </section>

      <div className="pop-assign">
        <KeypadPanel
          workerNo={workerNo}
          onChange={setWorkerNo}
          onSubmit={() => {
            setError(null);
            /* 누르는 «순간»의 연결 상태를 함께 담는다 — 그 경로로 끝까지 간다. */
            setSubmitted({ workerNo, offline: !isOnline });
          }}
          isChecking={submitted !== null && (submitted.offline || lookup.isFetching)}
          error={error}
          offlineNote={isOnline ? null : t.offline.note}
        />

        <WorkerCard
          worker={session?.worker ?? null}
          assignedAt={session?.assignedAt ?? null}
          isOtherPlant={session?.isOtherPlant ?? false}
          pendingQueue={pendingQueue}
          onShift={() => {
            /*
             * ⛔ **큐의 사번을 바꾸지 않는다**(B-3 이력 불변). 이미 쌓인 기록은 그때 그
             * 사람의 것이다 — 세어서 알리기만 하고 손대지 않는다(§6).
             */
            void readOutboxSize().then(setPendingQueue);

            setWorkerSession(null);
            setWorkerNo('');
          }}
          /*
           * ⚠ **갈 곳이 아직 없다.** 작업 시작 화면이 이 저장소에 서지 않아 이동 대상이
           * 없다 — ⛔ 임의의 화면으로 보내지 않는다. 대상이 서면 이 한 자리를 채운다.
           */
          onGoToWork={() => undefined}
        />
      </div>
    </div>
  );
};
