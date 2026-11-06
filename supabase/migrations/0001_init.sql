-- ============================================================================
-- CONTINUUM ACADEMY — initial schema
--
-- Apply with the Supabase CLI:  supabase db push
-- or paste into the dashboard SQL editor.
--
-- Design rule: the browser is untrusted. Every table below is guarded by row
-- level security, so the anon key shipped in the client can only reach the rows
-- that belong to the signed-in member. Anything that needs a secret (video
-- signing, payments, admin writes) belongs in an edge function or route
-- handler — never in the page.
--
-- Before launch, in Authentication > Providers:
--   * enable "Confirm email"
--   * set the site URL to the deployed origin
--   * add <origin>/reset-password/ to the redirect allow list
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROFILES
-- One row per auth user. The display name lives in user metadata too, so the
-- header can render before the profile row is fetched.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'member'
                check (role in ('member', 'instructor', 'admin')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CATALOGUE
-- Mirrors assets/js/data/disciplines.js. Text ids keep the existing deep links
-- (discipline/?id=marketing) working after the move to the database.
-- ---------------------------------------------------------------------------
create table public.disciplines (
  id          text primary key,
  title       text not null,
  goal        text,
  blurb       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.videos (
  id              uuid primary key default gen_random_uuid(),
  discipline_id   text references public.disciplines (id) on delete set null,
  title           text not null,
  highlight       text,
  speaker         text,
  speaker_role    text,
  minutes         integer check (minutes is null or minutes > 0),
  tag             text,
  art             text,
  thumbnail_path  text,
  -- Mux / Cloudflare Stream asset id. Playback URLs are signed server-side and
  -- never stored here, so a copied link stops working when the token expires.
  playback_id     text,
  published       boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- MEMBER STATE
-- These three tables are what assets/js/store.js writes to today.
-- ---------------------------------------------------------------------------
create table public.watch_progress (
  user_id           uuid not null references auth.users (id) on delete cascade,
  video_id          uuid not null references public.videos (id) on delete cascade,
  position_seconds  integer not null default 0 check (position_seconds >= 0),
  completed         boolean not null default false,
  updated_at        timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table public.saved_videos (
  user_id     uuid not null references auth.users (id) on delete cascade,
  video_id    uuid not null references public.videos (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table public.video_likes (
  user_id     uuid not null references auth.users (id) on delete cascade,
  video_id    uuid not null references public.videos (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, video_id)
);

create index watch_progress_recent_idx on public.watch_progress (user_id, updated_at desc);
create index videos_discipline_idx on public.videos (discipline_id) where published;

-- ---------------------------------------------------------------------------
-- HELPERS
-- SECURITY DEFINER so the check itself is not blocked by the policies it feeds.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger watch_progress_touch
  before update on public.watch_progress
  for each row execute function public.touch_updated_at();

-- Profile row on sign-up, so a member is never half-created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.disciplines    enable row level security;
alter table public.videos         enable row level security;
alter table public.watch_progress enable row level security;
alter table public.saved_videos   enable row level security;
alter table public.video_likes    enable row level security;

-- profiles: read and rename yourself. Role is not yours to change, so the
-- column privilege is revoked — a policy alone would still allow it.
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on public.profiles from anon;
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select on public.profiles to authenticated;

-- catalogue: every signed-in member reads published content; admins write.
create policy "disciplines: read" on public.disciplines
  for select to authenticated
  using (true);

create policy "disciplines: admin write" on public.disciplines
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "videos: read published" on public.videos
  for select to authenticated
  using (published or public.is_admin());

create policy "videos: admin write" on public.videos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- member state: strictly your own rows, for read and write alike.
create policy "progress: own rows" on public.watch_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "saved: own rows" on public.saved_videos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "likes: own rows" on public.video_likes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- SEED — intentionally empty
--
-- The authored catalogue in assets/js/data/disciplines.js was cleared while the
-- new dataset is prepared, so no discipline rows are inserted here either. When
-- the real content arrives, add it in one place and keep both sides identical:
--
--   insert into public.disciplines (id, title, goal, blurb, sort_order) values
--     ('<id>', '<title>', '<goal>', '<blurb>', 1)
--   on conflict (id) do nothing;
--
-- Videos follow the same rule, and must be uploaded with published = false so a
-- draft never appears to a member mid-edit.
-- ---------------------------------------------------------------------------
