import { getOpenAI } from '@/lib/openai/client';
import { LLM_MODEL, MAX_TABLES_TO_PROCESS } from '@/config/constants';

type TableSummaryChunk = { content: string; metadata: { chunkIndex: number; startChar: number; endChar: number } };

/**
 * Extract markdown tables and generate natural language summary chunks.
 * Each summary is embedded separately for better semantic search retrieval.
 * Processes tables in parallel batches of 3 for speed.
 */
export async function summarizeTables(
  text: string,
  fileName: string
): Promise<TableSummaryChunk[]> {
  // Match markdown-style tables
  const tableRegex = /(\|[^\n]+\|\n\|[-: |]+\|\n(?:\|[^\n]+\|\n?)+)/g;
  const tables: string[] = [];
  let match;
  while ((match = tableRegex.exec(text)) !== null) {
    tables.push(match[1]);
  }

  if (tables.length === 0) return [];

  // Limit to MAX_TABLES_TO_PROCESS tables
  const tablesToProcess = tables.slice(0, MAX_TABLES_TO_PROCESS);
  const openai = getOpenAI();

  async function summarizeOne(tableContent: string, index: number): Promise<TableSummaryChunk | null> {
    try {
      const response = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          {
            role: 'system',
            content:
              '주어진 표의 모든 행을 한국어 자연어 문장으로 변환하세요. 각 행의 모든 열 데이터(이름, 전화번호, 부서, 직위 등)를 빠짐없이 포함하세요. "OO의 전화번호는 XXX이다" 형태로 작성하세요. 1000토큰 이내로 작성하세요.',
          },
          { role: 'user', content: tableContent },
        ],
        temperature: 0,
        max_tokens: 1000,
      });

      const summary = response.choices[0].message.content?.trim();
      if (summary) {
        return {
          content: `[표 요약 - ${fileName}] ${summary}`,
          metadata: {
            chunkIndex: 9000 + index, // High index to avoid collision
            startChar: 0,
            endChar: 0,
          },
        };
      }
      return null;
    } catch (error) {
      console.error(`[Pipeline] Table summary ${index} failed:`, error);
      return null;
    }
  }

  // Process in parallel batches of 3
  const BATCH_SIZE = 3;
  const summaryChunks: TableSummaryChunk[] = [];

  for (let i = 0; i < tablesToProcess.length; i += BATCH_SIZE) {
    const batch = tablesToProcess.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((table, j) => summarizeOne(table, i + j))
    );
    for (const result of results) {
      if (result) summaryChunks.push(result);
    }
  }

  return summaryChunks;
}
