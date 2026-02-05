-- Seed data: 3 universities
insert into public.universities (id, name, name_en, logo_url, primary_color, secondary_color, messenger_links) values
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '충북대학교',
  'Chungbuk National University',
  '/logos/cbnu.png',
  '#004B8D',
  '#003366',
  '{"kakao": "https://pf.kakao.com/cbnu", "telegram": "https://t.me/cbnu_bot"}'
),
(
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  '한국교통대학교',
  'Korea National University of Transportation',
  '/logos/knut.png',
  '#1B5E20',
  '#0D3B13',
  '{"kakao": "https://pf.kakao.com/knut", "telegram": "https://t.me/knut_bot"}'
),
(
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  '한국교원대학교',
  'Korea National University of Education',
  '/logos/knue.png',
  '#8B0000',
  '#5C0000',
  '{"kakao": "https://pf.kakao.com/knue", "telegram": "https://t.me/knue_bot"}'
);
