-- Add suggested_questions column to rag_settings
ALTER TABLE rag_settings
ADD COLUMN suggested_questions jsonb DEFAULT '[]';

-- Seed CBNU with 6 Korean sample questions based on actual registered data
UPDATE rag_settings
SET suggested_questions = '[
  {"icon": "school", "text": "충북대학교는 어떤 대학교인가요?"},
  {"icon": "calendar", "text": "2026-1학기 수강신청 일정은 어떻게 되나요?"},
  {"icon": "document", "text": "외국인 유학생 관리규정에 대해 알려주세요"},
  {"icon": "document", "text": "다전공 이수 규정이 어떻게 되나요?"},
  {"icon": "people", "text": "부서별 담당자 연락처를 알려주세요"},
  {"icon": "building", "text": "창업 지원 프로그램에 대해 알려주세요"}
]'::jsonb
WHERE university_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
