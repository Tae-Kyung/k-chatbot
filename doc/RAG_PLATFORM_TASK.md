# TASK: AskDocs RAG Platform 개발 계획

> **PRD:** RAG_PLATFORM_PRD.md 기반
> **Base Code:** k-chatbot (Next.js 16 + Supabase + OpenAI, 88 files, 7,359 LOC) — **읽기 전용 참조**
> **Target Repo:** https://github.com/Tae-Kyung/rag-platform.git
> **작업 디렉토리:** `C:/Users/misoh/OneDrive/Desktop/workspace/rag-platform/`
> **상태:** `[ ]` 미착수 · `[~]` 진행중 · `[x]` 완료
>
> **중요:** k-chatbot(basecode)은 절대 수정하지 않는다. 참조만 하고, 모든 코드 생성·수정·커밋은 rag-platform 디렉토리에서 수행한다.

---

## PRD 보완 사항 (개발 전 확인)

> PRD 분석 결과 아래 항목들이 미정의 상태. 개발 착수 전 결정 필요.

| # | 미정의 항목 | 결정 사항 | 적용 Phase |
|---|-----------|----------|-----------|
| G1 | System Admin 식별 방법 | `profiles.role` 컬럼 추가 (`user` / `admin`) | Phase 1 |
| G2 | 팀 멤버 권한 상세 | Editor: 문서/Q&A CRUD 가능, Viewer: 읽기만 | Phase 9 |
| G3 | 플랜 다운그레이드 시 초과 데이터 처리 | 읽기 전용, 신규 업로드 차단 (삭제 안 함) | Phase 6 |
| G4 | 무료 메시지 소진 시 End User 응답 | "사용량 한도에 도달했습니다" 메시지 반환 | Phase 6 |
| G5 | Grace Period 동작 | 3일간 봇 활성 유지, 대시보드에 경고 배너 | Phase 6 |
| G6 | API 키 범위 | 사용자 레벨 (모든 봇에 적용) | Phase 8 |
| G7 | 위젯 커스터마이징 저장 | `bots` 테이블에 `widget_config JSONB` 컬럼 추가 | Phase 4 |
| G8 | 봇별 RAG 설정 | `bots` 테이블에 `rag_config JSONB` 컬럼 추가 (top_k, threshold, hyde 등) | Phase 3 |
| G9 | Rate Limit 초과 응답 | `429 { error: "Rate limit exceeded", retry_after: N }` | Phase 8 |
| G10 | 비활성 봇 응답 | "이 봇은 현재 사용할 수 없습니다" 메시지 | Phase 4 |

---

## 의존 관계 요약

```
Phase 1 (스캐폴드 + DB + Auth)
  ├─→ Phase 2 (봇 CRUD + 지식베이스)
  │     └─→ Phase 3 (채팅 + 위젯)
  │           ├─→ Phase 5 (Telegram)
  │           ├─→ Phase 7 (Owner 대시보드 - 분석)
  │           └─→ Phase 8 (Public API)
  ├─→ Phase 4 (Paddle 결제) ──→ Phase 6 (플랜 제한)
  │                              └─→ Phase 7 (Owner 대시보드 - 빌링)
  └─→ Phase 10 (랜딩 페이지) [병렬 가능]

Phase 7 + Phase 6 ──→ Phase 9 (시스템 관리자)
Phase 8 ──→ Phase 11 (테스트 + 배포)
```

---

## 기존 코드 재사용 매핑

### 그대로 복사 (변경 없음, ~600 LOC)

| 파일 | 용도 |
|------|------|
| `src/lib/rag/parser.ts` | PDF/URL 텍스트 추출 |
| `src/lib/rag/chunker.ts` | 텍스트 청킹 (~500 토큰) |
| `src/lib/rag/embeddings.ts` | OpenAI 임베딩 생성 |
| `src/lib/rag/language.ts` | 언어 감지·전처리 |
| `src/lib/rag/pipeline-restructure.ts` | AI 재구조화 |
| `src/lib/rag/pipeline-tables.ts` | 테이블 마크다운 변환 |
| `src/lib/rag/search/excerpt.ts` | 키워드 주변 발췌 |
| `src/lib/rag/search/hyde.ts` | HyDE 구현 |
| `src/lib/rag/dommatrix-polyfill.ts` | Vercel DOMMatrix 폴리필 |
| `src/lib/openai/client.ts` | Lazy OpenAI 초기화 |
| `src/lib/api/response.ts` | API 응답 헬퍼 |
| `src/components/ErrorBoundary.tsx` | React 에러 경계 |
| `src/components/TypingIndicator.tsx` | 타이핑 애니메이션 |
| `src/components/LoadingSpinner.tsx` | 로딩 스피너 |

### 리팩토링 필요 (~600 LOC, `university_id` → `bot_id`)

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/rag/pipeline.ts` | `universityId` → `botId` 파라미터, DB 쿼리 변경 |
| `src/lib/rag/search/index.ts` | `universityId` → `botId`, RPC 파라미터 변경 |
| `src/lib/rag/search/keyword.ts` | `.eq('university_id', ...)` → `.eq('bot_id', ...)` |
| `src/lib/rag/search/settings.ts` | `rag_settings` 테이블 → `bots.rag_config` JSONB 로드 |
| `src/lib/rag/prompts.ts` | 하드코딩 페르소나 → `bots.system_prompt` 로드 |
| `src/app/api/chat/route.ts` | `universityId` → `botId`, 봇 설정 동적 로드 |
| `src/lib/telegram/handler.ts` | 대학 룩업 → 봇 룩업 (DB `channel_configs` 기반) |
| `src/features/chat/store.ts` | University 컨텍스트 → Bot 컨텍스트 |
| `src/lib/chat/history.ts` | 검증 후 복사 (university 결합 없으면 그대로) |
| `src/lib/chat/sources.ts` | 검증 후 복사 |

### 새로 작성 (~40+ 파일)

| 카테고리 | 예상 파일 수 |
|----------|-------------|
| Paddle 연동 | 5-8 |
| Owner 대시보드 페이지 | 10-12 |
| Owner API 라우트 | 15-20 |
| System Admin 페이지 + API | 8-10 |
| Public API (`/v1/*`) | 5-6 |
| 채널 커넥터 (Kakao, WeChat) | 3-4 |
| 미들웨어 (인증, 플랜, Rate limit) | 3-4 |
| Public 페이지 (랜딩, 가격 등) | 4-5 |

---

## Phase 1: 프로젝트 스캐폴드 + DB 스키마 + 인증 (1주)

> **목표:** 새 레포 생성, k-chatbot 재사용 모듈 복사, 새 DB 스키마 적용, 가입/로그인 작동
> **의존:** 없음 (최초 Phase)

### 1.1 레포 초기화 & 프로젝트 구조

- [x] GitHub 레포 생성: `https://github.com/Tae-Kyung/rag-platform.git` (생성 완료, 빈 상태)
- [x] 로컬에 clone + k-chatbot에서 재사용 파일만 선택 복사
  - 14개 파일 복사 완료 (RAG, supabase, openai, components)
  - 대학 전용 파일 제외 (university/, UniversityLogo, messages.ts 등)
  > ⚠ k-chatbot 원본은 **읽기 전용**. 절대 수정하지 않는다.
- [x] 디렉토리 구조 재편
  ```
  src/
  ├── app/
  │   ├── (public)/        # 랜딩, 가격, 로그인, 회원가입
  │   ├── dashboard/       # Owner 대시보드
  │   ├── admin/           # System Admin
  │   ├── chat/[botId]/    # End User 챗봇
  │   ├── widget/[botId]/  # iframe 위젯
  │   └── api/
  │       ├── auth/        # 인증 API
  │       ├── owner/       # Owner API
  │       ├── sys/         # System Admin API
  │       ├── chat/        # End User 채팅 API
  │       ├── webhooks/    # Paddle, Telegram, Kakao, WeChat
  │       └── v1/          # Public API (Pro+)
  ├── components/          # 공통 UI
  ├── features/
  │   ├── chat/            # 챗봇 UI 컴포넌트
  │   ├── dashboard/       # Owner 대시보드 컴포넌트
  │   └── admin/           # System Admin 컴포넌트
  ├── lib/
  │   ├── api/             # 응답 헬퍼
  │   ├── auth/            # 인증 미들웨어, 가드
  │   ├── billing/         # Paddle 유틸
  │   ├── chat/            # 대화 히스토리, 소스
  │   ├── channels/        # 채널 커넥터 (telegram, kakao, wechat)
  │   ├── openai/          # LLM 클라이언트
  │   ├── rag/             # RAG 파이프라인 (기존 재사용)
  │   └── supabase/        # Supabase 클라이언트
  ├── config/              # 상수, 플랜 정의
  ├── i18n/                # next-intl
  └── types/               # TypeScript 타입
  ```
- [x] `package.json` 업데이트
  - 추가: `@paddle/paddle-node-sdk`
  - 추가: `@upstash/ratelimit`, `@upstash/redis`
  - 추가: `zod` (입력 검증)
  - 유지: `@supabase/ssr`, `openai`, `recharts`, `zustand`, `next-intl`, `pdf-parse`, `cheerio`
  - 제거: 불필요한 패키지 정리
- [x] `.env.example` 업데이트
  ```env
  # Supabase
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=

  # OpenAI
  OPENAI_API_KEY=

  # Paddle
  PADDLE_API_KEY=
  PADDLE_WEBHOOK_SECRET=
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
  NEXT_PUBLIC_PADDLE_ENV=sandbox

  # Upstash Redis (Rate Limiting)
  UPSTASH_REDIS_REST_URL=
  UPSTASH_REDIS_REST_TOKEN=

  # App
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

### 1.2 데이터베이스 스키마

- [x] 새 마이그레이션 작성: `supabase/migrations/00001_platform_schema.sql`
  - PRD 5.3 전체 스키마 (13개 테이블)
  - 보완: `profiles` 테이블에 `role TEXT DEFAULT 'user'` 컬럼 추가 (G1)
  - 보완: `bots` 테이블에 `widget_config JSONB DEFAULT '{}'` 컬럼 추가 (G7)
  - 보완: `bots` 테이블에 `rag_config JSONB DEFAULT '{}'` 컬럼 추가 (G8)
  - pgvector 확장 활성화
  - IVFFlat 인덱스 생성
  - `match_documents` RPC 함수 (`bot_id` 필터 버전)
    ```sql
    CREATE OR REPLACE FUNCTION match_documents(
      query_embedding vector(1536),
      match_count int DEFAULT 5,
      filter_bot_id uuid DEFAULT NULL
    ) RETURNS TABLE (
      id uuid, content text, metadata jsonb, similarity float
    ) LANGUAGE plpgsql AS $$
    BEGIN
      RETURN QUERY
      SELECT dc.id, dc.content, dc.metadata,
             1 - (dc.embedding <=> query_embedding) AS similarity
      FROM document_chunks dc
      WHERE (filter_bot_id IS NULL OR dc.bot_id = filter_bot_id)
      ORDER BY dc.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
    ```

- [x] RLS 정책 작성: `supabase/migrations/00002_rls_policies.sql`
  - PRD 5.4 전체 RLS 정책
  - 보완: `system_logs` — `profiles.role = 'admin'` 인 사용자만 SELECT
  - 보완: `conversations`, `messages` — service role INSERT (End User 채팅용)
  - 팀 멤버 접근 정책 (team_members JOIN으로 봇 접근 허용)

- [x] 트리거 작성: `supabase/migrations/00003_triggers.sql`
  ```sql
  -- 가입 시 profiles 자동 생성
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    -- 무료 플랜 자동 할당
    INSERT INTO public.subscriptions (user_id, plan_id, status)
    VALUES (NEW.id, 'free', 'active');
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  ```

- [x] 시드 데이터 작성: `supabase/seed.sql`
  ```sql
  INSERT INTO plans (id, name, price_monthly, price_yearly, max_bots, max_messages,
    max_storage_mb, max_documents, max_qa, max_team_members, channels,
    api_access, api_rate_limit, branding_removal, llm_models) VALUES
  ('free', 'Free', 0, 0, 1, 100, 1, 3, 10, 1,
    '["web"]', false, 0, false, '["gpt-4o-mini"]'),
  ('starter', 'Starter', 2900, 28800, 3, 3000, 10, 20, 100, 2,
    '["web","telegram"]', false, 0, false, '["gpt-4o-mini"]'),
  ('pro', 'Pro', 9900, 99600, 10, 15000, 100, 100, 1000, 5,
    '["web","telegram","kakao","wechat"]', true, 60, true, '["gpt-4o-mini","gpt-4o","claude"]'),
  ('enterprise', 'Enterprise', 29900, 298800, -1, -1, -1, -1, -1, -1,
    '["web","telegram","kakao","wechat","custom"]', true, 300, true,
    '["gpt-4o-mini","gpt-4o","claude"]');
  -- (-1 = 무제한)
  ```

- [x] Supabase 타입 생성: `npx supabase gen types typescript > src/types/database.ts`
  - 모든 테이블에 `Relationships: []` 포함 확인 (@supabase/ssr 호환)

### 1.3 인증 시스템

- [x] Supabase Auth 설정
  - 이메일/비밀번호 가입 활성화
  - Google OAuth Provider 등록
  - GitHub OAuth Provider 등록
  - 이메일 확인 템플릿 커스터마이징
  - 비밀번호 재설정 URL 설정

- [x] 인증 유틸리티
  - `src/lib/supabase/client.ts` — 기존 유지 (브라우저 클라이언트)
  - `src/lib/supabase/server.ts` — 기존 유지 (서버 클라이언트)
  - `src/lib/supabase/service.ts` — 기존 유지 (service role)
  - `src/lib/supabase/middleware.ts` — 기존 유지 (세션 갱신)
  - `src/lib/auth/guards.ts` — **신규**: 인증 가드 함수들
    ```typescript
    export async function requireAuth(request: Request): Promise<User>
    export async function requireAdmin(request: Request): Promise<User>
    export async function requireOwner(request: Request, botId: string): Promise<User>
    export async function requirePlan(request: Request, minPlan: PlanId): Promise<Subscription>
    ```

- [x] 인증 페이지 UI
  - `src/app/(public)/login/page.tsx` — 로그인 (이메일 + Google + GitHub)
  - `src/app/(public)/signup/page.tsx` — 회원가입
  - `src/app/(public)/reset-password/page.tsx` — 비밀번호 재설정
  - `src/app/(public)/auth/callback/route.ts` — OAuth 콜백 처리

- [x] Next.js 미들웨어 업데이트
  - `src/middleware.ts`
    - `/dashboard/*` → 인증 필수, 미인증 시 `/login` 리다이렉트
    - `/admin/*` → 인증 + `role = 'admin'` 필수
    - `/api/owner/*` → 인증 필수
    - `/api/sys/*` → admin role 필수
    - `/chat/*`, `/widget/*`, `/api/chat` → 인증 불요

### 1.4 타입 정의 & 설정

- [x] `src/types/index.ts` — 플랫폼 공통 타입
  ```typescript
  export type PlanId = 'free' | 'starter' | 'pro' | 'enterprise';
  export type UserRole = 'user' | 'admin';
  export type BotChannel = 'web' | 'telegram' | 'kakao' | 'wechat' | 'api';
  export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';
  export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

  export interface BotConfig {
    id: string;
    name: string;
    system_prompt: string;
    welcome_message: string;
    language_mode: string;
    llm_model: string;
    temperature: number;
    max_tokens: number;
    rag_config: RagConfig;
    widget_config: WidgetConfig;
  }

  export interface RagConfig {
    top_k?: number;
    similarity_threshold?: number;
    use_hyde?: boolean;
    use_keyword?: boolean;
    chunk_size?: number;
  }

  export interface WidgetConfig {
    position?: 'bottom-right' | 'bottom-left';
    primary_color?: string;
    button_icon?: string;
    header_title?: string;
  }
  ```

- [x] `src/config/constants.ts` — 플랫폼 상수
  ```typescript
  export const PLAN_LIMITS = { /* plans 테이블 미러 (클라이언트용) */ };
  export const LLM_DEFAULTS = { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 1024 };
  export const RATE_LIMITS = { free: 10, starter: 30, pro: 60, enterprise: 300 }; // req/min
  export const USAGE_ALERT_THRESHOLDS = [0.8, 1.0]; // 80%, 100%
  ```

**Phase 1 완료 기준:**
- `npm run build` 성공
- Supabase 마이그레이션 적용 완료 (13개 테이블 생성)
- 이메일 가입 → profiles 자동 생성 → free 구독 자동 생성 확인
- Google/GitHub OAuth 로그인 작동
- `/dashboard` 접근 시 인증 가드 작동 (미로그인 → `/login` 리다이렉트)

---

## Phase 2: 봇 CRUD & 지식 베이스 (2주)

> **목표:** 봇 생성·수정·삭제, 문서 업로드·크롤링·Q&A 등록, RAG 파이프라인 연동
> **의존:** Phase 1 (인증, DB 스키마)

### 2.1 봇 CRUD API

- [x] `src/app/api/owner/bots/route.ts`
  - `GET` — 본인 봇 목록 조회 (plan 제한 수 포함)
  - `POST` — 봇 생성 (plan max_bots 체크)
    - Zod 검증: name(필수), description, system_prompt, welcome_message, language_mode, llm_model, temperature, max_tokens
    - 봇 수 제한 체크: `SELECT count(*) FROM bots WHERE user_id = :uid`

- [x] `src/app/api/owner/bots/[botId]/route.ts`
  - `GET` — 봇 상세 (설정 + 통계 요약)
  - `PUT` — 봇 설정 수정
  - `DELETE` — 봇 삭제 (관련 documents, chunks, conversations CASCADE)
  - **소유권 확인**: `requireOwner(request, botId)` 가드 적용

### 2.2 문서 관리 API

- [x] `src/app/api/owner/bots/[botId]/documents/route.ts`
  - `GET` — 봇의 문서 목록 (status, chunk_count, file_size 포함)
  - `POST` — 문서 업로드
    - Supabase Storage에 파일 저장 (`documents/{botId}/{fileName}`)
    - 플랜별 파일 타입 체크 (Free: PDF/TXT/URL만)
    - 플랜별 용량 체크 (총 file_size 합산 vs max_storage_mb)
    - 플랜별 문서 수 체크 (vs max_documents)
    - `documents` 테이블에 메타데이터 INSERT (status: 'pending')

- [x] `src/app/api/owner/bots/[botId]/documents/[docId]/route.ts`
  - `GET` — 문서 상세 (처리 상태, 청크 수)
  - `DELETE` — 문서 삭제 + Storage 파일 삭제 + 관련 chunks 삭제

- [x] `src/app/api/owner/bots/[botId]/documents/process/route.ts`
  - `POST` — 비동기 문서 처리 시작
    - 기존 `src/lib/rag/pipeline.ts` 활용 (리팩토링 후)
    - `universityId` → `botId` 변경
    - 처리 완료 시 `documents.status = 'completed'`, `documents.chunk_count = N`
    - 실패 시 `documents.status = 'failed'`, `documents.error_message = ...`

- [x] `src/app/api/owner/bots/[botId]/documents/crawl/route.ts`
  - `POST` — URL 크롤링
    - 기존 `src/app/api/admin/crawl/route.ts` 리팩토링
    - URL → cheerio 파싱 → 청킹 → 임베딩 → 저장
    - `documents.file_type = 'url'`, `documents.source_url = URL`

- [x] `src/app/api/owner/bots/[botId]/qa/route.ts`
  - `GET` — Q&A 목록
  - `POST` — Q&A 등록 (question + answer → 임베딩 생성 → qa_pairs INSERT)
  - `DELETE /[qaId]` — Q&A 삭제
  - 플랜별 Q&A 수 체크 (vs max_qa)

### 2.3 RAG 파이프라인 리팩토링

- [x] `src/lib/rag/pipeline.ts` 수정
  - 함수 시그니처: `processDocument(documentId: string, botId: string)` 로 변경
  - DB 쿼리: `university_id` → `bot_id` 전체 치환
  - `document_chunks` INSERT 시 `bot_id` 포함
  - `metadata` 대신 `chunk_count`, `error_message` 직접 컬럼 사용

- [x] `src/lib/rag/search/index.ts` 수정
  - `searchDocuments(query, botId, options)` 시그니처 변경
  - RPC 호출: `filter_university_id` → `filter_bot_id`

- [x] `src/lib/rag/search/keyword.ts` 수정
  - `.eq('university_id', universityId)` → `.eq('bot_id', botId)` 전체 치환
  - 대학 전용 단어 제거, SaaS 범용 stopWords/genericWords로 조정

- [x] `src/lib/rag/search/settings.ts` 수정
  - `rag_settings` 테이블 조회 → `bots.rag_config` JSONB 조회로 변경
  - 캐시 키: `botId` 기반 (60초 TTL 유지)

- [x] `src/lib/rag/prompts.ts` 수정
  - 하드코딩된 대학 상담 페르소나 제거
  - `buildSystemPrompt(botName, botSystemPrompt, language, searchResults)` 으로 변경
  - `bot.system_prompt`를 기본 프롬프트에 삽입, 없으면 generic assistant

### 2.4 봇 관리 UI

- [x] `src/app/dashboard/layout.tsx` — Owner 대시보드 레이아웃
  - 사이드바: 봇 목록 (빌링, API 키 등은 Phase 4, 7에서 추가)
  - 상단바: 사용자 이름, 로그아웃

- [x] `src/app/dashboard/page.tsx` — 대시보드 홈
  - 봇 카드 그리드 (이름, 설명, 상태, 문서 수, 대화 수)
  - "새 봇 만들기" 버튼 (플랜 한도 초과 시 disabled + upgrade 안내)
  - 봇 없을 때 빈 상태 UI

- [x] `src/app/dashboard/bots/new/page.tsx` — 봇 생성
  - BotForm 컴포넌트 사용, 생성 후 봇 상세로 리다이렉트

- [x] `src/app/dashboard/bots/[botId]/page.tsx` — 봇 상세
  - 탭 구성: 설정 | 지식베이스
  - 설정 탭: BotForm (수정 모드) + 삭제 (Danger Zone)
  - 지식베이스 탭: 문서 관리 페이지 링크

- [x] `src/app/dashboard/bots/[botId]/documents/page.tsx` — 문서 관리
  - 문서 목록 테이블 (파일명, 타입, 크기, 상태, 청크 수, 등록일)
  - 파일 업로드 드래그&드롭
  - URL 크롤링 입력 폼
  - Q&A 직접 등록 폼
  - 문서 삭제 (확인 다이얼로그)
  - 처리 중 상태 폴링 (5초 간격)

- [x] `src/features/dashboard/BotForm.tsx` — 봇 생성·수정 공통 폼
- [x] `src/features/dashboard/BotCard.tsx` — 봇 카드 컴포넌트
- [x] `src/features/dashboard/DocumentUploader.tsx` — 파일 업로드 컴포넌트
- [x] `src/features/dashboard/DocumentList.tsx` — 문서 목록 컴포넌트
- [x] `src/features/dashboard/QAPairForm.tsx` — Q&A 등록 컴포넌트

### 2.5 Supabase Storage

- [x] `supabase/migrations/00004_storage_bucket.sql` — `documents` 버킷 생성 (비공개) + RLS 정책

### 2.6 빌드 수정

- [x] `src/lib/rag/search/excerpt.ts` — generic 타입 `<T extends HasContent>` 으로 변경 (SearchResult 타입 호환)
- [x] 봇 CRUD API: `subscriptions → plans` 관계형 JOIN 불가 → 별도 쿼리로 분리

**Phase 2 완료 기준:**
- [x] `npm run build` 성공 (22개 파일 생성, 모든 라우트 등록)
- [ ] 봇 생성 → 문서 업로드 → 처리 완료 → 청크/임베딩 생성 확인
- [ ] URL 크롤링 → 청크 생성 확인
- [ ] Q&A 등록 → 임베딩 생성 확인
- [ ] 플랜별 제한 (봇 수, 문서 수, 용량) 작동 확인
- [ ] 봇 삭제 시 관련 데이터 전체 CASCADE 확인
> ⚠ 기능 테스트는 Supabase 프로젝트 생성 + 마이그레이션 적용 후 진행

---

## Phase 3: 채팅 & 위젯 (1주)

> **목표:** End User가 봇과 대화, 웹 위젯으로 외부 사이트에 삽입
> **의존:** Phase 2 (봇 + 지식베이스)

### 3.1 채팅 API

- [x] `src/app/api/chat/route.ts` 리팩토링
  - Request: `{ bot_id, message, conversation_id?, language? }`
  - 봇 존재 + 활성 확인 (비활성 시 403 메시지 반환)
  - 봇 소유자의 usage_records 메시지 카운트 확인 (초과 시 429 메시지)
  - `bots` 테이블에서 설정 로드 (system_prompt, model, temperature, max_tokens)
  - SSE 스트리밍 (meta → content → sources → done)
  - 응답 완료 시: messages INSERT + usage_records INCREMENT

- [x] `src/app/api/chat/[conversationId]/route.ts`
  - `GET` — 대화 이력 조회

- [x] `src/app/api/chat/feedback/route.ts`
  - `POST` — 피드백 제출 (rating 1-5 + comment)

### 3.2 채팅 페이지

- [x] `src/app/chat/[botId]/page.tsx`
  - 봇 정보 로드 (이름, widget_config)
  - ChatHeader, ChatMessage, ChatInput, TypingIndicator 컴포넌트
  - `src/features/chat/store.ts` — Zustand (botId 기반)
  - `src/hooks/useStreamChat.ts` — SSE 스트리밍 훅

- [x] `src/app/chat/[botId]/layout.tsx`
  - "Powered by AskDocs" 푸터

### 3.3 위젯

- [x] `src/app/widget/[botId]/page.tsx`
  - widget_config 적용 (색상, 헤더 타이틀, placeholder)

- [x] `public/widget.js` — 위젯 로더 스크립트
  - `data-bot-id`, `data-position`, `data-color`, `data-lang` 속성
  - 플로팅 버튼 → 클릭 시 iframe 토글

- [x] `src/app/dashboard/bots/[botId]/embed/page.tsx` — 삽입코드 생성기
  - Script tag / iframe / direct link 코드 복사
  - 실시간 미리보기

### 3.4 피드백 & 사용량 추적

- [x] 메시지별 피드백 (별점 1-5 + 코멘트) — ChatMessage 컴포넌트 내장
- [x] `src/lib/billing/usage.ts` — 사용량 추적 유틸리티
  - `incrementMessageCount`, `checkMessageQuota`, `getCurrentUsage`
- [x] `src/lib/chat/sources.ts` — 소스 중복 제거
- [x] `src/lib/chat/history.ts` — 대화 이력 빌더

**Phase 3 완료 기준:**
- [x] `npm run build` 성공 (16개 파일 생성, 모든 라우트 등록)
- [ ] `/chat/{botId}` 에서 봇과 스트리밍 대화 가능
- [ ] 봇 설정 (프롬프트, 모델, 온도) 이 실제 응답에 반영
- [ ] 위젯 스크립트로 외부 HTML에서 채팅 가능
- [ ] 메시지 카운트 증가 확인
- [ ] 무료 플랜 100건 초과 시 한도 메시지 반환
> ⚠ 기능 테스트는 Supabase 프로젝트 생성 + 마이그레이션 적용 후 진행

---

## Phase 4: Paddle 결제 시스템 (2주)

> **목표:** 유료 구독 결제, 플랜 업/다운그레이드, 인보이스 발행
> **의존:** Phase 1 (인증, DB)
> **참고:** Paddle은 Merchant of Record (MoR) — 세금/VAT 자동 처리, 인보이스 직접 발행

### 4.1 Paddle 초기 설정

- [ ] Paddle 계정 설정 (Sandbox 환경)
  - Products 생성: Starter, Pro, Enterprise
  - Prices 생성: 월간 + 연간 (각 Product에 2개 Price)
  - Notification (Webhook) 엔드포인트 등록
  - Client-side token 발급

- [x] `src/lib/billing/paddle.ts` — Paddle 서버 클라이언트
  ```typescript
  import { Paddle } from '@paddle/paddle-node-sdk';
  export function getPaddle(): Paddle  // lazy init
  export async function getSubscription(subscriptionId: string): Promise<Subscription>
  export async function cancelSubscription(subscriptionId: string): Promise<void>
  export async function updateSubscription(subscriptionId: string, priceId: string): Promise<void>
  ```

- [x] `src/config/paddle.ts` — Paddle Price ID 매핑
  ```typescript
  export const PADDLE_PRICES = {
    starter: { monthly: 'pri_xxx', yearly: 'pri_yyy' },
    pro: { monthly: 'pri_xxx', yearly: 'pri_yyy' },
    enterprise: { monthly: 'pri_xxx', yearly: 'pri_yyy' },
  };
  ```

### 4.2 결제 API

- [x] `src/app/api/owner/billing/route.ts`
  - `GET` — 현재 구독 정보, 사용량, 트랜잭션(인보이스) 목록

- [x] `src/app/api/owner/billing/cancel/route.ts`
  - `POST` — Paddle Subscription API로 해지 요청
  - `effective_from: 'next_billing_period'` (기간 만료 시 해지)

- [x] `src/app/api/owner/billing/update/route.ts`
  - `POST { price_id }` — 구독 플랜 변경 (Paddle Update Subscription API)
  - 프로레이션 자동 처리 (Paddle이 계산)

### 4.3 Paddle Webhook

- [x] `src/app/api/webhooks/paddle/route.ts`
  - **핵심 이벤트 처리:**

  | 이벤트 | 처리 |
  |--------|------|
  | `subscription.created` | `subscriptions` INSERT, `paddle_customer_id`·`paddle_subscription_id` 저장 |
  | `subscription.updated` | `plan_id` 변경, `current_period_*` 업데이트 |
  | `subscription.canceled` | `subscriptions.status = 'canceled'`, Free 다운그레이드 |
  | `subscription.past_due` | `subscriptions.status = 'past_due'`, 알림 이메일 |
  | `transaction.completed` | `invoices` INSERT, `usage_records` 리셋 (새 기간) |
  | `transaction.payment_failed` | 결제 실패 로그, 이메일 알림 |

  - 서명 검증: `paddle.webhooks.unmarshal(body, secretKey, sig)`
  - 멱등성: `paddle_transaction_id` UNIQUE 제약으로 중복 방지
  - `system_logs` 이벤트 기록

- [x] `src/lib/billing/webhook-handlers.ts` — 이벤트별 핸들러 분리
  ```typescript
  export async function handleSubscriptionCreated(event: SubscriptionCreatedEvent): Promise<void>
  export async function handleSubscriptionUpdated(event: SubscriptionUpdatedEvent): Promise<void>
  export async function handleSubscriptionCanceled(event: SubscriptionCanceledEvent): Promise<void>
  export async function handleTransactionCompleted(event: TransactionCompletedEvent): Promise<void>
  export async function handleTransactionPaymentFailed(event: TransactionPaymentFailedEvent): Promise<void>
  ```

### 4.4 빌링 UI

- [x] `src/app/dashboard/billing/page.tsx`
  - 현재 플랜 표시 (이름, 가격, 갱신일)
  - 사용량 게이지 (메시지, 스토리지, 봇 수, 문서 수)
  - 플랜 비교 카드 (업그레이드 CTA)
  - 업그레이드 버튼 → Paddle.js Checkout Overlay (클라이언트 사이드)
  - "구독 해지" 버튼 → `/api/owner/billing/cancel` 호출
  - 트랜잭션(인보이스) 목록 테이블 (날짜, 금액, 상태, 영수증 링크)

- [x] `src/app/dashboard/billing/layout.tsx` — Paddle.js 스크립트 로드
  ```typescript
  // <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" />
  // Paddle.Environment.set('sandbox') or 'production'
  // Paddle.Setup({ token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN })
  ```

- [x] `src/features/dashboard/PlanCard.tsx` — 플랜 비교 카드 컴포넌트
- [x] `src/features/dashboard/UsageGauge.tsx` — 사용량 게이지 컴포넌트
- [x] `src/features/dashboard/InvoiceList.tsx` — 트랜잭션 목록 컴포넌트

**Phase 4 완료 기준:**
- Free → Starter 업그레이드: Paddle Checkout Overlay → 결제 → 구독 활성화 확인
- 구독 플랜 변경 (Starter → Pro) 작동 확인
- 구독 해지 → 기간 만료 시 Free 다운그레이드 확인
- Webhook으로 `subscriptions` 테이블 실시간 동기화
- 트랜잭션 목록 조회 + Paddle 영수증 링크
- (Paddle Sandbox 모드로 검증)

---

## Phase 5: Telegram 채널 연동 (1주)

> **목표:** 봇별 동적 Telegram 봇 등록 및 대화
> **의존:** Phase 3 (채팅 API)

### 5.1 채널 설정 API

- [x] `src/app/api/owner/bots/[botId]/channels/route.ts`
  - `GET` — 봇의 채널 설정 목록
  - `POST` — 채널 추가 `{ channel: 'telegram', config: { bot_token: '...' } }`
    - 플랜별 채널 허용 여부 체크 (plans.channels JSONB)
    - `channel_configs` INSERT

- [x] `src/app/api/owner/bots/[botId]/channels/[channel]/route.ts`
  - `PUT` — 채널 설정 수정 (토큰 변경, 활성/비활성)
  - `DELETE` — 채널 연동 해제 (Webhook 해제 + `channel_configs` DELETE)

### 5.2 Telegram 동적 봇

- [x] `src/lib/channels/telegram/api.ts` — 기존 `src/lib/telegram/api.ts` 리팩토링
  - 봇 토큰을 파라미터로 받도록 변경 (하드코딩 제거)
  ```typescript
  export async function setWebhook(botToken: string, webhookUrl: string): Promise<void>
  export async function deleteWebhook(botToken: string): Promise<void>
  export async function sendMessage(botToken: string, chatId: string, text: string): Promise<void>
  ```

- [x] `src/lib/channels/telegram/handler.ts` — 기존 핸들러 리팩토링
  - 봇 토큰 → `channel_configs`에서 bot_id 역조회
  - `universityId` → `botId` 전체 치환
  - 봇 설정 로드 (system_prompt, llm_model 등)

- [x] `src/app/api/webhooks/telegram/[botId]/route.ts`
  - `POST` — Telegram Webhook 수신
  - `channel_configs`에서 `bot_id` + `channel='telegram'` 조회
  - `config.webhook_secret` 검증
  - 기존 handler 호출 (botId 전달)

- [x] 채널 등록 시 자동 Webhook 설정
  - 채널 추가 API에서 `setWebhook(token, 'https://askdocs.ai/api/webhooks/telegram/{botId}')` 호출
  - 채널 삭제 시 `deleteWebhook(token)` 호출

### 5.3 채널 관리 UI

- [x] `src/app/dashboard/bots/[botId]/channels/page.tsx`
  - Telegram 카드: 봇 토큰 입력, "연결" 버튼
  - 연결 상태 표시 (활성/비활성)
  - KakaoTalk, WeChat 카드 (Pro 이상 잠금 표시)
  - 채널 해제 버튼 (확인 다이얼로그)

- [x] `src/features/dashboard/ChannelCard.tsx` — 채널 설정 카드 컴포넌트
- [x] `src/features/dashboard/TelegramSetup.tsx` — Telegram 설정 폼

**Phase 5 완료 기준:**
- Owner가 Telegram 봇 토큰 입력 → Webhook 자동 등록
- Telegram에서 메시지 전송 → AskDocs 봇이 RAG 기반 응답
- 채널 해제 → Webhook 해제 확인
- 대화가 `conversations` 테이블에 `channel='telegram'`으로 저장

---

## Phase 6: 플랜 제한 & 사용량 추적 (1주)

> **목표:** 모든 API에 플랜 제한 적용, 사용량 실시간 추적
> **의존:** Phase 3 (채팅) + Phase 4 (결제)

### 6.1 플랜 제한 미들웨어

- [x] `src/lib/billing/plan-guard.ts` — 플랜 제한 체크 함수들
  ```typescript
  export async function checkBotLimit(userId: string): Promise<{ allowed: boolean; current: number; max: number }>
  export async function checkDocumentLimit(userId: string, botId: string): Promise<{ allowed: boolean }>
  export async function checkStorageLimit(userId: string, fileSizeBytes: number): Promise<{ allowed: boolean }>
  export async function checkMessageLimit(userId: string): Promise<{ allowed: boolean; remaining: number }>
  export async function checkQALimit(userId: string, botId: string): Promise<{ allowed: boolean }>
  export async function checkChannelAccess(userId: string, channel: BotChannel): Promise<boolean>
  export async function checkAPIAccess(userId: string): Promise<boolean>
  ```

- [x] 각 API에 플랜 가드 적용
  - 봇 생성: `checkBotLimit`
  - 문서 업로드: `checkDocumentLimit` + `checkStorageLimit`
  - 채팅: `checkMessageLimit` (이미 Phase 3에서 적용됨)
  - Q&A 등록: `checkQALimit`
  - 채널 추가: `checkChannelAccess`

### 6.2 사용량 추적

- [x] `src/lib/billing/usage.ts` 구현
  - 메시지 카운트: 채팅 API에서 assistant 메시지 생성 시 increment
  - 스토리지: 문서 업로드/삭제 시 increment/decrement
  - 문서 카운트: 문서/Q&A 생성 시 increment
  - 월별 자동 리셋: Paddle `transaction.completed` webhook에서 처리 (Phase 4)

- [x] 사용량 알림
  - `src/app/api/owner/usage-alerts/route.ts` — 사용량 알림 API
  - `src/features/dashboard/UsageAlertBanner.tsx` — 대시보드 배너
  - 80% 도달 시: 노란색 경고 배너
  - 100% 도달 시: 빨간색 한도 도달 배너 + End User에게 429 응답 (G4)

### 6.3 다운그레이드 처리 (G3)

- [x] 다운그레이드 시 초과 데이터 처리 로직
  - 봇 수 초과: 기존 봇 읽기 전용 (편집·생성 불가, 채팅은 유지)
  - 문서 수/용량 초과: 기존 문서 유지, 새 업로드 차단 (plan-guard가 차단)
  - 메시지: 새 월 기준 제한 적용 (usage.ts가 추적)
  - 대시보드에 "플랜 초과" 경고 표시 (UsageAlertBanner)

**Phase 6 완료 기준:**
- Free 사용자: 봇 1개, 문서 3개, 메시지 100건 초과 시 차단 확인
- Starter → Free 다운그레이드 시 기존 데이터 유지 + 읽기 전용 확인
- 사용량 80% 경고 배너 표시
- 사용량 100% End User 한도 메시지 표시

---

## Phase 7: Owner 대시보드 — 분석·로그 (2주)

> **목표:** 대화 분석, 로그 검색, 피드백 통계, API 키, 팀 관리
> **의존:** Phase 3 (대화 데이터) + Phase 4 (빌링)

### 7.1 분석·통계

- [x] `src/app/api/owner/bots/[botId]/stats/route.ts`
  - `GET ?period=7d|30d|90d`
  - 일별 대화 수 (라인 차트 데이터)
  - 채널별 분포 (파이 차트 데이터)
  - 언어별 분포
  - 피드백 평균 별점
  - 응답 시간 P50, P95 (messages.latency_ms 기반)
  - 인기 키워드 TOP 10

- [x] `src/app/dashboard/bots/[botId]/analytics/page.tsx`
  - Recharts 기반 차트 구성
  - 기간 선택기 (7일/30일/90일)
  - KPI 카드 (총 대화, 평균 별점, 평균 응답시간)

- [x] `src/features/dashboard/charts/` — 차트 컴포넌트들
  - `ConversationChart.tsx` — 일별 대화 수 라인 차트
  - `ChannelPieChart.tsx` — 채널별 파이 차트
  - `FeedbackChart.tsx` — 피드백 추이
  - `KeywordCloud.tsx` — 인기 키워드

### 7.2 대화 로그

- [x] `src/app/api/owner/bots/[botId]/conversations/route.ts`
  - `GET ?page=1&limit=20&search=keyword&channel=telegram&dateFrom=&dateTo=`
  - 대화 목록 (시작 시간, 채널, 메시지 수, 피드백)
  - 페이지네이션

- [x] `src/app/api/owner/bots/[botId]/conversations/[convId]/route.ts`
  - `GET` — 대화 상세 (전체 메시지 + 소스 + 피드백)

- [x] `src/app/dashboard/bots/[botId]/conversations/page.tsx`
  - 대화 목록 테이블 (검색, 필터, 정렬)
  - 대화 클릭 → 사이드 패널에서 전체 메시지 표시
  - CSV 내보내기 버튼

- [x] `src/features/dashboard/ConversationList.tsx`
- [x] `src/features/dashboard/ConversationDetail.tsx`

### 7.3 API 키 관리

- [x] `src/app/api/owner/api-keys/route.ts`
  - `GET` — 키 목록 (prefix, name, created_at, last_used)
  - `POST { name }` — 새 키 생성
    - `checkAPIAccess(userId)` — Pro 이상 확인
    - 키 생성: `ask_` + 랜덤 32바이트 hex
    - SHA-256 해시 저장 (원본은 생성 시 1회만 표시)
    - 응답: `{ key: "ask_xxxx...xxxx", prefix: "ask_xxxx" }`

- [x] `src/app/api/owner/api-keys/[keyId]/route.ts`
  - `DELETE` — 키 폐기

- [x] `src/app/dashboard/api-keys/page.tsx`
  - 키 목록 테이블
  - "새 키 생성" → 모달에서 키 1회 표시 (복사 버튼)
  - 키 삭제 (확인 다이얼로그)

### 7.4 프로필 관리

- [x] `src/app/api/owner/profile/route.ts`
  - `GET` — 프로필 조회
  - `PUT` — 프로필 수정 (full_name, company, avatar_url, timezone)

- [x] `src/app/dashboard/profile/page.tsx`
  - 프로필 수정 폼
  - 아바타 업로드 (Supabase Storage)
  - 비밀번호 변경 (Supabase Auth)

**Phase 7 완료 기준:**
- 봇별 분석 차트 표시 (대화 수, 채널, 키워드)
- 대화 로그 검색·필터·페이지네이션 작동
- CSV 내보내기 작동
- API 키 생성 → 키 표시 → 목록에서 확인
- 프로필 수정 → DB 반영

---

## Phase 8: Public API (1주)

> **목표:** Pro 이상 사용자를 위한 외부 API 제공
> **의존:** Phase 3 (채팅) + Phase 6 (플랜 제한) + Phase 7 (API 키)

### 8.1 API 키 인증 미들웨어

- [x] `src/lib/auth/api-key.ts`
  ```typescript
  export async function authenticateAPIKey(request: Request): Promise<{
    userId: string;
    keyId: string;
    plan: PlanId;
  }>
  ```
  - `Authorization: Bearer ask_xxxxx` 헤더 파싱
  - SHA-256 해시 → `api_keys` 테이블 조회
  - `api_keys.last_used` 업데이트
  - 관련 사용자의 구독 플랜 확인 (API 접근 허용 여부)

### 8.2 Rate Limiting

- [x] `src/lib/auth/rate-limit.ts`
  - 인메모리 슬라이딩 윈도우 구현 (Upstash 없이)
  - 플랜별 Rate Limit: Pro=60/min, Enterprise=300/min
  - 슬라이딩 윈도우 알고리즘
  - 초과 시 `429` + `{ error: "Rate limit exceeded", retry_after: N }`

### 8.3 Public API 엔드포인트

- [x] `src/app/api/v1/chat/route.ts`
  - `POST { bot_id, message, conversation_id?, stream? }`
  - API 키 인증 → Rate Limit 체크 → 메시지 쿼터 체크
  - 스트리밍 응답 (SSE) 또는 일반 JSON 응답
  - `usage_records.api_calls` increment

- [x] `src/app/api/v1/bots/[botId]/route.ts`
  - `GET` — 봇 정보 조회 (이름, 설명, 상태)

- [x] `src/app/api/v1/conversations/route.ts`
  - `GET ?bot_id=xxx&limit=20&offset=0` — 대화 목록

- [x] `src/app/api/v1/conversations/[convId]/messages/route.ts`
  - `GET` — 대화 내역

- [x] `src/app/api/v1/usage/route.ts`
  - `GET` — 현재 사용량 조회

### 8.4 API 문서

- [x] `src/app/(public)/docs/page.tsx` — API 문서 페이지
  - 인증 방법 (Bearer token)
  - 엔드포인트 목록 + 요청/응답 예시
  - Rate Limit 설명
  - 에러 코드 목록

**Phase 8 완료 기준:**
- API 키로 `/v1/chat` 호출 → 스트리밍 응답 수신
- Rate Limit 초과 시 429 응답
- Free/Starter 사용자 API 호출 시 403 응답
- API 문서 페이지 접근 가능

---

## Phase 9: 시스템 관리자 대시보드 (1주)

> **목표:** 전체 사용자·트래픽·매출 모니터링
> **의존:** Phase 6 (사용량) + Phase 7 (대시보드)

### 9.1 System Admin API

- [x] `src/app/api/sys/users/route.ts`
  - `GET ?page=1&limit=20&search=&plan=&status=` — 전체 가입자 목록
  - 가입일, 플랜, 상태, 봇 수, 메시지 사용량

- [x] `src/app/api/sys/users/[userId]/route.ts`
  - `GET` — 사용자 상세 (모든 봇, 구독, 사용량)
  - `PUT { status, plan_id }` — 계정 정지/해제, 플랜 수동 변경

- [x] `src/app/api/sys/traffic/route.ts`
  - `GET ?period=7d|30d|90d`
  - 일별 총 메시지 수, API 호출 수, 에러 수
  - 사용자별 TOP 10 (트래픽 순)

- [x] `src/app/api/sys/revenue/route.ts`
  - `GET`
  - MRR 계산 (active subscriptions × price)
  - 플랜별 가입자 분포
  - 월별 매출 추이 (invoices 집계)
  - Churn Rate (월별 canceled / total)

- [x] `src/app/api/sys/system-status/route.ts`
  - `GET`
  - DB 연결 상태 (간단한 SELECT 1)
  - 총 벡터 DB 크기 (document_chunks 수)
  - Supabase Storage 사용량
  - 총 가입자 수, 총 봇 수

### 9.2 System Admin UI

- [x] `src/app/admin/layout.tsx` — 관리자 레이아웃
  - 사이드바: 대시보드, 사용자, 트래픽, 매출, 시스템
  - `requireAdmin` 가드

- [x] `src/app/admin/page.tsx` — 관리자 대시보드 홈
  - KPI 카드: 총 가입자, MRR, 오늘 메시지 수, 활성 봇 수
  - 미니 차트: 7일 가입자 추이, 7일 메시지 추이

- [x] `src/app/admin/users/page.tsx` — 사용자 관리
  - 가입자 테이블 (검색, 플랜 필터, 정렬)
  - 클릭 → 사용자 상세 모달 (봇 목록, 사용량, 결제 이력)
  - 계정 정지/해제 토글
  - 플랜 수동 변경 드롭다운

- [x] `src/app/admin/traffic/page.tsx` — 트래픽 모니터링
  - 일별 메시지 수 차트 (Recharts)
  - 사용자별 TOP 10 테이블
  - 에러율 차트

- [x] `src/app/admin/revenue/page.tsx` — 매출 모니터링
  - MRR/ARR 카드
  - 플랜별 가입자 파이 차트
  - 월별 매출 바 차트
  - Churn Rate 라인 차트

- [x] `src/app/admin/system/page.tsx` — 시스템 상태
  - 서비스 상태 카드 (DB, Storage, API)
  - 리소스 사용량 (벡터 DB 크기, 스토리지)

**Phase 9 완료 기준:**
- 관리자 로그인 → `/admin` 대시보드 접근
- 사용자 목록 조회, 검색, 계정 정지/해제
- MRR 계산 정확성 확인
- 트래픽 차트 데이터 표시

---

## Phase 10: 랜딩 페이지 & 마케팅 (1주)

> **목표:** 서비스 소개, 가격, 데모, 법적 페이지
> **의존:** 없음 (병렬 가능, Phase 4 가격 확정 후 가격 페이지)

### 10.1 랜딩 페이지

- [x] `src/app/page.tsx` — 메인 랜딩
  - 히어로 섹션: 태그라인 + CTA ("무료로 시작하기")
  - 기능 소개 섹션 (4개 핵심 기능 카드)
  - 사용 방법 (3단계: 가입 → 업로드 → 배포)
  - 신뢰 지표 (보안, 데이터 보호)
  - CTA 반복 ("지금 시작하기")
  - 푸터 (4컬럼 링크)

### 10.2 가격 페이지

- [x] `src/app/pricing/page.tsx`
  - 4 플랜 카드 (Free/Starter/Pro/Enterprise)
  - 월간/연간 토글 (17% 할인)
  - 각 플랜 CTA 버튼 + "Most Popular" 뱃지
  - FAQ 아코디언 (5개)

### 10.3 데모 & 법적 페이지

- [x] `src/app/demo/page.tsx` — 데모 챗봇
  - 프리셋 Q&A 기반 체험 (로그인 불요)
  - 빠른 질문 버튼 + 자유 입력
  - CTA: "Build Your Own Bot"

- [x] `src/app/privacy/page.tsx` — 개인정보처리방침 (8개 섹션)
- [x] `src/app/terms/page.tsx` — 이용약관 (11개 섹션)
- [x] `src/app/refund/page.tsx` — 환불 정책 (30일 보장)

### 10.4 SEO & 메타

- [x] `src/app/layout.tsx` 메타데이터
  - title (template), description, keywords, openGraph, twitter:card, robots
- [x] `public/robots.txt`
- [x] `src/app/sitemap.ts` — 9개 URL 사이트맵

**Phase 10 완료 기준:**
- 랜딩 페이지 반응형 디자인 (모바일 + 데스크톱)
- 가격 페이지 월간/연간 토글 작동
- 데모 챗봇 체험 가능
- SEO 메타태그 + OG 이미지

---

## Phase 11: 테스트 & 배포 (1주)

> **목표:** 품질 보증, 프로덕션 배포
> **의존:** 모든 Phase

### 11.1 단위 테스트 (Vitest)

- [x] RAG 파이프라인 테스트 (36 tests: chunker 16 + language 20)
  - chunkText: 빈 텍스트, 분할, 오버랩, sanitize, 오버사이즈 분할
  - getChunkOverlap, preprocessKhmer/Mongolian/ByLanguage
  - generateEmbedding/generateEmbeddings: OpenAI mock, 배치, 트렁케이트 (8 tests)

- [x] 인증 가드 테스트 (17 tests)
  - `requireAuth`: 인증/미인증/에러
  - `requireAdmin`: admin/non-admin/profile없음
  - `requireOwner`: 소유자/미소유/봇없음
  - `requirePlan`: 플랜 레벨 비교, 비활성 구독, enterprise

- [x] 플랜 제한 테스트 (14 tests)
  - PLAN_LIMITS: 4 플랜 정의, 값 검증, -1 무제한, 단계별 증가
  - RATE_LIMITS: 4 플랜 정의, 양수, 단계별 증가

- [ ] Paddle Webhook 핸들러 테스트 (webhook-handlers.ts 미구현 — Phase 4에서 구현 예정)

- [x] API 키 인증 테스트 (10 tests)
  - 헤더 없음, Bearer 아닌 형식, ask_ 접두사 없음, DB 미존재, 만료, free/starter 차단, pro/enterprise 허용

- [x] Rate Limit 테스트 (9 tests)
  - 첫 요청 허용, remaining 카운트, 키별 독립, enterprise 한도, 한도 초과 차단

- [x] API Response 테스트 (12 tests)
  - successResponse: JSON 형태, 기본 200, 커스텀 상태, null/string/array 데이터
  - errorResponse: JSON 형태, 기본 400, 401/403/404/500 상태

### 11.2 E2E 테스트 (Playwright)

- [ ] 가입 → 로그인 → 대시보드 플로우
- [ ] 봇 생성 → 문서 업로드 → 채팅 플로우
- [ ] 위젯 삽입 → 외부 페이지에서 채팅
- [ ] 결제 플로우 (Paddle Sandbox 테스트)

### 11.3 배포

- [ ] Vercel 프로젝트 생성 + GitHub 연결
- [ ] 환경변수 등록 (Production)
  - Supabase, OpenAI, Paddle (Live keys), Upstash
- [ ] Supabase 프로덕션 DB 마이그레이션 적용
- [ ] 커스텀 도메인 설정 (askdocs.ai)
- [x] `vercel.json` 설정 (chat 60s, documents/process 60s, webhooks 30s)
- [ ] 모니터링 설정
  - Vercel Analytics 활성화
  - Paddle Webhook 모니터링
  - 에러 알림 (500 에러 발생 시)

### 11.4 출시 체크리스트

- [ ] 모든 환경변수 프로덕션 값 설정
- [ ] Paddle Live 모드 전환
- [ ] Supabase RLS 정책 최종 검증
- [ ] HTTPS 강제 (Vercel 기본)
- [ ] 개인정보처리방침·이용약관 최종 검토
- [ ] 데모 봇 시드 데이터 입력
- [ ] 관리자 계정 생성 (profiles.role = 'admin')

**Phase 11 완료 기준:**
- 단위 테스트 50개+ 통과
- E2E 핵심 플로우 통과
- 프로덕션 배포 완료 + 도메인 접근 가능
- Paddle Live 결제 테스트 성공

---

## Post-MVP: 향후 확장 (Phase 12+)

> MVP 이후 우선순위에 따라 구현

### Phase 12: KakaoTalk 연동
- [ ] 카카오 i 오픈빌더 채널 등록 가이드
- [ ] 스킬 서버 API (`/api/webhooks/kakao/[botId]`)
- [ ] 블록형 응답 포맷 변환
- [ ] 채널 관리 UI 추가

### Phase 13: WeChat 연동
- [ ] 위챗 공식계정 개발자 설정
- [ ] XML 메시지 파싱·응답 핸들러
- [ ] 5초 타임아웃 대응 (비동기 응답)
- [ ] 채널 관리 UI 추가

### Phase 14: 팀 관리
- [ ] 팀원 초대 (이메일 초대링크)
- [ ] 역할 권한 매트릭스 (Owner/Editor/Viewer)
- [ ] 팀원별 활동 로그
- [ ] 팀 관리 UI

### Phase 15: 고급 분석
- [ ] 감성 분석 (LLM 기반 대화 감정 분류)
- [ ] 키워드 트렌드 차트
- [ ] 미답변 질문 자동 감지
- [ ] 커스텀 리포트 PDF 생성 (Enterprise)

### Phase 16: 추가 파일 포맷
- [ ] DOCX 파서 (mammoth 라이브러리)
- [ ] XLSX 파서 (xlsx 라이브러리)
- [ ] HWP 파서 (hwp.js)
- [ ] CSV 파서 (papaparse)
- [ ] Markdown 파서

### Phase 17: 자동 재크롤링
- [ ] URL 소스 주기적 크롤링 (Vercel Cron 또는 Inngest)
- [ ] 변경 감지 → 자동 재임베딩
- [ ] 크롤링 이력 관리

### Phase 18: Enterprise 기능
- [ ] BYO API Key (사용자 OpenAI/Anthropic 키 등록)
- [ ] 커스텀 도메인 (봇별)
- [ ] SSO/SAML 인증
- [ ] 전용 지원 채널

---

## 진행 상황 요약

| Phase | 설명 | 기간 | 상태 | 의존 |
|-------|------|------|------|------|
| 1 | 스캐폴드 + DB + 인증 | 1주 | `[x]` | — |
| 2 | 봇 CRUD + 지식베이스 | 2주 | `[x]` | Phase 1 |
| 3 | 채팅 + 위젯 | 1주 | `[x]` | Phase 2 |
| 4 | Paddle 결제 | 2주 | `[ ]` | Phase 1 |
| 5 | Telegram 채널 | 1주 | `[ ]` | Phase 3 |
| 6 | 플랜 제한 + 사용량 | 1주 | `[ ]` | Phase 3, 4 |
| 7 | Owner 대시보드 | 2주 | `[ ]` | Phase 3, 4 |
| 8 | Public API | 1주 | `[ ]` | Phase 3, 6, 7 |
| 9 | 시스템 관리자 | 1주 | `[ ]` | Phase 6, 7 |
| 10 | 랜딩 + 마케팅 | 1주 | `[ ]` | — (병렬) |
| 11 | 테스트 + 배포 | 1주 | `[ ]` | 전체 |
| **합계** | | **14주** | | |

---

## 병렬 실행 가능 조합

```
Week 1:   Phase 1 (스캐폴드+DB+인증)
Week 2-3: Phase 2 (봇+지식베이스) ║ Phase 4 시작 (Paddle 설정)
Week 4:   Phase 3 (채팅+위젯)     ║ Phase 4 계속 (Webhook)
Week 5:   Phase 5 (Telegram)      ║ Phase 6 (플랜제한) ║ Phase 10 (랜딩)
Week 6-7: Phase 7 (대시보드)      ║ Phase 10 계속
Week 8:   Phase 8 (API)           ║ Phase 9 (관리자)
Week 9:   Phase 11 (테스트+배포)
```

**병렬 실행 시 약 9주 (2.3개월)**로 단축 가능.
