const FREQUENCY_HZ = 220;
const DURATION_SEC = 0.18;
const GAIN = 0.2;

type AudioContextCtor = typeof AudioContext;

const resolveAudioContext = (): AudioContextCtor | undefined =>
  (window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor })
    .AudioContext ??
  (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;

/**
 * 스캔 오류를 소리로 알린다(공유계약 D-2). 장갑을 낀 채 단말을 허리에 매달고 읽는
 * 작업이라 화면을 보고 있지 않을 수 있다.
 *
 * 소리를 낼 수 없는 환경에서도 던지지 않는다 — 인라인 오류가 이미 나가 있으므로
 * 여기서 예외가 오르면 보이는 경고까지 함께 끊긴다.
 */
export const playErrorTone = (): void => {
  const Ctor = resolveAudioContext();

  if (Ctor === undefined) {
    return;
  }

  try {
    const context = new Ctor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = FREQUENCY_HZ;
    gain.gain.value = GAIN;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + DURATION_SEC);
    oscillator.onended = () => {
      void context.close();
    };
  } catch {
    return;
  }
};
