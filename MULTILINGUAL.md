# 다국어 RAG 검색 정확도 향상 전략

## 현재 상태 분석

### 현행 파이프라인
```
[한국어 문서] → 청킹 → text-embedding-3-small → pgvector 저장
                                                        ↕
[사용자 질문(다국어)] → text-embedding-3-small → 코사인 유사도 검색 → LLM 응답
```

### 문제점
| 질문 언어 | 예시 질문 | 기대 매칭 (한국어 청크) | 예상 유사도 |
|-----------|-----------|------------------------|-------------|
| 한국어 | "도서관 운영시간이 어떻게 되나요?" | 도서관 운영시간 관련 청크 | 0.85+ (높음) |
| 영어 | "What are the library hours?" | 동일 청크 | 0.55~0.70 |
| 베트남어 | "Thư viện mở cửa lúc mấy giờ?" | 동일 청크 | 0.40~0.60 |
| 몽골어 | "Номын сан хэдэн цагт нээдэг вэ?" | 동일 청크 | 0.30~0.50 |

- `text-embedding-3-small`은 다국어를 지원하지만, **동일 언어 간 유사도가 교차 언어 유사도보다 항상 높음**
- 특히 몽골어, 캄보디아어 같은 저자원(low-resource) 언어는 교차 언어 성능이 더 낮음
- 현재 threshold=0.3이지만, 실질적으로 유의미한 검색은 0.5 이상에서 발생

---

## 전략 비교

### 전략 A: 쿼리 번역 (Query Translation) ⭐ 추천

검색 시점에 사용자 질문을 한국어로 번역한 후 검색

```
[사용자 질문(베트남어)] → OpenAI 번역 → [한국어 질문] → 임베딩 → 검색
```

| 항목 | 내용 |
|------|------|
| **정확도 향상** | 높음 (한국어↔한국어 검색이므로 유사도 0.8+ 기대) |
| **추가 비용** | 질문당 번역 1회 (gpt-4o-mini ~0.001$) |
| **저장 공간** | 변화 없음 |
| **구현 난이도** | 낮음 (search.ts에 번역 단계 추가) |
| **유지보수** | 문서 업데이트 시 추가 작업 없음 |
| **지연시간** | +200~500ms (번역 API 호출) |

**장점:**
- 기존 데이터/인덱스 변경 불필요
- 문서 추가/수정 시 추가 처리 없음
- 모든 언어에 균일한 성능

**단점:**
- 매 질문마다 번역 API 비용 발생 (미미함)
- 번역 오류가 검색 품질에 영향
- 고유명사/약어 번역 오류 가능

**구현 방법:**
```typescript
// search.ts 수정
async function translateToKorean(query: string, language: string): Promise<string> {
  if (language === 'ko') return query;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: '다음 텍스트를 한국어로 정확히 번역하세요. 고유명사는 원문 유지.' },
      { role: 'user', content: query }
    ],
    temperature: 0,
    max_tokens: 500,
  });
  return response.choices[0].message.content || query;
}

export async function searchDocuments(query, universityId, options) {
  const { language = 'ko', ...rest } = options;
  const translatedQuery = await translateToKorean(query, language);
  const queryEmbedding = await generateEmbedding(translatedQuery);
  // ... 기존 검색 로직
}
```

---

### 전략 B: 문서 다국어 번역 (Document Translation)

업로드 시 청크를 6개 언어로 번역하여 각각 임베딩 저장

```
[한국어 청크] → OpenAI 번역 → [영어, 중국어, 베트남어, 몽골어, 캄보디아어]
                             → 각 언어별 임베딩 → pgvector 저장 (6배)
```

| 항목 | 내용 |
|------|------|
| **정확도 향상** | 매우 높음 (동일 언어 매칭) |
| **추가 비용** | 청크당 번역 5회 + 임베딩 5배 (업로드 시 일회성) |
| **저장 공간** | 6배 증가 |
| **구현 난이도** | 중간 (pipeline.ts, DB 스키마 수정) |
| **유지보수** | 문서 업데이트마다 재번역 필요 |
| **지연시간** | 검색 시 추가 지연 없음, 업로드 시 대폭 증가 |

**장점:**
- 검색 시 추가 API 호출 없음 (빠름)
- 각 언어에 최적화된 매칭

**단점:**
- 저장 공간 6배 (pgvector 인덱스 크기 증가)
- 업로드 처리 시간 대폭 증가 (청크 50개 × 5언어 = 250회 번역)
- 문서 수정 시 모든 언어 재번역 필요
- 번역 비용: 청크 50개 문서 1개당 ~0.05$ (대량 시 누적)

**비용 추정 (문서 100개, 평균 50청크):**
- 번역: 5,000청크 × 5언어 × ~0.001$ = **~25$**
- 임베딩: 25,000건 × 0.00002$ = **~0.5$**
- 저장: pgvector 행 30,000개 (5,000 → 30,000)

---

### 전략 C: 하이브리드 (쿼리 번역 + 원문 동시 검색) ⭐⭐ 최적

한국어 번역 쿼리 + 원문 쿼리로 2회 검색 후 결과 병합

```
[사용자 질문(베트남어)] ──→ 임베딩 → 검색 결과 A (교차언어)
                       └→ 한국어 번역 → 임베딩 → 검색 결과 B (동일언어)
                                                      ↓
                                              결과 병합/중복제거 → LLM 응답
```

| 항목 | 내용 |
|------|------|
| **정확도 향상** | 가장 높음 (두 경로의 장점 결합) |
| **추가 비용** | 질문당 번역 1회 + 임베딩 1회 추가 |
| **저장 공간** | 변화 없음 |
| **구현 난이도** | 중간 |
| **유지보수** | 문서 업데이트 시 추가 작업 없음 |
| **지연시간** | +300~600ms |

**장점:**
- 번역 실패해도 원문 검색이 fallback 역할
- 고유명사가 번역에서 누락되어도 원문 매칭으로 보완
- 저장 공간 추가 불필요
- 두 경로의 결과를 병합하여 재현율(recall) 극대화

**단점:**
- 쿼리당 API 호출 증가 (번역 1회 + 임베딩 2회 + DB 검색 2회)
- 구현 복잡도 약간 증가

**구현 방법:**
```typescript
export async function searchDocumentsMultilingual(
  query: string,
  universityId: string,
  language: string,
  options: { topK?: number; threshold?: number } = {}
): Promise<SearchResult[]> {
  const { topK = 5, threshold = 0.3 } = options;

  // 1. 원문 검색 (교차 언어)
  const originalResults = await searchDocuments(query, universityId, { topK, threshold });

  if (language === 'ko') return originalResults;

  // 2. 한국어 번역 후 검색
  const translatedQuery = await translateToKorean(query, language);
  const translatedResults = await searchDocuments(translatedQuery, universityId, { topK, threshold });

  // 3. 결과 병합 (중복 제거, 최고 유사도 유지)
  const merged = new Map<string, SearchResult>();
  for (const r of [...translatedResults, ...originalResults]) {
    const existing = merged.get(r.id);
    if (!existing || r.similarity > existing.similarity) {
      merged.set(r.id, r);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

---

### 전략 D: 다국어 임베딩 모델 전환

`text-embedding-3-small` 대신 교차 언어 검색에 특화된 모델 사용

| 모델 | 교차 언어 성능 | 차원 | 비용 |
|------|---------------|------|------|
| text-embedding-3-small (현재) | 보통 | 1536 | $0.02/1M tokens |
| text-embedding-3-large | 좋음 | 3072 | $0.13/1M tokens |
| Cohere embed-multilingual-v3.0 | 매우 좋음 | 1024 | $0.10/1M tokens |

- `text-embedding-3-large`로 교체하면 다국어 성능이 향상되지만, 비용이 6.5배
- 모델 교체 시 기존 모든 임베딩 재생성 필요 (마이그레이션 비용)
- **권장하지 않음** — 쿼리 번역이 더 비용 효율적

---

## 추천 구현 순서

### Phase 1: 쿼리 번역 (즉시 적용 가능, 가성비 최고)
```
변경 파일: search.ts, chat/route.ts
예상 소요: 1~2시간
추가 비용: 질문당 ~0.001$ (미미)
정확도 향상: ★★★★☆
```
- `search.ts`에 `translateToKorean()` 함수 추가
- 한국어가 아닌 질문을 검색 전 번역
- 기존 데이터/인덱스 변경 없음

### Phase 2: 하이브리드 검색 (Phase 1 후 적용)
```
변경 파일: search.ts
예상 소요: 1시간
추가 비용: 질문당 임베딩 1회 추가 (~0.00002$)
정확도 향상: ★★★★★
```
- 원문 + 번역 질문 2중 검색
- 결과 병합으로 재현율 극대화
- 번역 실패 시에도 원문 검색이 안전망

### Phase 3 (선택): 핵심 문서 다국어 번역
```
변경 파일: pipeline.ts, chunker.ts, DB 스키마
예상 소요: 3~4시간
비용: 문서당 ~0.05$
정확도 향상: ★★★★★
```
- 가장 자주 질문되는 핵심 문서만 선별 번역
- 전체 문서가 아닌 FAQ/규정 등 중요 문서 대상
- `metadata.language` 필드로 언어 구분

---

## 비용 비교 (월 1,000건 질문 기준)

| 전략 | 월 추가 비용 | 정확도 향상 | 구현 복잡도 |
|------|-------------|------------|------------|
| A. 쿼리 번역만 | ~$1.0 | ★★★★☆ | 낮음 |
| B. 문서 번역만 | ~$25 (일회) + 저장 | ★★★★☆ | 중간 |
| C. 하이브리드 (A 확장) | ~$1.5 | ★★★★★ | 중간 |
| D. 모델 교체 | ~$6.5 + 마이그레이션 | ★★★☆☆ | 높음 |

---

## 결론

**Phase 1 (쿼리 번역) → Phase 2 (하이브리드)** 순서로 구현하는 것을 추천합니다.

- 비용 대비 효과가 가장 뛰어남 (월 ~$1.5로 최대 정확도)
- 기존 데이터/인프라 변경 불필요
- 점진적 적용 가능 (Phase 1만으로도 큰 효과)
- 문서 번역(Phase 3)은 특정 핵심 문서에만 선별 적용
