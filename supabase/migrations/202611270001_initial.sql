create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
set search_path = public, extensions;

create table tnved_versions (
  id uuid primary key default gen_random_uuid(),
  version_name text not null,
  effective_from date not null,
  effective_to date,
  source_url text not null check (source_url like 'https://%'),
  source_checksum text not null unique check (source_checksum ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  check (effective_to is null or effective_to >= effective_from)
);
create unique index tnved_one_active on tnved_versions(status) where status='active';
create table tnved_codes (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references tnved_versions,
  external_key text not null,
  code text check (code ~ '^[0-9]{2,10}$'),
  title text not null,
  full_description text not null,
  parent_id uuid,
  level smallint not null check (level between 0 and 12),
  section_key text not null,
  group_code text,
  is_leaf boolean not null,
  sort_order integer not null,
  valid_from date,
  valid_to date,
  notes text,
  source_url text check (source_url like 'https://%'),
  created_at timestamptz not null default now(),
  unique(version_id,external_key),
  unique(version_id,id),
  foreign key(version_id,parent_id) references tnved_codes(version_id,id),
  check (not is_leaf or (code is not null and length(code)=10)),
  check (valid_to is null or valid_from is null or valid_to>=valid_from)
);
create unique index tnved_leaf_code on tnved_codes(version_id,code) where is_leaf;
create index tnved_parent on tnved_codes(version_id,parent_id,sort_order,id);
create index tnved_prefix on tnved_codes(version_id,code text_pattern_ops);
create index tnved_title_trgm on tnved_codes using gin (translate(lower(title),'ё','е') gin_trgm_ops);
create index tnved_title_fts on tnved_codes using gin (to_tsvector('russian',translate(lower(title),'ё','е')));
create index tnved_fts on tnved_codes using gin (to_tsvector('russian',translate(lower(full_description),'ё','е')));
create table legal_documents (
  id uuid primary key default gen_random_uuid(),
  country text not null check (country in ('BY','RU','EAEU')),
  document_type text not null,
  title text not null,
  document_number text,
  document_date date,
  effective_from date,
  effective_to date,
  content text,
  source_url text not null check (source_url like 'https://%'),
  created_at timestamptz not null default now()
);
create table code_documents (code_id uuid references tnved_codes on delete cascade, document_id uuid references legal_documents on delete cascade, primary key(code_id,document_id));
create table code_synonyms (code_id uuid references tnved_codes on delete cascade, synonym text not null, primary key(code_id,synonym));
create index tnved_synonym_fts on code_synonyms using gin (to_tsvector('russian',translate(lower(synonym),'ё','е')));
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text check(length(full_name)<=100),
  default_country text not null default 'BY' check(default_country in ('BY','RU')),
  theme text not null default 'light' check(theme in ('light','dark')),
  created_at timestamptz not null default now()
);
create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  code_id uuid not null references tnved_codes,
  created_at timestamptz not null default now(),
  unique(user_id,code_id)
);
create table search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  query text not null check(length(query) between 1 and 160),
  country text not null check(country in ('BY','RU')),
  created_at timestamptz not null default now()
);
create index history_owner_date on search_history(user_id,created_at desc,id);
create index favorites_owner_date on favorites(user_id,created_at desc,id);

alter table tnved_versions enable row level security;
alter table tnved_codes enable row level security;
alter table legal_documents enable row level security;
alter table code_documents enable row level security;
alter table code_synonyms enable row level security;
alter table profiles enable row level security;
alter table favorites enable row level security;
alter table search_history enable row level security;
create policy versions_read on tnved_versions for select to anon,authenticated using(status<>'draft');
create policy codes_read on tnved_codes for select to anon,authenticated using(exists(select 1 from tnved_versions v where v.id=version_id and v.status<>'draft'));
create policy documents_read on legal_documents for select to anon,authenticated using(true);
create policy code_documents_read on code_documents for select to anon,authenticated using(exists(select 1 from tnved_codes c where c.id=code_id));
create policy synonyms_read on code_synonyms for select to anon,authenticated using(exists(select 1 from tnved_codes c where c.id=code_id));
create policy profiles_owner on profiles to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy favorites_owner on favorites to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and exists(select 1 from tnved_codes c where c.id=code_id));
create policy history_owner on search_history to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on tnved_versions,tnved_codes,legal_documents,code_documents,code_synonyms from anon,authenticated;
grant select on tnved_versions,tnved_codes,legal_documents,code_documents,code_synonyms to anon,authenticated;
revoke all on profiles,favorites,search_history from anon,authenticated;
grant select,insert,update,delete on profiles,favorites,search_history to authenticated;
grant all on tnved_versions,tnved_codes,legal_documents,code_documents,code_synonyms to service_role;

create view public_tnved_codes with (security_invoker=true) as
select c.*, p.title as parent_title, v.version_name
from tnved_codes c join tnved_versions v on v.id=c.version_id
left join tnved_codes p on p.id=c.parent_id
where v.status='active';
grant select on public_tnved_codes to anon,authenticated;

create function search_tnved_codes(query text, page_number integer, group_code text, section_key text, code_status text)
returns setof public_tnved_codes language sql stable
set search_path=public,extensions
as $$
  with terms as (
    select translate(lower(trim(left(query,160))),'ё','е') as term,
      regexp_replace(trim(left(query,160)),'[[:space:]]','','g') as digits
  ), ranked as (
    select c as row_value, c.sort_order,c.id,
      case
        when t.term='' then 1
        when t.digits ~ '^[0-9]+$' then case when c.code=t.digits then 8 when c.code like t.digits||'%' then 7 else 0 end
        when translate(lower(c.title),'ё','е')=t.term then 6
        when to_tsvector('russian',translate(lower(c.title),'ё','е')) @@ plainto_tsquery('russian',t.term) then 5
        when to_tsvector('russian',translate(lower(c.full_description),'ё','е')) @@ plainto_tsquery('russian',t.term) then 4
        when exists(select 1 from code_synonyms s where s.code_id=c.id and to_tsvector('russian',translate(lower(s.synonym),'ё','е')) @@ plainto_tsquery('russian',t.term)) then 3
        when length(t.term)>=4 and t.term <% translate(lower(c.title),'ё','е') then 2
        else 0
      end as rank
    from public_tnved_codes c cross join terms t
    where ($3='' or c.group_code=$3) and ($4='' or c.section_key=$4)
      and (t.term='' or (t.digits ~ '^[0-9]+$' and c.code like t.digits||'%')
        or (t.digits !~ '^[0-9]+$' and (
          translate(lower(c.title),'ё','е')=t.term
          or to_tsvector('russian',translate(lower(c.title),'ё','е')) @@ plainto_tsquery('russian',t.term)
          or to_tsvector('russian',translate(lower(c.full_description),'ё','е')) @@ plainto_tsquery('russian',t.term)
          or exists(select 1 from code_synonyms s where s.code_id=c.id and to_tsvector('russian',translate(lower(s.synonym),'ё','е')) @@ plainto_tsquery('russian',t.term))
          or (length(t.term)>=4 and t.term <% translate(lower(c.title),'ё','е'))
        )))
      and ($5='all' or ($5='active' and (c.valid_from is null or c.valid_from<=current_date) and (c.valid_to is null or c.valid_to>=current_date))
        or ($5='expired' and c.valid_to<current_date))
  )
  select (row_value).* from ranked where rank>0 order by rank desc,sort_order,id
  offset (greatest(1,least(1000,page_number))-1)*20 limit 21;
$$;
revoke all on function search_tnved_codes(text,integer,text,text,text) from public;
grant execute on function search_tnved_codes(text,integer,text,text,text) to anon,authenticated;

create function clear_my_data() returns void language plpgsql set search_path=public as $$
begin
  delete from favorites where user_id=auth.uid();
  delete from search_history where user_id=auth.uid();
  delete from profiles where id=auth.uid();
end;
$$;
revoke all on function clear_my_data() from public;
grant execute on function clear_my_data() to authenticated;

create function activate_tnved(target uuid, expected_count integer) returns void language plpgsql set search_path=public as $$
begin
  perform pg_advisory_xact_lock(270001);
  if expected_count<=0 or (select count(*) from tnved_codes where version_id=target)<>expected_count
    or not exists(select 1 from tnved_codes where version_id=target and is_leaf)
    or not exists(select 1 from tnved_versions where id=target and effective_from<=current_date and (effective_to is null or effective_to>=current_date)) then
    raise exception 'Version failed activation checks';
  end if;
  update tnved_versions set status='archived' where status='active' and id<>target;
  update tnved_versions set status='active' where id=target;
end;
$$;
revoke all on function activate_tnved(uuid,integer) from public;
grant execute on function activate_tnved(uuid,integer) to service_role;
