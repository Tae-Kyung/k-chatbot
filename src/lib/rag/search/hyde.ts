import { getOpenAI } from '@/lib/openai/client';
import { LLM_MODEL } from '@/config/constants';

/**
 * Generate a hypothetical answer in Korean for HyDE (Hypothetical Document Embeddings).
 * The idea: embed a "fake answer" to better match against stored Korean document chunks.
 */
export async function generateHypotheticalAnswer(
  query: string,
  language: string
): Promise<string> {
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content:
            '당신은 한국 대학교 외국인 유학생 지원 담당자입니다. 아래 질문에 대해 한국어로 간결한 답변을 작성하세요. 비자, 학사, 장학금, 생활 정보 등 유학생이 필요로 하는 실질적인 정보를 포함하세요. 300자 이내로 작성하세요.',
        },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const answer = response.choices[0].message.content?.trim();
    if (answer) {
      console.log(`[Search] HyDE generated (${language}→ko): "${answer.substring(0, 80)}..."`);
      return answer;
    }
    return query;
  } catch (error) {
    console.error('[Search] HyDE generation failed, using original query:', error);
    return query;
  }
}

export async function translateToKorean(query: string, language: string): Promise<string> {
  if (language === 'ko') return query;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content:
            '다음 텍스트를 한국어로 정확히 번역하세요. 대학교 이름, 기관명 등 고유명사는 원문을 유지하세요. 번역된 한국어 텍스트만 출력하세요.',
        },
        { role: 'user', content: query },
      ],
      temperature: 0,
      max_tokens: 500,
    });
    return response.choices[0].message.content?.trim() || query;
  } catch (error) {
    console.error('[Search] Translation failed, using original query:', error);
    return query;
  }
}
