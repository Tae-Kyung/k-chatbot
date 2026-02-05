# TASK: K-Student Success AI Guide MVP 개발 계획

> PRD.md 기반 개발 태스크 분해
> 상태: `[ ]` 미착수 · `[~]` 진행중 · `[x]` 완료

---

## Phase 1: 프로젝트 초기 설정 및 인프라 구축

> 모든 후속 개발의 기반이 되는 프로젝트 구조, 개발 환경, 데이터베이스 스키마를 확정한다.

### 1.1 프로젝트 구조 초기화
- [x] Next.js (App Router) 프로젝트 생성
- [x] Tailwind CSS 설정 및 글로벌 스타일 정의
- [x] TypeScript 설정 (`tsconfig.json`, path alias)
- [x] ESLint + Prettier 코드 컨벤션 설정
- [x] 디렉토리 구조 확정
  ```
  src/
  ├── app/              # Next.js App Router 페이지
  ├── components/       # 공통 UI 컴포넌트
  ├── features/         # 기능별 모듈 (chat, admin, widget)
  ├── lib/              # 유틸리티, API 클라이언트
  ├── config/           # 대학별 설정, 환경변수
  ├── i18n/             # 다국어 번역 파일
  └── types/            # TypeScript 타입 정의
  ```

### 1.2 Supabase 프로젝트 설정
- [ ] Supabase 프로젝트 생성 (https://supabase.com)
- [ ] Supabase CLI 설치 및 로컬 개발 환경 연결 (`supabase init`, `supabase link`)
- [x] pgvector 확장 활성화 (`create extension vector`)
- [x] 핵심 테이블 스키마 설계 (Supabase SQL Editor 또는 마이그레이션):
  - `universities` — 대학 기본 정보 (이름, 로고 URL, 테마 색상, 메신저 링크)
  - `admin_profiles` — 관리자 프로필 (Supabase Auth user_id FK, 소속 대학 FK, 역할)
  - `documents` — 업로드 문서 메타데이터 (파일명, 유형, 대학 FK, 스토리지 경로, 업로드일)
  - `document_chunks` — 문서 청크 + 임베딩 벡터 (`vector(1536)`)
  - `conversations` — 채팅 세션 (대학 FK, 언어, 생성일)
  - `messages` — 개별 메시지 (세션 FK, role, content, 타임스탬프)
  - `feedback` — 답변 평가 (메시지 FK, 평점, 수정 내용)
- [x] Row Level Security (RLS) 정책 설정
  - 관리자: 소속 대학 데이터만 CRUD 가능
  - 학생(익명): conversations, messages INSERT/SELECT만 허용
  - documents/document_chunks: 대학 FK 기반 필터링
- [ ] Supabase Storage 버킷 생성
  - `documents` 버킷: PDF, HWP 원본 파일 저장
  - 대학별 폴더 구조 (`{university_id}/`)
  - 파일 크기 제한 정책 설정
- [ ] Supabase Auth 설정
  - 관리자 이메일/비밀번호 로그인 활성화
  - 관리자 초기 계정 생성 (대학별)
- [x] `@supabase/supabase-js` 클라이언트 유틸리티 설정
  - 클라이언트용: `createBrowserClient()` — 브라우저에서 anon key 사용
  - 서버용: `createServerClient()` — API Routes에서 service role key 사용 (RLS 우회)
  - 미들웨어용: Next.js middleware에서 세션 갱신
- [x] 벡터 검색용 Supabase RPC 함수 생성 (마이그레이션에 포함)
  ```sql
  create or replace function match_documents(
    query_embedding vector(1536),
    match_count int default 5,
    filter_university_id uuid default null
  ) returns table (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
  )
  language plpgsql
  as $$
  begin
    return query
    select
      dc.id, dc.content, dc.metadata,
      1 - (dc.embedding <=> query_embedding) as similarity
    from document_chunks dc
    where (filter_university_id is null or dc.university_id = filter_university_id)
    order by dc.embedding <=> query_embedding
    limit match_count;
  end;
  $$;
  ```
- [x] Supabase 마이그레이션 스크립트 작성 (`supabase/migrations/`)
- [x] 대학별 시드 데이터 입력 (충북대, 한국교통대, 한국교원대)

### 1.3 환경 설정 및 배포 인프라
- [x] 환경변수 구조 정의 (`.env.example`)
  - `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase 공개 키 (클라이언트용)
  - `SUPABASE_SERVICE_ROLE_KEY` — Supabase 서비스 키 (서버 전용, RLS 우회)
  - `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY` — LLM API 키
- [x] Git 저장소 초기화 및 `.gitignore` 설정
- [ ] Vercel 프로젝트 연결 (`vercel link`)
- [ ] Vercel 환경변수 등록 (Production / Preview / Development)
- [ ] GitHub → Vercel 자동 배포 파이프라인 설정 (push 시 자동 배포)

**Phase 1 완료 기준:** 프로젝트가 로컬에서 빌드·실행되고, Supabase DB 마이그레이션이 정상 동작하며, 시드 데이터로 3개 대학 정보가 `@supabase/supabase-js`로 조회 가능한 상태. Vercel에 첫 배포 성공.

---

## Phase 2: 대학 테마 시스템 및 랜딩 페이지

> PRD 4.1 — 대학 선택 랜딩 페이지 및 대학별 커스터마이징 구현

### 2.1 대학 설정 데이터 모델
- [x] 대학 데이터는 Supabase `universities` 테이블에서 동적 로딩 (하드코딩 금지)
- [x] TypeScript 타입은 Supabase 스키마에서 자동 생성 (`supabase gen types`)
  ```ts
  // 자동 생성된 타입 기반으로 활용
  type University = Database['public']['Tables']['universities']['Row'];
  ```
- [x] 대학 데이터 캐싱: 서버 컴포넌트에서 `universities` 조회 → 클라이언트에 전달 (ISR 또는 SSR)
- [x] 테마 Context Provider 구현 (선택된 대학에 따라 CSS 변수 동적 적용)

### 2.2 랜딩 페이지 구현
- [x] 메인 랜딩 페이지 레이아웃 (모바일 퍼스트)
- [x] 3개 대학 로고 카드 가로 배치 (모바일: 세로 스택)
- [x] 로고 클릭 시 `/chat/[universityId]` 라우팅
- [x] 페이지 진입 애니메이션 (선택사항)
- [x] SEO 메타 태그 설정

**Phase 2 완료 기준:** 랜딩 페이지에서 대학을 선택하면 해당 대학 테마(색상, 로고)가 적용된 빈 챗봇 페이지로 이동.

---

## Phase 3: 다국어(i18n) 시스템

> PRD 4.2.1 — 6개 국어 지원 체계 구축. UI 텍스트와 LLM 응답 양쪽에 영향을 주므로 조기 구현 필요.

### 3.1 i18n 프레임워크 설정
- [x] `next-intl` 또는 `react-i18next` 라이브러리 도입
- [x] 지원 언어 코드 정의: `ko`, `en`, `zh`, `vi`, `mn`, `km`
- [x] 언어 감지 전략 수립 (브라우저 언어 → 사용자 선택 → 기본값 `ko`)

### 3.2 번역 파일 구성
- [x] UI 텍스트 번역 키 구조 설계
  ```
  i18n/
  ├── ko.json    # 한국어
  ├── en.json    # English
  ├── zh.json    # 中文
  ├── vi.json    # Tiếng Việt
  ├── mn.json    # Монгол
  └── km.json    # ភាសាខ្មែរ
  ```
- [x] 공통 UI 텍스트 번역 (메뉴, 버튼, 안내 문구, 에러 메시지)
- [ ] 각 언어별 번역 검수 (네이티브 화자 검증 필요)

### 3.3 언어 전환 UI
- [x] 우측 상단 언어 선택 드롭다운 컴포넌트 구현
- [x] 선택 언어 로컬 스토리지 저장 (재방문 시 유지)
- [x] 언어 변경 시 UI 즉시 반영 (페이지 새로고침 없이)

**Phase 3 완료 기준:** 언어 토글로 6개 국어 전환 시 모든 UI 텍스트가 해당 언어로 표시됨.

---

## Phase 4: 학생용 챗봇 프론트엔드

> PRD 4.2 — 모바일 퍼스트 채팅 인터페이스 구현

### 4.1 채팅 화면 레이아웃
- [x] 모바일 퍼스트 채팅 페이지 (`/chat/[universityId]`)
- [x] 상단 헤더: 대학 로고 + 대학명 + 언어 선택 토글
- [x] 중앙 메시지 영역: 스크롤 가능한 대화 목록
- [x] 하단 입력 영역: 텍스트 입력창 + 전송 버튼

### 4.2 채팅 메시지 컴포넌트
- [x] 초기 환영 메시지 표시 (대학명 + 선택 언어에 맞춘 인사말 + 사용 안내)
- [x] 사용자 메시지 버블 (우측 정렬)
- [x] AI 응답 버블 (좌측 정렬, 출처 링크 포함)
- [x] 답변 피드백 버튼 (각 AI 응답 하단에 👍/👎 → `feedback` 테이블 저장)
- [x] 타이핑 인디케이터 (AI 응답 생성 중 표시)
- [x] 스트리밍 응답 표시 (타이핑 효과)
- [x] 메시지 타임스탬프

### 4.3 하단 퀵 메뉴
- [x] 3개 카테고리 버튼 상시 노출
  - 비자/행정
  - 학사/장학
  - 취업/지역정보
- [x] 버튼 클릭 시 해당 카테고리 안내 메시지 자동 전송
- [x] 카테고리별 하위 질문 추천 (선택사항)

### 4.4 메신저 연동 (딥링크)
- [x] 플로팅 액션 버튼 (FAB) 구현
- [x] 클릭 시 메신저 선택 팝오버 표시
  - 카카오톡 채널 딥링크
  - 위챗 공식 계정 QR/딥링크
  - 텔레그램 봇 딥링크
- [x] 대학별 메신저 링크 설정에서 동적 로딩

### 4.5 채팅 상태 관리
- [x] 채팅 상태 관리 (React Context 또는 Zustand)
- [x] 대화 히스토리 관리 (세션 기반)
- [x] 새 대화 시작 기능
- [x] 에러 상태 처리 (네트워크 오류, API 실패)

**Phase 4 완료 기준:** 모바일 화면에서 대학 테마가 적용된 채팅 UI가 렌더링되고, 메시지 입력·퀵 메뉴·메신저 링크가 동작함 (백엔드 연동 전 목업 응답 사용).

---

## Phase 5: 백엔드 API 서버

> PRD 5, 6 — 채팅, 관리자, 인증 서비스 구현

### 5.1 API 기본 구조
- [x] Next.js API Routes 기반 서버 구성 (`/api/*`)
- [x] CORS 설정 (위젯 외부 도메인 허용 목록 관리)
  - 위젯이 삽입될 대학 도메인을 `Access-Control-Allow-Origin`에 등록
  - `next.config.js`에 CORS 헤더 설정 또는 미들웨어에서 처리
- [x] 공통 에러 핸들링 및 로깅 미들웨어
- [x] API 응답 포맷 표준화 (`{ success, data, error }`)
- [ ] API Rate Limiting 설정 (Vercel Edge Middleware 또는 Upstash Rate Limit)

### 5.2 인증 서비스 (Supabase Auth 활용)
- [x] Supabase Auth 기반 관리자 로그인 연동
- [x] 서버 사이드 세션 검증 미들웨어 (`supabase.auth.getUser()`)
- [x] `admin_profiles` 테이블 조회로 소속 대학 확인
- [x] 대학 소속 기반 권한 검증 미들웨어 (RLS + 서버 검증 이중 보호)

### 5.3 채팅 API
- [x] 채팅 메시지 전송 API (`POST /api/chat`)
  - 요청: `{ universityId, message, language, conversationId }`
  - 응답: 스트리밍 (ReadableStream)
- [x] Vercel 스트리밍 설정
  ```ts
  // app/api/chat/route.ts
  export const runtime = 'edge'; // 또는 'nodejs' + dynamic = 'force-dynamic'
  export const maxDuration = 60;  // Vercel Pro 기준
  ```
- [x] 대화 히스토리 조회 API (`GET /api/chat/:conversationId`)
- [x] 대학별 컨텍스트 자동 주입
- [x] 답변 피드백 API (`POST /api/chat/feedback`)
  - 요청: `{ messageId, rating }` → `feedback` 테이블 저장

### 5.4 관리자 API
- [x] 문서 업로드 API (`POST /api/admin/documents`)
  - 1단계: Supabase Storage에 원본 파일 저장 + `documents` 테이블에 메타데이터 기록 (상태: `pending`)
  - 2단계: 비동기 처리 API (`POST /api/admin/documents/process`) 호출
    - 파싱 → 청킹 → 임베딩 → 벡터 저장 (상태: `processing` → `completed` / `failed`)
    - **Vercel 타임아웃 대응**: 대용량 파일은 청크 단위로 분할 처리
  - 3단계: 클라이언트에서 상태 폴링 (`GET /api/admin/documents/:id/status`)
- [x] URL 크롤링 요청 API (`POST /api/admin/crawl`)
- [x] Q&A 직접 등록 API (`POST /api/admin/qa`)
- [x] 문서 목록 조회 API (`GET /api/admin/documents`)
  - Supabase RLS로 소속 대학 문서만 자동 필터링
- [x] 문서 삭제 API (`DELETE /api/admin/documents/:id`)
  - Supabase Storage 파일 + DB 레코드 + 벡터 청크 동시 삭제
- [x] 질문 통계 조회 API (`GET /api/admin/stats`)
- [x] 답변 검증 목록 조회 API (`GET /api/admin/reviews`)
- [x] 답변 수정 API (`PUT /api/admin/reviews/:id`)

**Phase 5 완료 기준:** 모든 API 엔드포인트가 구현되고, Postman/Thunder Client로 요청·응답이 검증됨.

---

## Phase 6: RAG 파이프라인

> PRD 4.2.3, 4.3.1 — 문서 기반 검색 증강 생성 시스템의 핵심

### 6.1 문서 파싱 모듈
- [x] PDF 파싱 (`pdf-parse` — Vercel Serverless 호환, 경량)
- [ ] HWP 파싱 (`hwp.js` 또는 외부 변환 API)
- [x] URL 웹페이지 크롤링 및 텍스트 추출 (`cheerio` — Vercel Serverless 호환)
  - ⚠️ `playwright`는 Vercel Serverless에서 실행 불가 → `cheerio` (정적 HTML) 사용
  - JS 렌더링이 필요한 SPA 페이지는 MVP 범위 외로 제한
- [x] 파싱 결과 정규화 (불필요 태그 제거, 텍스트 클리닝)
- [x] `documents` 테이블 상태 업데이트 연동 (`pending` → `processing` → `completed` / `failed`)

### 6.2 텍스트 청킹 및 임베딩
- [x] 텍스트 청킹 전략 구현
  - 청크 크기: ~500 토큰
  - 오버랩: 50 토큰
  - 구분 기준: 단락, 제목 기반 분리
- [x] 임베딩 생성 (OpenAI `text-embedding-3-small` 또는 동급)
- [x] 대학 ID + 문서 ID 메타데이터 태깅
- [x] Supabase PostgreSQL pgvector에 벡터 저장 (`document_chunks` 테이블)

### 6.3 검색 및 응답 생성
- [x] 사용자 질문 임베딩 생성
- [x] Supabase pgvector 유사도 검색 (코사인 유사도, top-k=5)
  - Supabase RPC 함수 (`match_documents`) 활용
- [x] 대학 ID 필터링 (선택된 대학 문서만 검색, RLS 연동)
- [x] 검색 결과 기반 프롬프트 구성
  ```
  시스템 프롬프트:
  - 역할: {대학명} 외국인 유학생 지원 AI 상담사
  - 응답 언어: {선택된 언어}
  - 참고 자료: {검색된 청크들}
  - 지시: 자연스러운 현지어로 응답, 출처 명시, 확실하지 않으면 담당자 연결 안내
  ```
- [x] LLM API 호출 및 스트리밍 응답 처리
- [x] 답변 신뢰도 평가 로직 (출처 매칭률 기반)
- [x] 신뢰도 낮을 시 폴백 메시지 + 담당자 연결 안내

### 6.4 다국어 응답 최적화
- [x] 언어별 시스템 프롬프트 템플릿 작성 (6개 국어)
- [ ] 소수 언어(몽골어, 크메르어) 사전 구축 Q&A 폴백 데이터 준비
- [ ] 응답 언어 일관성 검증 로직

**Phase 6 완료 기준:** PDF/HWP/URL을 업로드하면 자동 색인되고, 학생이 질문하면 해당 대학 문서 기반으로 6개 국어 응답이 생성됨.

---

## Phase 6.5: 프론트엔드 ↔ 백엔드 통합

> Phase 4 (챗봇 UI) + Phase 5 (API) + Phase 6 (RAG)을 연결하여 E2E 채팅 플로우를 완성한다.

### 6.5.1 채팅 플로우 통합
- [x] 챗봇 UI의 메시지 전송 → `POST /api/chat` 연동
- [x] 스트리밍 응답 수신 → 실시간 메시지 렌더링 연결
- [x] 퀵 메뉴 버튼 클릭 → API 호출 → 응답 표시 연결
- [x] 대화 히스토리 유지 (conversationId 관리)
- [x] 피드백 버튼 → `POST /api/chat/feedback` 연동

### 6.5.2 에러 처리 및 엣지 케이스
- [x] React Error Boundary 설정 (전역 에러 캐치)
- [x] API 에러 시 사용자 친화적 메시지 표시 (네트워크 오류, 서버 오류, 타임아웃)
- [x] LLM API 장애 시 폴백 메시지 ("잠시 후 다시 시도해주세요")
- [x] 빈 입력 / 너무 긴 입력 검증
- [ ] 모바일 키보드 활성화 시 채팅 영역 스크롤 자동 조정
- [x] 스트리밍 중 사용자 새 메시지 전송 방지 (전송 버튼 비활성화)

**Phase 6.5 완료 기준:** 랜딩 → 대학 선택 → 언어 변경 → 질문 입력 → AI 스트리밍 응답 수신 → 출처 표시 → 피드백 전송까지 E2E 동작 확인.

---

## Phase 7: 관리자 대시보드 프론트엔드

> PRD 4.3 — 노코드 데이터 관리 및 모니터링 화면

### 7.1 관리자 인증 화면
- [x] 관리자 로그인 페이지 (`/admin/login`)
- [x] Supabase Auth 기반 인증 상태 관리 (`onAuthStateChange`)
- [x] 로그인 후 `admin_profiles` 조회 → 소속 대학 대시보드로 리다이렉트
- [x] 로그아웃 기능 (`supabase.auth.signOut()`)

### 7.2 데이터 업로드 화면
- [x] 파일 업로드 영역 (드래그 앤 드롭 지원)
  - 지원 포맷: PDF, HWP
  - 파일 크기 제한 표시
- [x] URL 입력 필드 (붙여넣기 → 크롤링 요청)
- [x] 직접 텍스트 입력 폼 (Q&A 쌍 등록)
- [x] 업로드 진행 상태 표시 (파싱 중 / 색인 중 / 완료)
- [x] 등록된 데이터 소스 목록 (테이블)
  - 파일명, 유형, 등록일, 상태
  - 삭제 버튼

### 7.3 질문 통계 대시보드
- [ ] 상위 질문 키워드 차트 (워드 클라우드 또는 바 차트)
- [x] 언어별 질문 비율 차트 (파이 차트)
- [ ] 일별/주별 이용 추이 그래프 (라인 차트)
- [x] 기간 필터 (오늘, 7일, 30일)
- [x] 차트 라이브러리: `recharts` 또는 `chart.js`

### 7.4 답변 검증 패널
- [x] AI 생성 답변 목록 (최신순 정렬)
- [x] 각 답변 카드:
  - 원본 질문 + 사용 언어
  - AI 응답 내용
  - 참조한 출처 문서
  - 수정 버튼 → 인라인 편집
  - 승인/반려 상태 표시
- [ ] 수정 이력 저장

**Phase 7 완료 기준:** 관리자가 로그인 후 문서 업로드, 통계 확인, 답변 검증을 모두 수행할 수 있음.

---

## Phase 8: 이식형 챗봇 위젯

> PRD 4.4 — 외부 사이트에 삽입 가능한 경량 위젯

### 8.1 위젯 스크립트 개발
- [ ] 독립 번들 빌드 설정 (Webpack/Vite 별도 엔트리)
- [x] 위젯 로더 스크립트 작성
  ```html
  <script
    src="https://cdn.example.com/widget.js"
    data-university="cbnu"
    data-lang="ko"
  ></script>
  ```
- [x] Shadow DOM 또는 iframe 기반 격리 (호스트 사이트 CSS 충돌 방지)

### 8.2 위젯 UI
- [x] 플로팅 채팅 아이콘 (우측 하단 고정)
- [x] 클릭 시 챗봇 오버레이 확장/축소
- [x] 대학 컨텍스트 (`data-university`) 기반 테마 자동 적용
- [x] 위젯 내 전체 채팅 기능 동작 (Phase 4 UI 재사용)
- [x] 닫기/최소화 버튼

### 8.3 위젯 배포
- [ ] 번들 사이즈 최적화 (목표: gzip 기준 100KB 이하)
- [ ] CDN 배포 설정
- [ ] 위젯 삽입 가이드 문서 작성 (대학 웹마스터 제공용)

**Phase 8 완료 기준:** `<script>` 태그 한 줄로 외부 HTML 페이지에 챗봇 위젯이 정상 렌더링되고 대화 가능.

---

## Phase 9: 통합 테스트 및 품질 보증

### 9.1 테스트 작성
- [x] 단위 테스트 (Jest/Vitest)
  - RAG 파이프라인: 청킹, 임베딩, 검색 로직
  - API 엔드포인트: 입력 검증, 응답 포맷
  - 인증: Supabase Auth 세션 검증, RLS 권한 체크
- [ ] 통합 테스트
  - 채팅 플로우: 질문 → RAG 검색 → LLM 응답 → 클라이언트 수신
  - 관리자 플로우: 업로드 → 파싱 → 색인 → 검색 반영
- [ ] E2E 테스트 (Playwright 또는 Cypress)
  - 학생 플로우: 랜딩 → 대학 선택 → 언어 변경 → 채팅 → 퀵 메뉴
  - 관리자 플로우: 로그인 → 업로드 → 통계 확인 → 답변 검증

### 9.2 다국어 품질 검증
- [ ] 6개 언어별 UI 텍스트 표시 정상 여부 확인
- [ ] 6개 언어별 AI 응답 자연스러움 평가 (네이티브 검수)
- [ ] RTL/긴 텍스트 등 레이아웃 깨짐 테스트

### 9.3 성능 및 보안 테스트
- [ ] Lighthouse 모바일 성능 측정 (목표: 80점 이상)
- [ ] 챗봇 응답 시간 측정 (목표: 5초 이내)
- [ ] OWASP Top 10 보안 점검
  - XSS 방지 (사용자 입력 새니타이징)
  - SQL Injection 방지 (Supabase 파라미터 바인딩)
  - CSRF 방지
  - Supabase Auth 세션 보안 검증
- [ ] RLS 정책 검증: A대학 관리자가 B대학 데이터에 접근 불가 확인
- [ ] Supabase Storage 접근 제어 검증: 대학별 파일 격리 확인

**Phase 9 완료 기준:** 전체 테스트 통과율 90% 이상, Lighthouse 모바일 80점 이상, 보안 취약점 0건.

---

## Phase 10: 배포 및 런칭

### 10.1 프로덕션 환경 구축
- [ ] Supabase 프로덕션 프로젝트 설정 확인 (DB, Auth, Storage 정상 동작)
- [ ] Supabase 프로덕션 마이그레이션 실행 (`supabase db push`)
- [ ] Vercel 프로덕션 환경변수 설정 (Supabase 키, LLM API 키)
- [ ] Vercel 프로덕션 배포 설정 (프론트엔드 + API Routes 통합)
- [ ] 커스텀 도메인 및 SSL 인증서 설정 (Vercel 자동 SSL)
- [ ] CDN 설정 (위젯 스크립트 — Vercel Edge Network 활용)

### 10.2 모니터링 및 운영
- [ ] 에러 트래킹 설정 (Sentry 또는 동급)
- [ ] API 응답 시간 모니터링
- [ ] LLM API 사용량/비용 모니터링 대시보드
- [ ] 업타임 모니터링 (UptimeRobot 또는 동급)
- [ ] 로그 수집 및 조회 체계

### 10.3 런칭 준비
- [ ] 3개 대학별 초기 지식 베이스 데이터 수집 및 색인
  - 비자/행정 관련 문서
  - 학사 일정, 장학금 공지
  - 충북 지역 생활 정보
- [ ] Supabase Auth에서 관리자 계정 생성 + `admin_profiles` 등록 (대학별 1개 이상)
- [ ] 관리자 온보딩 가이드 작성
- [ ] 위젯 삽입 코드 각 대학 웹마스터에 전달
- [x] 개인정보처리방침 페이지 작성 (PIPA 준수)
- [ ] 법률 자문 면책 문구 챗봇 내 표시 확인

**Phase 10 완료 기준:** 프로덕션 환경에서 3개 대학 챗봇이 정상 동작하고, 관리자가 콘텐츠를 업로드·관리할 수 있는 상태.

---

## 태스크 의존성 맵

```
Phase 1 (인프라)
  ├──→ Phase 2 (랜딩/테마)
  ├──→ Phase 3 (다국어)
  └──→ Phase 5 (백엔드 API)
         ├──→ Phase 6 (RAG)
         └──→ Phase 7 (관리자)

Phase 2 + Phase 3 ──→ Phase 4 (챗봇 UI)

Phase 4 + Phase 5 + Phase 6 ──→ Phase 6.5 (프론트-백엔드 통합) ★ 핵심

Phase 6.5 ──→ Phase 8 (위젯)

Phase 6.5 + Phase 7 + Phase 8 ──→ Phase 9 (테스트)

Phase 9 ──→ Phase 10 (배포)
```

---

## 병렬 작업 가능 구간

| 병렬 그룹 | 동시 진행 가능 태스크 |
|-----------|----------------------|
| 그룹 A | Phase 2 (랜딩/테마) + Phase 3 (다국어) + Phase 5 (백엔드 API) |
| 그룹 B | Phase 4 (챗봇 UI) + Phase 6 (RAG) + Phase 7 (관리자) |
| 그룹 C | Phase 6.5 (통합) — Phase 4 + 5 + 6 완료 후 ★ 반드시 순차 |
| 그룹 D | Phase 8 (위젯) — Phase 6.5 완료 후 |

---

## 기술적 의사결정 항목

| 항목 | 선택 | 결정 사유 |
|------|------|-----------|
| BaaS | **Supabase** (확정) | PostgreSQL + Auth + Storage + RLS 통합 제공, pgvector 내장 지원 |
| 호스팅 | **Vercel** (확정) | Next.js 최적화, 자동 SSL, Edge Network, GitHub 연동 자동 배포 |
| DB 접근 | **@supabase/supabase-js** (확정) | Supabase 네이티브 클라이언트, RLS 자동 적용, ORM 불필요 |
| 벡터 스토어 | **Supabase pgvector** (확정) | 별도 서비스 불필요, DB 내장, RPC 함수로 유사도 검색 |

### 추가 의사결정 필요 항목

| 항목 | 선택지 | 결정 기준 |
|------|--------|-----------|
| LLM 프로바이더 | OpenAI GPT-4o vs Claude API | 다국어 품질 (특히 몽골어/크메르어), API 비용, 응답 속도 |
| 상태 관리 | React Context vs Zustand | 앱 규모, 성능 요구사항 |
| 차트 라이브러리 | Recharts vs Chart.js | 번들 사이즈, 커스터마이징 유연성 |
| HWP 파싱 | hwp.js vs 외부 변환 API | HWP 5.0+ 지원 범위, Vercel Serverless 환경 호환성 |
| 위젯 격리 | Shadow DOM vs iframe | CSS 격리 수준, 통신 복잡도 |
