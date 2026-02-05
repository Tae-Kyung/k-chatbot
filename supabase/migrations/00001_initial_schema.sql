-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Universities table
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_en text not null,
  logo_url text,
  primary_color text not null default '#0066CC',
  secondary_color text not null default '#004499',
  messenger_links jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Admin profiles table
create table public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  unique(user_id)
);

-- Documents table
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text,
  status text not null default 'pending',
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Document chunks table with vector embedding
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  content text not null,
  metadata jsonb default '{}',
  embedding extensions.vector(1536)
);

-- Create index for vector similarity search
create index on public.document_chunks using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 100);

-- Conversations table
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  language text not null default 'ko',
  created_at timestamptz not null default now()
);

-- Messages table
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null,
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

-- Feedback table
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

-- RPC function for vector similarity search
create or replace function public.match_documents(
  query_embedding extensions.vector(1536),
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
    dc.id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where (filter_university_id is null or dc.university_id = filter_university_id)
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Row Level Security policies

-- Universities: public read
alter table public.universities enable row level security;
create policy "Universities are publicly readable" on public.universities for select using (true);
create policy "Admins can update their university" on public.universities for update using (
  exists (select 1 from public.admin_profiles where user_id = auth.uid() and university_id = universities.id)
);

-- Admin profiles: only own profile
alter table public.admin_profiles enable row level security;
create policy "Admins can read own profile" on public.admin_profiles for select using (user_id = auth.uid());

-- Documents: university-scoped for admins, no public access
alter table public.documents enable row level security;
create policy "Admins can CRUD own university documents" on public.documents for all using (
  exists (select 1 from public.admin_profiles where user_id = auth.uid() and university_id = documents.university_id)
);

-- Document chunks: university-scoped
alter table public.document_chunks enable row level security;
create policy "Admins can manage own university chunks" on public.document_chunks for all using (
  exists (select 1 from public.admin_profiles where user_id = auth.uid() and university_id = document_chunks.university_id)
);
create policy "Service role can read all chunks" on public.document_chunks for select using (true);

-- Conversations: public insert/select
alter table public.conversations enable row level security;
create policy "Anyone can create conversations" on public.conversations for insert with check (true);
create policy "Anyone can read conversations" on public.conversations for select using (true);

-- Messages: public insert/select
alter table public.messages enable row level security;
create policy "Anyone can create messages" on public.messages for insert with check (true);
create policy "Anyone can read messages" on public.messages for select using (true);

-- Feedback: public insert, admin select
alter table public.feedback enable row level security;
create policy "Anyone can create feedback" on public.feedback for insert with check (true);
create policy "Admins can read feedback" on public.feedback for select using (
  exists (
    select 1 from public.admin_profiles ap
    join public.messages m on m.id = feedback.message_id
    join public.conversations c on c.id = m.conversation_id
    where ap.user_id = auth.uid() and c.university_id = ap.university_id
  )
);
