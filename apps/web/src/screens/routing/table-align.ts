import type { Column } from '@crefle/web-ui';

/** 이 화면의 표는 모든 열을 가운데로 맞춘다(사용자 지시 · #231) — 열마다 적던 정렬(숫자 끝 맞춤 등)을 덮는다. */
export const centerColumns = <T>(columns: Column<T>[]): Column<T>[] =>
  columns.map((column) => ({ ...column, align: 'center' as const }));
