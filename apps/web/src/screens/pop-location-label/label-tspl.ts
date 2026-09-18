import { canDrawGlyph, rasterizeTextWithFont } from '../../patterns/label/text';
import {
  buildLotLabel,
  buildLotLabelBytes,
  type LotLabelRasterizer,
  type LotLabelRow,
} from '../pop-material-lot-label/label-tspl';

/**
 * 창고 적재 위치 라벨 — **POP 이 80 × 30 mm 규격으로 직접 짠다**(사용자 지시 2026-09-18 · #1344).
 *
 * ⭐ **왜 서버가 그린 것을 쓰지 않는가.** 서버 렌디션은 100 × 60 mm 좌표라, 현장 프린터에 걸린
 *   80 × 30 mm 라벨지에 맞지 않았다(실기 2026-09-18 · 사용자 확인). 자재·생산 LOT 라벨이 같은
 *   이유로 먼저 옮겨 간 자리다.
 *
 * ⛔ **여백·QR 자리·글줄 칸을 여기서 다시 정하지 않는다.** 전부 `buildLotLabel` 이 가진다 —
 *    HT800 실기에서 맞춘 값이라 베껴 두면 다음에 한쪽만 고쳐져 갈라진다.
 *
 * ⛔ **QR 에는 위치 코드만 싣는다.** 모바일 적치·이동 화면이 스캔 값을 그대로 위치 코드 조회에
 *    넣는다 — 창고를 덧붙이면 조회가 0건이 된다(서버 판과 같은 규칙).
 *
 * ⭐ **ASCII 밖 글자가 든 줄은 그림(`BITMAP`)으로 찍는다**(사용자 지시 2026-09-18 ·
 *   omf-all-around#9 — 「기존 라벨대로, 본문 내용만 보충」). 위치명이 `A구역 01열 01단` 처럼 한글이면
 *   내장 글꼴이 못 찍어 `A?? 01? 01?` 로 나왔다. 그 줄만 POP(Chromium)의 OS 한글 글꼴로 그려
 *   같은 자리에 넣는다 — 배치·QR·ASCII 줄은 그대로다.
 *   ⚠ 이것은 결정 17(`docs/decisions.md` · 못 그리는 글자는 `?`)의 **위치 라벨 예외**다. 자재·생산
 *     LOT 라벨은 결정 17 그대로다.
 *   ⚠ 한글 글꼴이 없는 단말이면 그림을 만들지 않고 결정 17 대로 `?` 로 찍는다(아래 `canDrawHangul`).
 */
export interface LocationLabelFields {
  warehouseCode: string;
  locationCode: string;
  locationName: string;
  /** 발행 회차. */
  issueSeq: number;
}

/**
 * 위치 라벨 한 장.
 *
 * ```
 * WH WH-01                      ┌────┐
 * S230-01                       │ QR │
 * RACK A LEVEL 1                │    │
 * ISSUE NO. 1                   └────┘
 * ```
 */
const locationRows = (fields: LocationLabelFields): LotLabelRow[] => [
  { point: 8, content: `WH ${fields.warehouseCode}` },
  /* 현장이 선반 앞에서 읽는 줄이라 가장 크게 찍는다. */
  { point: 16, content: fields.locationCode },
  { point: 8, content: fields.locationName },
  { point: 8, content: `ISSUE NO. ${String(fields.issueSeq)}` },
];

export const buildLocationLabel = (fields: LocationLabelFields): string =>
  buildLotLabel(locationRows(fields), fields.locationCode);

/**
 * 한글 줄을 그릴 글꼴 목록 — 설치본(Windows)의 기본 한글 글꼴을 먼저 부른다.
 *
 * ⭐ 글꼴 파일을 싣지 않는다(통합 담당 승인 2026-09-18) — 맑은 고딕은 Windows 기본 글꼴이다.
 *    맥·리눅스 개발 단말은 뒤의 이름으로 잡힌다. 베트남어 같은 라틴 확장 글자도 이 글꼴들이 그린다.
 */
const HANGUL_FONT_FAMILY =
  '"Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", sans-serif';

/** 이 단말이 한글을 진짜 글자로 그리는가 — 글꼴이 없으면 네모가 그려진다(`canDrawGlyph`). */
const canDrawHangul = (): boolean => canDrawGlyph('가', HANGUL_FONT_FAMILY);

const rasterizeHangul: LotLabelRasterizer = (text, fontPx) =>
  rasterizeTextWithFont(text, fontPx, HANGUL_FONT_FAMILY);

/**
 * 인쇄할 바이트 — ASCII 만 있으면 `buildLocationLabel` 과 바이트까지 같다.
 *
 * `rasterize` 는 시험이 손으로 만든 점판을 넣는 자리다. 생략하면 이 단말의 Canvas·한글 글꼴을
 * 쓰고, 한글을 못 그리는 단말이면 켜지 않는다(결정 17 대로 `?`).
 */
export const buildLocationLabelBytes = (
  fields: LocationLabelFields,
  rasterize: LotLabelRasterizer | undefined = canDrawHangul() ? rasterizeHangul : undefined,
): Uint8Array =>
  buildLotLabelBytes(locationRows(fields), fields.locationCode, { rasterizeNonAscii: rasterize });
