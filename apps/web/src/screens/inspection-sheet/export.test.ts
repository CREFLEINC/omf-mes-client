import type { InspectionSheet } from '@omf-mes/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSheetXlsx, downloadSheetXlsx } from './export';

/* 양식 채우기는 따로 시험한다(xlsx-form.test) — 여기서는 저장 창 · 내려받기 길만 본다. */
vi.mock('./xlsx-form', () => ({ fillSheetWorkbook: vi.fn(async () => new ArrayBuffer(4)) }));

const sheet = { serialNo: 'SN-0001', formLayoutCode: 'OP' } as InspectionSheet;
const picker = window as unknown as { showSaveFilePicker?: unknown };

describe('제품 검사표 엑셀 다운로드', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ArrayBuffer(8))),
    );
  });
  afterEach(() => {
    delete picker.showSaveFilePicker;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('저장 창이 있으면 고른 곳에 쓴다', async () => {
    const write = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const show = vi.fn(async () => ({ createWritable: async () => ({ write, close }) }));
    picker.showSaveFilePicker = show;

    await downloadSheetXlsx(sheet);

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: expect.stringContaining('SN-0001') }),
    );
    expect(write).toHaveBeenCalledWith(expect.any(Blob));
    expect(close).toHaveBeenCalled();
  });

  it('저장 창에서 취소하면(AbortError) 아무것도 하지 않고 끝낸다', async () => {
    picker.showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('cancel', 'AbortError');
    });

    await expect(downloadSheetXlsx(sheet)).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('저장 창이 없으면 문서에 붙인 링크로 받고, 주소는 뒤에 푼다', async () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let attached = false;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      attached = this.isConnected;
    });

    await downloadSheetXlsx(sheet);

    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(attached).toBe(true);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:x');
    vi.useRealTimers();
  });

  it('양식 파일을 못 받으면 실패로 알린다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    );

    await expect(buildSheetXlsx(sheet)).rejects.toThrow('template 404');
  });
});
