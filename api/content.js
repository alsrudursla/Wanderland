/**
 * api/content.js
 * 콘텐츠 조회 API
 * - content/info.json → 앱 안내 내용
 * - content/devnotes/*.json → 개발자 노트 (버전 내림차순)
 *
 * GET /api/content?type=info
 * GET /api/content?type=devnotes
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ─────────────────────────────────────────────
// ContentReader: content/ 폴더에서 JSON 파일 읽기
// ─────────────────────────────────────────────
class ContentReader {
  constructor() {
    // Vercel 서버리스 함수는 프로젝트 루트에서 실행됨
    this.basePath = join(process.cwd(), 'content');
  }

  // 앱 안내 (info.json)
  readInfo() {
    const raw = readFileSync(join(this.basePath, 'info.json'), 'utf-8');
    return JSON.parse(raw);
  }

  // 개발자 노트 (devnotes/*.json) - 버전 내림차순 정렬
  readDevNotes() {
    const dir   = join(this.basePath, 'devnotes');
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));

    const notes = files.map(file => {
      const raw = readFileSync(join(dir, file), 'utf-8');
      return JSON.parse(raw);
    });

    // v0.3 → v0.2 → v0.1 순서로 정렬 (최신이 위)
    return notes.sort((a, b) => b.version.localeCompare(a.version));
  }
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { type } = req.query;
  const reader   = new ContentReader();

  try {
    if (type === 'info') {
      return res.status(200).json(reader.readInfo());
    }

    if (type === 'devnotes') {
      return res.status(200).json(reader.readDevNotes());
    }

    return res.status(400).json({ error: 'type 파라미터가 필요해요 (info | devnotes)' });
  } catch (e) {
    return res.status(500).json({ error: '콘텐츠를 읽지 못했어요', detail: e.message });
  }
}