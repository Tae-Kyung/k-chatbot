# K-Student Success AI Guide

한국 대학교 유학생을 위한 RAG 기반 AI 챗봇 플랫폼입니다. 대학별 맞춤 정보를 다국어로 제공합니다.

## 주요 기능

- **AI 챗봇** - RAG 기반 스트리밍 응답, 대학별 맞춤 정보 제공
- **다국어 지원** - 한국어, English, 中文, Tiếng Việt, Монгол, ភាសាខ្មែរ
- **관리자 대시보드** - 통계, 문서 관리(CRUD), 리뷰 관리
- **임베딩 위젯** - iframe 기반, 외부 사이트에 삽입 가능한 채팅 위젯
- **RAG 파이프라인** - 문서 파싱, 청킹, 임베딩, 시맨틱 검색

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| 스타일링 | Tailwind CSS 4 |
| 백엔드/DB | Supabase (Auth, PostgreSQL + pgvector, Storage, RLS) |
| 상태 관리 | Zustand |
| AI/LLM | OpenAI SDK |
| 국제화 | next-intl |
| 차트 | Recharts |
| 테스트 | Vitest + Testing Library |

## 프로젝트 구조

```
src/
├── app/
│   ├── admin/          # 관리자 대시보드 페이지
│   ├── api/            # API 라우트 (chat, admin, feedback)
│   ├── chat/           # 채팅 페이지
│   ├── privacy/        # 개인정보처리방침
│   └── widget/         # 임베딩 위젯 페이지
├── components/         # 공통 컴포넌트
├── config/             # 앱 설정
├── features/
│   ├── chat/           # 채팅 UI 컴포넌트 및 스토어
│   └── university/     # 대학별 테마 프로바이더
├── i18n/               # 국제화 설정 및 번역 파일
├── lib/
│   ├── api/            # API 응답 유틸리티
│   ├── auth/           # 인증 미들웨어
│   ├── rag/            # RAG 파이프라인 (parser, chunker, embeddings, search)
│   └── supabase/       # Supabase 클라이언트 (client, server, middleware)
└── types/              # TypeScript 타입 정의
```

## 시작하기

### 1. 환경 변수 설정

`.env.example`을 `.env.local`로 복사하고 값을 채워넣으세요.

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. 의존성 설치 및 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

### 3. 데이터베이스 설정

Supabase 프로젝트에서 `supabase/migrations/00001_initial_schema.sql`을 실행하고, `supabase/seed.sql`로 초기 대학 데이터를 삽입하세요.

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 실행 |
| `npm test` | 테스트 실행 |
| `npm run test:coverage` | 커버리지 포함 테스트 |

## 배포

Vercel에 배포할 수 있습니다. `vercel.json` 설정이 포함되어 있습니다.

## 지원 대학

- 충북대학교 (CBNU)
- 한국교통대학교 (KNUT)
- 한국교원대학교 (KNUE)
