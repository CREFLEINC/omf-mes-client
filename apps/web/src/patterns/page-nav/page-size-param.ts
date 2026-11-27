import { useCallback } from 'react';
import { createSearchParams, useSearchParams, type SetURLSearchParams } from 'react-router';

import { PAGE_SIZES } from './page-nav';

/**
 * 목록 쪽 크기 고르기 — 품질 화면(IQC 등)과 같은 규칙(#360).
 * 주소 질의 이름은 `size`, 그 화면의 종전 쪽 크기(기본)는 주소에 적지 않고 서버에도 종전대로 보낸다.
 * 쪽 크기를 바꾸면 첫 쪽으로 간다(주소의 `page` 를 지운다).
 */
export const PAGE_SIZE_KEY = 'size';

/** 고를 쪽 크기 — 10 · 20 · 50 에 그 화면의 기본값을 더해 작은 순으로. */
export const pageSizesWith = (fallback: number): readonly number[] =>
  [...new Set<number>([...PAGE_SIZES, fallback])].sort((a, b) => a - b);

/** 주소의 쪽 크기. 고를 수 있는 값이 아니면 기본으로 읽는다. */
export const readPageSizeParam = (params: URLSearchParams, fallback: number): number => {
  const raw = Number(params.get(PAGE_SIZE_KEY));
  return pageSizesWith(fallback).includes(raw) ? raw : fallback;
};

/** 쪽 크기를 주소에 적는다 — 첫 쪽으로 간다. 기본은 적지 않는다. 다른 질의는 그대로다. */
export const toPageSizeSearchParams = (
  params: URLSearchParams,
  size: number,
  fallback: number,
  pageKey = 'page',
): URLSearchParams => {
  const next = new URLSearchParams(params);
  next.delete(pageKey);
  if (size === fallback) next.delete(PAGE_SIZE_KEY);
  else next.set(PAGE_SIZE_KEY, String(size));
  return next;
};

/**
 * 조건 · 쪽으로 새로 지은 주소에 지금 쪽 크기를 이어 붙인다 — 조건을 바꿔도 고른 쪽 크기가 남는다(품질 화면과 같다).
 * 기본은 적지 않는다.
 */
export const withPageSizeParam = (
  params: URLSearchParams,
  size: number,
  fallback: number,
): URLSearchParams => {
  const next = new URLSearchParams(params);
  if (size === fallback) next.delete(PAGE_SIZE_KEY);
  else next.set(PAGE_SIZE_KEY, String(size));
  return next;
};

/**
 * `useSearchParams` 에 쪽 크기를 더한 것 — 화면이 주소를 어떻게 새로 짓든(조건 · 쪽 · 고르기) 고른 쪽 크기가 남고,
 * `changePageSize` 는 첫 쪽으로 가며 쪽 크기를 바꾼다. 기본(`fallback` — 그 화면의 종전 쪽 크기)은 주소에 적지 않는다.
 */
export const usePageSizeSearchParams = (fallback: number) => {
  const [searchParams, setRaw] = useSearchParams();
  const pageSize = readPageSizeParam(searchParams, fallback);

  const setSearchParams = useCallback<SetURLSearchParams>(
    (next, options) => {
      setRaw(
        (prev) =>
          withPageSizeParam(
            createSearchParams(typeof next === 'function' ? next(prev) : next),
            pageSize,
            fallback,
          ),
        options,
      );
    },
    [setRaw, pageSize, fallback],
  );

  const changePageSize = useCallback(
    (size: number, pageKey = 'page'): void => {
      setRaw((prev) => toPageSizeSearchParams(prev, size, fallback, pageKey));
    },
    [setRaw, fallback],
  );

  return {
    searchParams,
    setSearchParams,
    pageSize,
    changePageSize,
    pageSizes: pageSizesWith(fallback),
  };
};
