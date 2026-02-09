import { getOpenAI } from '@/lib/openai/client';
import { AI_RESTRUCTURE_MAX_SEGMENT, LLM_MODEL } from '@/config/constants';

/**
 * Restructure raw text into markdown tables using GPT-4o-mini.
 * Used when classifyDocument detects table_heavy but text was extracted without Vision.
 * Processes in segments to handle long documents.
 */
export async function restructureWithAI(text: string): Promise<string> {
  const MAX_SEGMENT = AI_RESTRUCTURE_MAX_SEGMENT;
  if (text.length <= MAX_SEGMENT) {
    return await restructureSegment(text);
  }

  // Split into segments at paragraph boundaries
  const segments: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_SEGMENT) {
      segments.push(remaining);
      break;
    }
    // Find a paragraph break near the limit
    let splitAt = remaining.lastIndexOf('\n\n', MAX_SEGMENT);
    if (splitAt < MAX_SEGMENT * 0.5) {
      splitAt = remaining.lastIndexOf('\n', MAX_SEGMENT);
    }
    if (splitAt < MAX_SEGMENT * 0.5) {
      splitAt = MAX_SEGMENT;
    }
    segments.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trimStart();
  }

  console.log(`[Pipeline] Restructuring ${segments.length} segments with AI`);
  const results: string[] = [];
  for (const segment of segments) {
    results.push(await restructureSegment(segment));
  }
  return results.join('\n\n');
}

async function restructureSegment(text: string): Promise<string> {
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content: `당신은 PDF에서 추출된 텍스트를 정리하는 전문가입니다.
다음 규칙을 따르세요:
1. 테이블 데이터가 있으면 마크다운 테이블 형식으로 변환하세요.
2. 행과 열의 관계를 파악하여 정확하게 구조화하세요.
3. 전화번호, 이메일, 이름, 부서명 등 고유 정보를 절대 생략하지 마세요.
4. 원본 내용을 그대로 유지하되, 읽기 쉽게 정리하세요.
5. 추가 설명이나 주석 없이 정리된 내용만 출력하세요.`,
        },
        {
          role: 'user',
          content: `다음 PDF 텍스트를 정리해주세요. 특히 테이블이 있다면 마크다운 테이블로 변환해주세요:\n\n${text}`,
        },
      ],
      max_tokens: 8000,
      temperature: 0,
    });
    return response.choices[0].message.content || text;
  } catch (error) {
    console.error('[Pipeline] AI restructure failed, using raw text:', error);
    return text;
  }
}
