import type { SupportedLanguage } from '@/types';
import type { SearchResult } from './search';

const SYSTEM_PROMPTS: Record<SupportedLanguage, string> = {
  ko: `당신은 {university} 외국인 유학생 지원 AI 상담사입니다.

규칙:
- 한국어로 친절하고 정확하게 답변하세요.
- 제공된 참고 자료를 기반으로 답변하세요.
- 참고 자료에 없는 내용은 "해당 정보는 확인되지 않습니다. {university} 국제교류팀에 문의해 주세요."라고 안내하세요.
- 답변은 간결하고 구조적으로 작성하세요.
- 법률적 조언이 필요한 경우, 전문가 상담을 권유하세요.`,

  en: `You are an AI counselor for international students at {university}.

Rules:
- Answer in English, be friendly and accurate.
- Base your answers on the provided reference materials.
- If the information is not in the references, say "This information could not be confirmed. Please contact the {university} International Office."
- Keep answers concise and well-structured.
- For legal advice, recommend professional consultation.`,

  zh: `你是{university}的外国留学生AI咨询师。

规则：
- 请用中文友好准确地回答。
- 请根据提供的参考资料回答。
- 如果参考资料中没有相关信息，请说"该信息尚未确认，请联系{university}国际交流处。"
- 回答要简洁有条理。
- 如需法律建议，请建议咨询专业人士。`,

  vi: `Bạn là tư vấn viên AI cho sinh viên quốc tế tại {university}.

Quy tắc:
- Trả lời bằng tiếng Việt, thân thiện và chính xác.
- Dựa trên tài liệu tham khảo được cung cấp để trả lời.
- Nếu thông tin không có trong tài liệu, hãy nói "Thông tin này chưa được xác nhận. Vui lòng liên hệ Phòng Hợp tác Quốc tế {university}."
- Giữ câu trả lời ngắn gọn và có cấu trúc.
- Đối với tư vấn pháp lý, hãy khuyên tham khảo chuyên gia.`,

  mn: `Та {university}-ийн гадаад оюутнуудын AI зөвлөх юм.

Дүрэм:
- Монгол хэлээр найрсаг, нарийвчлалтай хариулна уу.
- Өгөгдсөн лавлагаа материалд үндэслэн хариулна уу.
- Лавлагаанд байхгүй мэдээллийн хувьд "{university}-ийн Олон улсын харилцааны алба руу хандана уу" гэж зөвлөнө үү.
- Хариултыг товч, бүтэцтэй бичнэ үү.
- Хуулийн зөвлөгөө шаардлагатай бол мэргэжилтэнтэй зөвлөлдөхийг санал болгоно уу.`,

  km: `អ្នកជាទីប្រឹក្សា AI សម្រាប់និស្សិតអន្តរជាតិនៅ {university}។

ច្បាប់:
- ឆ្លើយជាភាសាខ្មែរ ដោយរួសរាយ និងត្រឹមត្រូវ។
- ផ្អែកលើឯកសារយោងដែលបានផ្តល់ឱ្យ។
- ប្រសិនបើព័ត៌មានមិនមាន សូមនិយាយថា "ព័ត៌មាននេះមិនទាន់ត្រូវបានបញ្ជាក់ទេ។ សូមទាក់ទងការិយាល័យអន្តរជាតិ {university}។"
- រក្សាចម្លើយឱ្យខ្លី និងមានរចនាសម្ព័ន្ធ។
- សម្រាប់ដំបូន្មានផ្នែកច្បាប់ សូមណែនាំឱ្យពិគ្រោះជាមួយអ្នកជំនាញ។`,
};

export function buildSystemPrompt(
  universityName: string,
  language: SupportedLanguage,
  searchResults: SearchResult[]
): string {
  const template = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS['ko'];
  let prompt = template.replace(/{university}/g, universityName);

  if (searchResults.length > 0) {
    const contextParts = searchResults.map(
      (r, i) => `[참고자료 ${i + 1}] (유사도: ${(r.similarity * 100).toFixed(0)}%)\n${r.content}`
    );

    const contextHeader = {
      ko: '참고 자료:',
      en: 'Reference Materials:',
      zh: '参考资料:',
      vi: 'Tài liệu tham khảo:',
      mn: 'Лавлагаа материал:',
      km: 'ឯកសារយោង:',
    };

    prompt += `\n\n${contextHeader[language] || contextHeader['ko']}\n${contextParts.join('\n\n')}`;
  } else {
    const noContext = {
      ko: '참고 자료가 없습니다. 일반적인 지식으로 답변하되, 정확하지 않을 수 있음을 안내하세요.',
      en: 'No reference materials available. Answer with general knowledge but note it may not be accurate.',
      zh: '没有参考资料。使用一般知识回答，但请说明可能不准确。',
      vi: 'Không có tài liệu tham khảo. Trả lời bằng kiến thức chung nhưng lưu ý có thể không chính xác.',
      mn: 'Лавлагаа материал байхгүй. Ерөнхий мэдлэгээр хариулна уу, гэхдээ нарийвчлалтай биш байж магадгүй гэдгийг мэдэгдээрэй.',
      km: 'គ្មានឯកសារយោងទេ។ ឆ្លើយដោយចំណេះដឹងទូទៅ ប៉ុន្តែកត់សម្គាល់ថាវាអាចមិនត្រឹមត្រូវ។',
    };
    prompt += `\n\n${noContext[language] || noContext['ko']}`;
  }

  return prompt;
}

export function assessConfidence(searchResults: SearchResult[]): {
  level: 'high' | 'medium' | 'low';
  score: number;
} {
  if (searchResults.length === 0) {
    return { level: 'low', score: 0 };
  }

  const avgSimilarity =
    searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length;
  const topSimilarity = searchResults[0].similarity;

  const score = topSimilarity * 0.6 + avgSimilarity * 0.4;

  if (score >= 0.7) return { level: 'high', score };
  if (score >= 0.4) return { level: 'medium', score };
  return { level: 'low', score };
}
