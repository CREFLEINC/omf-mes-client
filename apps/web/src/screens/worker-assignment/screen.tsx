import { Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { useIsOnline } from './connection';
import { KeypadPanel } from './keypad-panel';
import { readOutboxSize, readWorkerDirectory, writeWorkerDirectory } from './pop-bridge';
import { useTerminal, useWorkerDirectory, useWorkerLookup } from './queries';
import { pickExact, verifyWorker, type WorkerResponse } from './verify';
import { WorkerCard } from './worker-card';
import { PopDevScreenNav } from '../../patterns/pop-dev-screen-nav';
import { usePopIdentity } from '../../patterns/pop-identity';
import { usePopRegistration } from '../../patterns/pop-registration';
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
  const navigate = useNavigate();
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
   * ⭐ **등록이 확인해 준 단말 번호**(#999). 예전에는 이 자리가 `null` 로 못 박혀 있었다 —
   * 셸이 식별자를 내주지 않아 단말 조회가 서지 못했고, 헤더는 늘 없음 표시를 냈다. 등록
   * 흐름이 서면서 그 값이 생겼고, 여기 한 자리를 채우는 것으로 헤더·공장 연쇄가 살아난다.
   *
   * ⛔ **주소에서 받지 않는다.** 신원은 서버가 확인해 준 것만 쓴다(공유계약 F-4).
   */
  const { terminalId } = usePopIdentity();
  const { restart } = usePopRegistration();
  const terminal = useTerminal(terminalId);

  const isOnline = useIsOnline();
  const homePlantId = terminal.data?.plantId ?? null;

  /**
   * ⭐ **연결돼 있을 때 목록을 미리 받아 둔다**(§5-6 · C-11) — 오프라인에서 사번을 확인할
   * 근거는 이것뿐이다. 받아 두는 것과 쓰는 것이 시점이 다르므로, 받는 즉시 셸 캐시에 넣는다.
   *
   * ⭐ **등록이 서면서 이 연쇄가 살아났다**(#999). 「해당 공장」은 단말이 알려주는 값인데
   * 그 단말 번호가 없어 예전에는 한 번도 돌지 않았고, 오프라인 사번 확인이 언제나 「목록을
   * 아직 받지 못했습니다」로 떨어졌다.
   *
   * ⛔ **공장 없이 전 공장을 받아 두는 것으로 메우지 않는다** — 옆 공장 사번이 이 단말에서
   * 통과한다.
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
    <div className="pop-screen pop-ui">
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
        <Chip variant="status" size="md" status={isOnline ? 'success' : 'warning'}>
          {isOnline ? t.header.online : t.header.offline}
        </Chip>

        {/*
         * 재등록 — **설치 담당자용**이라 작업자 단추들과 성격이 다르다(사용자 지시
         * 2026-09-12). 구획 바닥의 [교대]·[작업 시작] 과 한 줄에 세워 두었더니 작업자가
         * 늘 쓰는 두 단추 옆에 하루 한 번 쓸까 말까 한 것이 같은 크기로 붙어 있었다 —
         * [사용자 전환]·[화면 이동] 과 같은 **머리줄의 보조 조작**으로 옮긴다.
         *
         * ⭐ **재등록으로 들어가는 유일한 길**(P-CO-01 §5-1 · 공유계약 F-4). 등록을 마치면
         *    게이트가 업무 화면을 내주므로, 이 단추가 없으면 잘못된 단말로 등록된 현장
         *    단말을 **자격증명 저장소를 사람이 지우지 않고는** 되돌릴 수 없다.
         *
         * ⛔ 큐가 남은 채 다른 단말로 바꾸는 것은 적용 단계가 막는다 — 여기서 막지 않는다.
         *    여기서 막으면 「같은 단말 재등록」까지 함께 잠긴다.
         *
         * ⛔ 사번이 없어도 눌릴 수 있어야 한다 — 잘못된 단말로 등록되면 사번부터 막히는데,
         *    그 상태에서 되돌릴 길이 없으면 단말이 잠긴다.
         */}
        <Button
          type="button"
          /* ⚠ [사용자 전환]과 «같은» 변형·크기다 — 생김새를 한 벌로 두기로 했다. */
          variant="filled"
          size="md"
          className="pop-terminal-header__reregister"
          onClick={restart}
        >
          {messages.workerAssignment.registration.reRegister}
        </Button>
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
           * 제품 동작은 작업 시작 화면(P-02-01)으로 이어진다(§5-8). 현재 작업자 귀속은
           * 화면 밖 `worker-session`에 있으므로 이동 뒤에도 그대로 유지된다.
           */
          onGoToWork={() => {
            void navigate('/pop/work-start');
          }}
          /*
           * ⚠ **개발 서버에서만** 그 자리에 화면 이동 셀렉터를 세운다 — 버튼이 아직
           * 가리키는 제품 경로 외의 POP 화면도 손으로 확인할 경로가 단말 셸에 없기 때문이다
           * (주소창이 없다). 제품 모드에서는 위 이동 버튼이 그대로 선다.
           *
           * ⛔ **`DEV`가 아니라 `MODE`로 가른다.** `DEV`는 시험 실행에서도 참이라, 개발용
           * 대체물이 이 화면의 제품 시험 안으로 들어와 「이동 버튼이 있다」는 §5-8 단언을
           * 무너뜨린다(실측 — 3건이 깨졌다). 시험은 제품 동작을 봐야 한다.
           *
           * ⛔ **조건을 런타임 값으로 바꾸지 않는다.** `MODE`는 빌드 시점에 상수로 치환되어
           * 배포 번들에서 이 가지째 걷힌다(실측). 런타임 조회로 바꾸면 걷히지 않고 현장
           * 단말에 개발용 조작이 남는다.
           */
          devScreenNav={
            import.meta.env.MODE === 'development' ? (
              <PopDevScreenNav disabled={session === null} />
            ) : undefined
          }
        />
      </div>
    </div>
  );
};
