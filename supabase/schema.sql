-- PROTOCOL schema. Run once in the Supabase SQL editor.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  age int not null check (age between 14 and 100),
  sex text not null check (sex in ('male','female')),
  height_in int not null,
  weight_lb numeric not null,
  objective text not null check (objective in ('shred','lose','build','maintain','rebuild')),
  days_per_week int not null check (days_per_week between 3 and 6),
  sport_per_week int not null check (sport_per_week between 0 and 3),
  equipment text not null check (equipment in ('gym','db','body')),
  experience text default 'consistent' check (experience in ('new','returning','consistent')),
  injury_text text default '',
  slack_daily boolean default false,
  slack_handle text default '',
  state jsonb default '{"week":1}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  weight numeric not null,
  waist numeric not null,
  energy int not null check (energy between 1 and 5),
  sleep int not null check (sleep between 1 and 5),
  soreness int not null check (soreness between 1 and 5),
  pain text default '',
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table checkins enable row level security;

create policy "own profile" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "own checkins" on checkins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
