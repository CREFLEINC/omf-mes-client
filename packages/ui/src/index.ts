// 표현 전용 공용 부품. DS(@crefle/web-ui) 미제공 후보는 여기서 시작한다.
// 구조설계 v0.2 §4.5 참조.
export { QrCode } from './ds-candidates/qr-code';
export type { QrCodeProps } from './ds-candidates/qr-code';
/*
 * 격자를 **화면에 그리지 않고 쓰는 자리**가 생겼다 — POP 이 출고 QR 라벨 이미지를 스스로
 * 만들어 셸에 넘긴다(ISSUE-QR-01 · 설계 결정 8·9 의 2단계). `QrCode` 는 React 부품이라
 * 그 자리에서 쓸 수 없다.
 */
export { encodeQr } from './ds-candidates/qr-encode';
export type { QrMatrix } from './ds-candidates/qr-encode';
export { MarkerOverlay } from './ds-candidates/marker-overlay';
export type { MarkerOverlayProps, OverlayMarker } from './ds-candidates/marker-overlay';
export { NumericKeypad } from './ds-candidates/numeric-keypad';
export type { NumericKeypadProps } from './ds-candidates/numeric-keypad';
