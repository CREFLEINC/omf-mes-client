/**
 * 라벨지(용지) 설정 — **명령이 아니라 «단말에 걸린 것»이 정한다.**
 *
 * ⭐ **왜 셸이 손대는가.** 결정 18 은 「출력물은 서버가 그린다」이고 그 원칙은 그대로다 —
 * 여기서 바꾸는 것은 **그림이 아니라 용지 설정**이다. 대지 크기·갭 종류는 그 단말에 무엇이
 * 걸려 있느냐의 문제라 서버가 알 수 없고, 어긋나면 프린터가 **라벨을 찾다가 멈춘다**
 * (실기 실측 2026-09-08 — 「인쇄가 나오다가 멈춘다」).
 *
 * ⛔ **글자·좌표·바코드는 건드리지 않는다.** 바꾸는 줄은 대지·갭·기준점·속도·농도뿐이다.
 *
 * ## 왜 「나오다가 멈추는가」
 *
 * TSPL 은 `SIZE` 로 한 장의 크기를, `GAP`/`BLINE` 으로 **장과 장을 가르는 표시**를 받는다.
 * 걸린 라벨지가 그 선언과 다르면 프린터는 다음 장의 경계를 못 찾아 **용지를 계속 밀다가**
 * 오류로 선다. 종이는 나오는데 인쇄는 안 되는 모습이 이것이다.
 *
 * ## 무엇으로 정하는가
 *
 * 환경 변수로 받는다. 앱을 켜기 전에 준다 — 단말마다 다르고, 바꾼다고 앱을 다시 굽지 않는다.
 *
 * | 변수 | 뜻 | 기본 |
 * | --- | --- | --- |
 * | `POP_LABEL_WIDTH_MM` · `POP_LABEL_HEIGHT_MM` | 한 장의 크기 | 100 × 60 |
 * | `POP_LABEL_MEDIA` | `gap`(라벨지) · `bline`(검은 표시) · `continuous`(연속지) | `gap` |
 * | `POP_LABEL_GAP_MM` | 장 사이 간격(또는 검은 표시 높이) | 2 |
 * | `POP_LABEL_OFFSET_MM` | 경계 보정 | 0 |
 * | `POP_LABEL_SPEED` · `POP_LABEL_DENSITY` | 속도 · 농도 | 4 · 8 |
 */

const numberFromEnv = (key: string, fallback: number): number => {
  const raw = process.env[key];

  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);

  /* ⛔ 못 읽은 값으로 프린터를 설정하지 않는다 — 그 자리가 곧 「멈춤」이 된다. */
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export type MediaKind = 'gap' | 'bline' | 'continuous';

const mediaKind = (): MediaKind => {
  const raw = (process.env.POP_LABEL_MEDIA ?? 'gap').trim().toLowerCase();

  return raw === 'bline' || raw === 'continuous' ? raw : 'gap';
};

export interface LabelMedia {
  widthMm: number;
  heightMm: number;
  kind: MediaKind;
  gapMm: number;
  offsetMm: number;
  speed: number;
  density: number;
}

export const readLabelMedia = (): LabelMedia => ({
  widthMm: numberFromEnv('POP_LABEL_WIDTH_MM', 100),
  heightMm: numberFromEnv('POP_LABEL_HEIGHT_MM', 60),
  kind: mediaKind(),
  gapMm: numberFromEnv('POP_LABEL_GAP_MM', 2),
  offsetMm: numberFromEnv('POP_LABEL_OFFSET_MM', 0),
  speed: numberFromEnv('POP_LABEL_SPEED', 4),
  density: numberFromEnv('POP_LABEL_DENSITY', 8),
});

/** 장을 가르는 표시. 연속지는 「가를 것이 없다」이므로 0 으로 적는다. */
const separator = (media: LabelMedia): string => {
  if (media.kind === 'bline') return `BLINE ${String(media.gapMm)} mm,${String(media.offsetMm)} mm`;
  if (media.kind === 'continuous') return 'GAP 0 mm,0 mm';

  return `GAP ${String(media.gapMm)} mm,${String(media.offsetMm)} mm`;
};

/**
 * 단말 설정으로 **머리말을 갈아 끼운다.**
 *
 * 서버(또는 진단 견본)가 보낸 명령에서 대지·갭·기준점·속도·농도 줄을 걷어내고, 이 단말의
 * 것으로 다시 얹는다. 나머지 줄(글자·바코드)은 순서 그대로 둔다.
 *
 * ⚠ **`CLS` 앞에 얹는다.** TSPL 은 `CLS` 에서 그리기 버퍼를 비우므로, 설정은 그 «전»에 서야
 *   그 장에 적용된다.
 */
export const applyLabelMedia = (commands: string, media: LabelMedia): string => {
  const lines = commands.split(/\r?\n/);

  const body = lines.filter((line) => {
    const head = line.trim().toUpperCase();

    return !(
      head.startsWith('SIZE ') ||
      head.startsWith('GAP ') ||
      head.startsWith('BLINE ') ||
      head.startsWith('REFERENCE ') ||
      head.startsWith('SPEED ') ||
      head.startsWith('DENSITY ') ||
      head.startsWith('DIRECTION ')
    );
  });

  const header = [
    `SIZE ${String(media.widthMm)} mm,${String(media.heightMm)} mm`,
    separator(media),
    `SPEED ${String(media.speed)}`,
    `DENSITY ${String(media.density)}`,
    'DIRECTION 1',
    /* 원점을 못 박는다 — 이전 작업이 남긴 기준점이 그대로 살아 첫 장이 밀려 찍힌 적이 있다. */
    'REFERENCE 0,0',
  ];

  return [...header, ...body].join('\r\n');
};

/**
 * 걸린 라벨지를 **프린터가 스스로 재게** 한다(TSPL2 `GAPDETECT`).
 *
 * ⭐ 「나오다가 멈춘다」가 설정이 아니라 **보정이 안 된 것**일 때 이것이 답이다 — 프린터가
 * 라벨 한두 장을 밀어 보며 경계를 재고 그 값을 기억한다. 라벨지를 갈아 끼운 뒤 한 번 돌린다.
 */
export const calibrationCommands = (media: LabelMedia): string =>
  [
    `SIZE ${String(media.widthMm)} mm,${String(media.heightMm)} mm`,
    separator(media),
    'GAPDETECT',
    '',
  ].join('\r\n');

/**
 * **Windows 드라이버에 설정된 용지 크기**를 읽는 스크립트.
 *
 * ⭐ **사람이 값을 적어 주지 않아도 되게 한다**(사용자 지시 2026-09-08). 라벨지는 단말마다
 * 다르고 현장에서 갈아 끼운다 — 그때마다 환경 변수를 고치게 하면 결국 아무도 안 고친다.
 * 프린터 설정에 이미 들어 있는 값을 그대로 쓰는 것이 맞다.
 *
 * ⚠ **`.NET` 이 1/100 인치로 준다.** `PaperSize.Width/Height` 의 단위가 그것이라 mm 로 옮긴다
 *   (1/100 in = 0.254 mm).
 *
 * ⛔ **못 읽으면 조용히 0 을 쓰지 않는다** — 부르는 쪽이 «못 읽었다»로 받아 설정값이나
 *    기본값으로 물러선다. 0 짜리 대지를 보내면 프린터가 그 자리에서 선다.
 */
export const buildMediaProbeScript = (deviceName?: string): string =>
  [
    '$ErrorActionPreference = "Stop"',
    'try {',
    '  Add-Type -AssemblyName System.Drawing',
    '  $s = New-Object System.Drawing.Printing.PrinterSettings',
    deviceName === undefined
      ? '  # 이름을 주지 않으면 OS 기본 프린터의 설정을 본다'
      : `  $s.PrinterName = ${JSON.stringify(deviceName)}`,
    '  $p = $s.DefaultPageSettings.PaperSize',
    '  Write-Output ("{0} {1}" -f $p.Width, $p.Height)',
    '} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }',
  ].join('\n');

/** 1/100 인치를 mm 로. 소수점 한 자리까지 — 프린터가 그 이상 가리지 못한다. */
const toMillimetres = (hundredthsOfInch: number): number =>
  Math.round(hundredthsOfInch * 0.254 * 10) / 10;

/**
 * 스크립트가 뱉은 줄에서 용지 크기를 읽는다. **읽을 수 없으면 `null`** 이다.
 *
 * ⚠ 프린터가 「Letter」 같은 문서 용지로 설정돼 있으면 라벨보다 훨씬 큰 값이 온다 — 그것도
 *   그 단말의 «설정»이므로 그대로 쓴다. 틀렸다면 고칠 자리는 프린터 설정이지 이 코드가 아니다.
 */
export const parseMediaProbe = (output: string): { widthMm: number; heightMm: number } | null => {
  const matched = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/u.exec(output.trim());

  if (matched === null) return null;

  const widthMm = toMillimetres(Number(matched[1]));
  const heightMm = toMillimetres(Number(matched[2]));

  return widthMm > 0 && heightMm > 0 ? { widthMm, heightMm } : null;
};

/**
 * 드라이버에서 읽은 크기를 설정 위에 얹는다.
 *
 * ⛔ **사람이 준 값이 먼저다.** 환경 변수를 준 것은 「드라이버 설정을 믿지 못하겠다」는 뜻이라
 *    그쪽을 덮지 않는다.
 */
export const withProbedSize = (
  media: LabelMedia,
  probed: { widthMm: number; heightMm: number } | null,
): LabelMedia => {
  if (probed === null) return media;

  const pinned =
    process.env.POP_LABEL_WIDTH_MM !== undefined || process.env.POP_LABEL_HEIGHT_MM !== undefined;

  return pinned ? media : { ...media, ...probed };
};
