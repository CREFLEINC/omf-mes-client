import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type FeedbackTone = 'success' | 'warning' | 'error' | 'info';

/**
 * 작업장 콘솔의 **피드백 층** — 소리 · 알림 · 막는 확인창.
 *
 * ⭐ **왜 한 층으로 모으는가.** 지금까지 결과는 화면마다 배너·인라인 문구로만 나왔다. 스캐너를
 *    든 작업자는 화면을 보고 있지 않은 때가 많아, 찍혔는지·막혔는지를 보려면 고개를 돌려야
 *    했다. 상용 단말(HYDRA·Plex)과 ISA-101 이 하는 대로 **결과마다 다른 소리**를 내고, 작업을
 *    막는 일은 **확인을 눌러야 닫히는 창**으로 세운다.
 *
 * ⛔ **막는 창을 남발하지 않는다.** 확인을 자주 누르게 하면 작업자가 읽지 않고 누르는 것을
 *    배운다 — 그 창은 «이대로 두면 잘못 기록되는» 일에만 쓴다. 성공·경고는 소리와 알림이다.
 *
 * ⚠ **공급자 밖에서는 아무 일도 하지 않는다.** 콘솔로 옮기지 않은 화면과 화면 단위 시험은
 *   공급자 없이 그려진다 — 그때 화면이 깨지지 않고 지금처럼 자기 배너만 보인다.
 */
export interface PopFeedback {
  /** 소리만 낸다 — 화면이 이미 결과를 제자리에 보이고 있을 때. */
  cue: (tone: FeedbackTone) => void;
  /** 소리 + 잠깐 떴다 사라지는 알림. */
  notify: (tone: FeedbackTone, text: string) => void;
  /**
   * 소리 + 확인을 눌러야 닫히는 창. 제목은 짧게, 본문은 **무엇이 문제인가와 어떻게 하면 되는가**를
   * 함께 쓴다(공유계약 G-3). 제목을 비우면 「확인이 필요합니다」가 선다.
   */
  block: (detail: string, title?: string) => void;
}

const NOOP: PopFeedback = {
  cue: () => undefined,
  notify: () => undefined,
  block: () => undefined,
};

const FeedbackContext = createContext<PopFeedback>(NOOP);

export const usePopFeedback = (): PopFeedback => useContext(FeedbackContext);

/**
 * 결과별 소리 — **높낮이와 횟수로 가른다.** 성공은 짧고 높게 한 번, 경고는 두 번, 오류는 낮고
 * 길게. 소음 속에서 색을 못 봐도 귀로 가를 수 있어야 한다.
 */
const TONES: Record<FeedbackTone, readonly { hz: number; ms: number }[]> = {
  success: [{ hz: 1320, ms: 70 }],
  info: [{ hz: 990, ms: 70 }],
  warning: [
    { hz: 660, ms: 90 },
    { hz: 660, ms: 90 },
  ],
  error: [{ hz: 220, ms: 360 }],
};

/** 알림이 떠 있는 시간. 오류는 더 오래 둔다 — 한눈에 못 봤을 수 있다. */
const NOTICE_MS: Record<FeedbackTone, number> = {
  success: 2_500,
  info: 3_000,
  warning: 4_000,
  error: 6_000,
};

/**
 * ⚠ **소리를 못 내도 던지지 않는다.** 스피커가 없는 단말·시험 환경(jsdom)에는 `AudioContext` 가
 *   없다 — 소리는 덧붙이는 신호이지 기록의 조건이 아니다.
 */
const playTone = (context: AudioContext | null, tone: FeedbackTone): void => {
  if (context === null) return;

  try {
    /*
     * ⚠ 브라우저는 사람이 한 번 누르기 전까지 소리를 잠가 둔다(자동 재생 정책). 첫 소리는 그
     *   잠금을 푸는 김에 나지 않을 수 있다 — 스캔·터치 뒤부터는 난다.
     */
    if (context.state === 'suspended') void context.resume();

    let at = context.currentTime;

    for (const beep of TONES[tone]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.frequency.value = beep.hz;
      gain.gain.value = 0.15;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + beep.ms / 1000);
      at += (beep.ms + 60) / 1000;
    }
  } catch {
    /* 소리는 덧붙이는 신호다 — 실패해도 흐름을 막지 않는다. */
  }
};

interface Notice {
  id: number;
  tone: FeedbackTone;
  text: string;
}

interface Blocking {
  title: string;
  detail: string;
}

export const PopFeedbackProvider = ({ children }: { children: ReactNode }) => {
  const t = messages.popChrome.console.feedback;
  const audio = useRef<AudioContext | null>(null);
  const nextId = useRef(1);
  const [notices, setNotices] = useState<readonly Notice[]>([]);
  const [blocking, setBlocking] = useState<Blocking | null>(null);

  useEffect(() => {
    const Context = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;

    if (Context === undefined) return;

    try {
      audio.current = new Context();
    } catch {
      audio.current = null;
    }

    return () => {
      void audio.current?.close();
      audio.current = null;
    };
  }, []);

  const cue = useCallback((tone: FeedbackTone) => {
    playTone(audio.current, tone);
  }, []);

  const notify = useCallback((tone: FeedbackTone, text: string) => {
    const id = nextId.current;

    nextId.current += 1;
    playTone(audio.current, tone);
    /* 세 개까지만 쌓는다 — 연달아 찍으면 알림이 화면을 덮는다. */
    setNotices((previous) => [...previous.slice(-2), { id, tone, text }]);
    window.setTimeout(() => {
      setNotices((previous) => previous.filter((notice) => notice.id !== id));
    }, NOTICE_MS[tone]);
  }, []);

  const block = useCallback(
    (detail: string, title?: string) => {
      playTone(audio.current, 'error');
      setBlocking({ title: title ?? t.blockedTitle, detail });
    },
    [t.blockedTitle],
  );

  const value = useMemo(() => ({ cue, notify, block }), [cue, notify, block]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="pop-console-notices" role="status" aria-live="polite" aria-label={t.region}>
        {notices.map((notice) => (
          <p key={notice.id} className="pop-console-notice" data-tone={notice.tone}>
            {notice.text}
          </p>
        ))}
      </div>

      {blocking !== null && (
        <Dialog
          open
          size="sm"
          onClose={() => {
            setBlocking(null);
          }}
          /* ⛔ 스치는 손에 닫히지 않는다 — 읽고 확인을 눌러야 닫힌다(ISA-101 의 경보 확인). */
          closeOnBackdropClick={false}
          showCloseButton={false}
          title={blocking.title}
          footer={
            <Button
              onClick={() => {
                setBlocking(null);
              }}
            >
              {t.acknowledge}
            </Button>
          }
        >
          <p className="pop-console-block-detail">{blocking.detail}</p>
        </Dialog>
      )}
    </FeedbackContext.Provider>
  );
};
