create table if not exists users (
  college_id text primary key,
  name text not null,
  role text not null,
  department text,
  email text
);

create table if not exists events (
  id bigserial primary key,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  voting_status text not null default 'not_started'
);

alter table if exists events
  add column if not exists voting_status text not null default 'not_started';

create table if not exists candidates (
  id bigserial primary key,
  event_id bigint not null references events(id) on delete cascade,
  name text not null,
  description text,
  image_url text
);

create table if not exists vote_log (
  id bigserial primary key,
  college_id text not null references users(college_id),
  event_id bigint not null references events(id) on delete cascade,
  candidate_id bigint not null references candidates(id) on delete cascade,
  timestamp timestamptz default now(),
  unique(college_id, event_id)
);

create table if not exists vote_email_verifications (
  id bigserial primary key,
  event_id bigint not null references events(id) on delete cascade,
  college_id text not null references users(college_id) on delete cascade,
  email text not null,
  verification_code text not null,
  confirmation_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'verified', 'consumed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  consumed_at timestamptz
);

create index if not exists idx_vote_email_verifications_lookup
  on vote_email_verifications(event_id, college_id, confirmation_token);

create table if not exists program_registrations (
  id bigserial primary key,
  college_id text not null references users(college_id) on delete cascade,
  email text not null,
  confirmation_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index if not exists idx_program_registrations_unique_attendee
  on program_registrations(college_id);

create index if not exists idx_program_registrations_lookup
  on program_registrations(confirmation_token);

create index if not exists idx_program_registrations_email_lookup
  on program_registrations(email);
