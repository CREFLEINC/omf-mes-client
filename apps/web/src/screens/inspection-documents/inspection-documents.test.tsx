import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { AttachmentPanel } from './attachment-panel';
import { LotScan } from './lot-scan';

/** omf-all-around#58 — LOT 스캔으로 검사 대상 열기 · 검사 문서 첨부(서버 선행 P-57). */

const t = messages.inspectionDocuments;

describe('LotScan', () => {
  const stub =
    (requests: unknown[]): StubFetch =>
    async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/trace/lots') {
        return jsonResponse({
          items: [{ lotId: 8801, lotNo: url.searchParams.get('lotNo') }],
          page: { page: 1, size: 5, total: 1 },
        });
      }
      if (url.pathname === '/quality/inspection-requests') {
        expect(url.searchParams.get('lotId')).toBe('8801');
        expect(url.searchParams.get('inspectionTypeCode')).toBe('IQC');
        expect(url.searchParams.get('pendingOnly')).toBe('true');
        return jsonResponse({
          items: requests,
          page: { page: 1, size: 5, total: requests.length },
        });
      }
      throw new Error(`스텁에 없는 요청입니다: ${request.url}`);
    };

  it('스캔한 LOT 의 대기 의뢰를 고른다 — 스캐너의 Enter 로', async () => {
    const onFound = vi.fn();
    renderWithProviders(<LotScan inspectionTypeCode="IQC" onFound={onFound} />, {
      fetch: stub([{ inspectionRequestId: 1001 }]),
    });
    await userEvent.type(screen.getByRole('textbox', { name: t.scan.label }), 'MLOT-8801{Enter}');

    await waitFor(() => expect(onFound).toHaveBeenCalledWith(1001));
  });

  it('대기 의뢰가 없으면 그렇다고 말한다', async () => {
    const onFound = vi.fn();
    renderWithProviders(<LotScan inspectionTypeCode="IQC" onFound={onFound} />, {
      fetch: stub([]),
    });
    await userEvent.type(screen.getByRole('textbox', { name: t.scan.label }), 'MLOT-8801{Enter}');

    expect(await screen.findByText(t.scan.noRequest)).toBeInTheDocument();
    expect(onFound).not.toHaveBeenCalled();
  });
});

describe('AttachmentPanel', () => {
  const renderPanel = () => {
    const posts: Request[] = [];
    const fetch: StubFetch = async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/app/attachments' && request.method === 'GET') {
        expect(url.searchParams.get('targetTypeCode')).toBe('LOT');
        return jsonResponse({
          items: [
            {
              attachmentId: 3,
              targetTypeCode: 'LOT',
              targetId: 8801,
              fileName: '시험성적서.pdf',
              contentType: 'application/pdf',
              byteSize: 2048,
              uploadedAt: '2026-10-16T01:00:00Z',
            },
          ],
        });
      }
      if (url.pathname === '/app/attachments' && request.method === 'POST') {
        posts.push(request.clone());
        return jsonResponse({}, { status: 201 });
      }
      throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
    };
    renderWithProviders(<AttachmentPanel targetTypeCode="LOT" targetId={8801} />, { fetch });
    return { posts };
  };

  it('LOT 의 첨부 문서를 보이고, 문서를 올린다', async () => {
    const { posts } = renderPanel();

    expect(await screen.findByText('시험성적서.pdf')).toBeInTheDocument();
    const file = new File(['%PDF-1.7'], '측정.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText(t.upload), file);

    await waitFor(() => expect(posts).toHaveLength(1));
    /* ⚠ 시험 환경(jsdom File ↔ undici)은 multipart 를 다시 읽지 못한다 — 본문 글자로 대상을 본다. */
    const body = (await posts[0]?.text()) ?? '';
    expect(body).toContain('name="targetTypeCode"');
    expect(body).toContain('LOT');
    expect(body).toContain('8801');
    expect(await screen.findByText(t.uploaded)).toBeInTheDocument();
  });

  it('10MB 를 넘는 파일은 보내지 않고 안내한다', async () => {
    const { posts } = renderPanel();
    await screen.findByText('시험성적서.pdf');
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], '큰스캔.pdf', {
      type: 'application/pdf',
    });
    await userEvent.upload(screen.getByLabelText(t.upload), big);

    expect(await screen.findByText(t.tooLarge)).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });
});
