create extension if not exists vector with schema extensions;

create type public.app_role as enum ('admin','teacher','student','parent');
create type public.content_status as enum ('draft','approved','published','rejected');
create type public.course_status as enum ('draft','published','archived');
create type public.doc_category as enum ('curriculum','previous_exams','other');
create type public.doc_status as enum ('pending','uploaded','processing','processed','failed');
create type public.job_status as enum ('queued','running','succeeded','failed');
create type public.link_status as enum ('pending','approved','rejected');

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;

create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, email text, full_name text, avatar_url text, ui_locale text not null default 'ar', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.user_roles(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, role public.app_role not null, created_at timestamptz not null default now(), unique(user_id,role));
create table public.role_choices(user_id uuid primary key, chosen_at timestamptz not null default now());
create table public.parent_links(id uuid primary key default gen_random_uuid(), parent_id uuid not null, student_id uuid not null, status public.link_status not null default 'approved', created_at timestamptz not null default now(), unique(parent_id,student_id));
create table public.student_link_codes(student_id uuid primary key, code text not null unique, expires_at timestamptz not null default now()+interval '7 days', created_at timestamptz not null default now());
grant select, update on public.profiles to authenticated; grant all on public.profiles to service_role;
grant select on public.user_roles, public.role_choices, public.parent_links, public.student_link_codes to authenticated;
grant all on public.user_roles, public.role_choices, public.parent_links, public.student_link_codes to service_role;
alter table public.profiles enable row level security; alter table public.user_roles enable row level security; alter table public.role_choices enable row level security; alter table public.parent_links enable row level security; alter table public.student_link_codes enable row level security;

create or replace function public.has_role(_user_id uuid,_role public.app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create or replace function public.is_parent_of(_student_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.parent_links where parent_id=auth.uid() and student_id=_student_id and status='approved') $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id=auth.uid());
create policy "own choice" on public.role_choices for select to authenticated using (user_id=auth.uid());
create policy "own profile read" on public.profiles for select to authenticated using (id=auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy "parents read child profile" on public.profiles for select to authenticated using (public.is_parent_of(id));
create policy "links read" on public.parent_links for select to authenticated using (parent_id=auth.uid() or student_id=auth.uid());
create policy "own code" on public.student_link_codes for select to authenticated using (student_id=auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,avatar_url) values (new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),new.raw_user_meta_data->>'avatar_url') on conflict (id) do nothing;
  insert into public.user_roles(user_id,role) values (new.id,'student') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.choose_my_role(_role public.app_role) returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if _role='admin' then raise exception 'not allowed'; end if;
  if exists(select 1 from public.role_choices where user_id=auth.uid()) then raise exception 'role already chosen'; end if;
  delete from public.user_roles where user_id=auth.uid() and role<>'admin';
  insert into public.user_roles(user_id,role) values (auth.uid(),_role) on conflict do nothing;
  insert into public.role_choices(user_id) values (auth.uid());
end $$;

create table public.organizations(id uuid primary key default gen_random_uuid(), name text not null, slug text unique, created_by uuid not null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.organization_members(id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null, role public.app_role not null default 'teacher', created_at timestamptz not null default now(), unique(org_id,user_id));
grant select,insert,update,delete on public.organizations, public.organization_members to authenticated; grant all on public.organizations, public.organization_members to service_role;
alter table public.organizations enable row level security; alter table public.organization_members enable row level security;
create or replace function public.is_org_member(_org_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.organization_members where org_id=_org_id and user_id=auth.uid()) $$;
create policy "org read" on public.organizations for select to authenticated using (created_by=auth.uid() or public.is_org_member(id));
create policy "org create" on public.organizations for insert to authenticated with check (created_by=auth.uid());
create policy "org update" on public.organizations for update to authenticated using (created_by=auth.uid());
create policy "org members read" on public.organization_members for select to authenticated using (user_id=auth.uid() or public.is_org_member(org_id));
create policy "org members manage" on public.organization_members for all to authenticated using (exists(select 1 from public.organizations o where o.id=org_id and o.created_by=auth.uid())) with check (exists(select 1 from public.organizations o where o.id=org_id and o.created_by=auth.uid()));

create table public.courses(id uuid primary key default gen_random_uuid(), teacher_id uuid not null default auth.uid(), org_id uuid references public.organizations(id) on delete set null, title text not null, description text, subject text, grade_level text, content_language text not null default 'ar', cover_color text, status public.course_status not null default 'draft', join_code text unique default upper(substr(md5(gen_random_uuid()::text),1,6)), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.classes(id uuid primary key default gen_random_uuid(), teacher_id uuid not null default auth.uid(), org_id uuid references public.organizations(id) on delete set null, name text not null, grade_level text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.class_members(id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade, student_id uuid not null, created_at timestamptz not null default now(), unique(class_id,student_id));
create table public.enrollments(id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, student_id uuid not null, class_id uuid references public.classes(id) on delete set null, created_at timestamptz not null default now(), unique(course_id,student_id));
grant select,insert,update,delete on public.courses, public.classes, public.class_members, public.enrollments to authenticated; grant all on public.courses, public.classes, public.class_members, public.enrollments to service_role;
alter table public.courses enable row level security; alter table public.classes enable row level security; alter table public.class_members enable row level security; alter table public.enrollments enable row level security;

create or replace function public.is_course_teacher(_course_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.courses where id=_course_id and teacher_id=auth.uid()) or public.has_role(auth.uid(),'admin') $$;
create or replace function public.is_class_teacher(_class_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.classes where id=_class_id and teacher_id=auth.uid()) $$;
create or replace function public.is_enrolled(_course_id uuid,_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.enrollments where course_id=_course_id and student_id=_user_id) $$;
create or replace function public.course_is_published(_course_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.courses where id=_course_id and status='published') $$;
create or replace function public.can_read_course_content(_course_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select public.is_course_teacher(_course_id) or (public.is_enrolled(_course_id) and public.course_is_published(_course_id)) $$;

create policy "teacher manages course" on public.courses for all to authenticated using (teacher_id=auth.uid() or public.has_role(auth.uid(),'admin')) with check (teacher_id=auth.uid() and (public.has_role(auth.uid(),'teacher') or public.has_role(auth.uid(),'admin')));
create policy "enrolled reads published" on public.courses for select to authenticated using (status='published' and public.is_enrolled(id));
create policy "classes teacher" on public.classes for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "classes member read" on public.classes for select to authenticated using (exists(select 1 from public.class_members m where m.class_id=classes.id and m.student_id=auth.uid()));
create policy "class members teacher" on public.class_members for all to authenticated using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
create policy "class members self" on public.class_members for select to authenticated using (student_id=auth.uid());
create policy "enroll read" on public.enrollments for select to authenticated using (student_id=auth.uid() or public.is_course_teacher(course_id));
create policy "enroll teacher delete" on public.enrollments for delete to authenticated using (public.is_course_teacher(course_id));
create policy "teachers read student profile" on public.profiles for select to authenticated using (exists(select 1 from public.enrollments e join public.courses c on c.id=e.course_id where e.student_id=profiles.id and c.teacher_id=auth.uid()));

create or replace function public.join_course(_code text) returns uuid language plpgsql security definer set search_path=public as $$
declare _cid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into _cid from public.courses where upper(join_code)=upper(trim(_code)) and status='published';
  if _cid is null then raise exception 'invalid code'; end if;
  insert into public.enrollments(course_id,student_id) values (_cid,auth.uid()) on conflict do nothing;
  return _cid;
end $$;

create table public.documents(id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, uploaded_by uuid not null default auth.uid(), file_name text not null, storage_path text not null, mime_type text, size_bytes bigint, page_count int, category public.doc_category not null default 'curriculum', processing_status public.doc_status not null default 'pending', processing_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.units(id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, title text not null, description text, position int not null default 0, status public.content_status not null default 'draft', confidence numeric, source_document_id uuid references public.documents(id) on delete set null, source_page int, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.lessons(id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, unit_id uuid not null references public.units(id) on delete cascade, title text not null, summary text, position int not null default 0, status public.content_status not null default 'draft', confidence numeric, source_document_id uuid references public.documents(id) on delete set null, source_page int, source_quote text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.objectives(id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, lesson_id uuid references public.lessons(id) on delete cascade, code text, description text not null, skill text, status public.content_status not null default 'draft', confidence numeric, source_document_id uuid references public.documents(id) on delete set null, source_page int, source_quote text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.content_items(id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, lesson_id uuid not null references public.lessons(id) on delete cascade, kind text not null default 'text', title text, body text, position int not null default 0, status public.content_status not null default 'draft', confidence numeric, source_document_id uuid references public.documents(id) on delete set null, source_page int, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.activities(id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, lesson_id uuid references public.lessons(id) on delete set null, title text not null, instructions text, kind text not null default 'quiz', position int not null default 0, status public.content_status not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.questions(id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, activity_id uuid not null references public.activities(id) on delete cascade, objective_id uuid references public.objectives(id) on delete set null, kind text not null default 'mcq', stem text not null, options jsonb, correct_answer jsonb, explanation text, difficulty text not null default 'medium', points numeric not null default 1, position int not null default 0, status public.content_status not null default 'draft', confidence numeric, verification jsonb, source_document_id uuid references public.documents(id) on delete set null, source_page int, source_quote text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select,insert,update,delete on public.documents, public.units, public.lessons, public.objectives, public.content_items, public.activities, public.questions to authenticated;
grant all on public.documents, public.units, public.lessons, public.objectives, public.content_items, public.activities, public.questions to service_role;
alter table public.documents enable row level security; alter table public.units enable row level security; alter table public.lessons enable row level security; alter table public.objectives enable row level security; alter table public.content_items enable row level security; alter table public.activities enable row level security; alter table public.questions enable row level security;
create policy "docs teacher" on public.documents for all to authenticated using (public.is_course_teacher(course_id)) with check (public.is_course_teacher(course_id));
do $$ declare t text; begin foreach t in array array['units','lessons','objectives','content_items','activities'] loop
  execute format('create policy "teacher manages" on public.%I for all to authenticated using (public.is_course_teacher(course_id)) with check (public.is_course_teacher(course_id))',t);
  execute format('create policy "students read published" on public.%I for select to authenticated using (status=''published'' and public.can_read_course_content(course_id))',t);
end loop; end $$;
create policy "teacher manages" on public.questions for all to authenticated using (public.is_course_teacher(course_id)) with check (public.is_course_teacher(course_id));

create table public.ai_jobs(id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, document_id uuid references public.documents(id) on delete cascade, created_by uuid not null default auth.uid(), job_type text not null, status public.job_status not null default 'queued', provider text, model text, result jsonb, error text, started_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.ai_feedback(id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, question_id uuid references public.questions(id) on delete set null, teacher_id uuid not null default auth.uid(), decision text not null, reason text, snapshot jsonb, created_at timestamptz not null default now());
create table public.source_pages(id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id) on delete cascade, page_number int not null, text_content text, needs_ocr boolean not null default false, created_at timestamptz not null default now());
create table public.source_chunks(id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id) on delete cascade, course_id uuid not null references public.courses(id) on delete cascade, page_number int not null, chunk_index int not null, content text not null, embedding extensions.vector, created_at timestamptz not null default now());
grant select,insert,update,delete on public.ai_jobs, public.ai_feedback, public.source_pages, public.source_chunks to authenticated;
grant all on public.ai_jobs, public.ai_feedback, public.source_pages, public.source_chunks to service_role;
alter table public.ai_jobs enable row level security; alter table public.ai_feedback enable row level security; alter table public.source_pages enable row level security; alter table public.source_chunks enable row level security;
create policy "jobs teacher" on public.ai_jobs for all to authenticated using (public.is_course_teacher(course_id)) with check (public.is_course_teacher(course_id));
create policy "feedback teacher" on public.ai_feedback for all to authenticated using (public.is_course_teacher(course_id)) with check (public.is_course_teacher(course_id) and teacher_id=auth.uid());
create policy "pages teacher" on public.source_pages for select to authenticated using (exists(select 1 from public.documents d where d.id=document_id and public.is_course_teacher(d.course_id)));
create policy "chunks teacher" on public.source_chunks for select to authenticated using (public.is_course_teacher(course_id));

create or replace function public.match_source_chunks(_course_id uuid,_query text,_count int default 8) returns table(id uuid,document_id uuid,page_number int,content text,similarity double precision) language sql stable security definer set search_path=public,extensions as $$
  select c.id,c.document_id,c.page_number,c.content, 1-(c.embedding <=> _query::extensions.vector) as similarity
  from public.source_chunks c where c.course_id=_course_id and c.embedding is not null and extensions.vector_dims(c.embedding)=extensions.vector_dims(_query::extensions.vector)
  order by c.embedding <=> _query::extensions.vector limit _count $$;
revoke execute on function public.match_source_chunks(uuid,text,int) from public, anon, authenticated;
grant execute on function public.match_source_chunks(uuid,text,int) to service_role;

create table public.attempts(id uuid primary key default gen_random_uuid(), activity_id uuid not null references public.activities(id) on delete cascade, course_id uuid not null references public.courses(id) on delete cascade, student_id uuid not null, score numeric, max_score numeric, started_at timestamptz not null default now(), submitted_at timestamptz, teacher_comment text, commented_at timestamptz, created_at timestamptz not null default now());
create table public.answers(id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.attempts(id) on delete cascade, question_id uuid not null references public.questions(id) on delete cascade, student_id uuid not null, response jsonb, is_correct boolean, score numeric, created_at timestamptz not null default now());
create table public.mastery_records(id uuid primary key default gen_random_uuid(), student_id uuid not null, course_id uuid not null references public.courses(id) on delete cascade, objective_id uuid references public.objectives(id) on delete cascade, skill text, mastery numeric not null default 0, evidence_count int not null default 0, correct_count int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.retake_grants(id uuid primary key default gen_random_uuid(), activity_id uuid not null references public.activities(id) on delete cascade, student_id uuid not null, granted_by uuid not null, created_at timestamptz not null default now(), consumed_at timestamptz, unique(activity_id,student_id));
create table public.notifications(id uuid primary key default gen_random_uuid(), user_id uuid not null, kind text not null default 'info', title text not null, body text, link text, read_at timestamptz, created_at timestamptz not null default now());
grant select on public.attempts, public.answers, public.mastery_records to authenticated;
grant select,insert,update,delete on public.retake_grants to authenticated;
grant select,update on public.notifications to authenticated;
grant all on public.attempts, public.answers, public.mastery_records, public.retake_grants, public.notifications to service_role;
alter table public.attempts enable row level security; alter table public.answers enable row level security; alter table public.mastery_records enable row level security; alter table public.retake_grants enable row level security; alter table public.notifications enable row level security;
create policy "attempts read" on public.attempts for select to authenticated using (student_id=auth.uid() or public.is_course_teacher(course_id) or public.is_parent_of(student_id));
create policy "answers read" on public.answers for select to authenticated using (student_id=auth.uid() or exists(select 1 from public.attempts a where a.id=attempt_id and public.is_course_teacher(a.course_id)));
create policy "mastery read" on public.mastery_records for select to authenticated using (student_id=auth.uid() or public.is_course_teacher(course_id) or public.is_parent_of(student_id));
create policy "student reads own grants" on public.retake_grants for select to authenticated using (student_id=auth.uid());
create policy "teacher manages grants" on public.retake_grants for all to authenticated using (exists(select 1 from public.activities a where a.id=activity_id and public.is_course_teacher(a.course_id))) with check (exists(select 1 from public.activities a where a.id=activity_id and public.is_course_teacher(a.course_id)));
create policy "own notifications" on public.notifications for select to authenticated using (user_id=auth.uid());
create policy "mark own read" on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create or replace function public.get_my_link_code(_regenerate boolean default false) returns text language plpgsql security definer set search_path=public as $$
declare _c text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select code into _c from public.student_link_codes where student_id=auth.uid() and expires_at>now();
  if _c is null or _regenerate then
    _c := upper(substr(md5(gen_random_uuid()::text),1,8));
    insert into public.student_link_codes(student_id,code,expires_at) values (auth.uid(),_c,now()+interval '7 days')
      on conflict (student_id) do update set code=excluded.code, expires_at=excluded.expires_at, created_at=now();
  end if;
  return _c;
end $$;
create or replace function public.redeem_link_code(_code text) returns uuid language plpgsql security definer set search_path=public as $$
declare _sid uuid;
begin
  if not public.has_role(auth.uid(),'parent') then raise exception 'parents only'; end if;
  select student_id into _sid from public.student_link_codes where code=upper(trim(_code)) and expires_at>now();
  if _sid is null then raise exception 'invalid code'; end if;
  insert into public.parent_links(parent_id,student_id,status) values (auth.uid(),_sid,'approved') on conflict (parent_id,student_id) do update set status='approved';
  delete from public.student_link_codes where student_id=_sid;
  return _sid;
end $$;
create or replace function public.list_my_children() returns table(student_id uuid,full_name text,email text,linked_at timestamptz) language sql stable security definer set search_path=public as $$
  select l.student_id,p.full_name,p.email,l.created_at from public.parent_links l left join public.profiles p on p.id=l.student_id where l.parent_id=auth.uid() and l.status='approved' order by l.created_at $$;

CREATE OR REPLACE FUNCTION public.child_report(_student_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.is_parent_of(_student_id) THEN RAISE EXCEPTION 'not linked'; END IF;
  RETURN jsonb_build_object(
    'courses', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'subject',c.subject,
        'activities',(SELECT count(*) FROM public.activities a WHERE a.course_id=c.id AND a.status='published'),
        'completed',(SELECT count(DISTINCT at.activity_id) FROM public.attempts at WHERE at.course_id=c.id AND at.student_id=_student_id AND at.submitted_at IS NOT NULL))
      ORDER BY c.title) FROM public.enrollments e JOIN public.courses c ON c.id=e.course_id WHERE e.student_id=_student_id), '[]'::jsonb),
    'attempts', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'submitted_at' DESC) FROM (
        SELECT jsonb_build_object('id',at.id,'activity',a.title,'course',c.title,'score',at.score,'max_score',at.max_score,'submitted_at',at.submitted_at,'teacher_comment',at.teacher_comment) x
        FROM public.attempts at JOIN public.activities a ON a.id=at.activity_id JOIN public.courses c ON c.id=at.course_id
        WHERE at.student_id=_student_id AND at.submitted_at IS NOT NULL ORDER BY at.submitted_at DESC LIMIT 30) s), '[]'::jsonb),
    'mastery', COALESCE((SELECT jsonb_agg(jsonb_build_object('label',COALESCE(o.description,m.skill,'مهارة عامة'),'course',c.title,
        'mastery',m.mastery,'evidence',m.evidence_count,'correct',m.correct_count) ORDER BY m.mastery DESC)
      FROM public.mastery_records m JOIN public.courses c ON c.id=m.course_id LEFT JOIN public.objectives o ON o.id=m.objective_id
      WHERE m.student_id=_student_id), '[]'::jsonb)
  );
END; $function$;

do $$ declare t text; begin foreach t in array array['profiles','organizations','courses','classes','documents','units','lessons','objectives','content_items','activities','questions','ai_jobs','mastery_records'] loop
  execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()',t);
end loop; end $$;

create policy "teacher upload course docs" on storage.objects for insert to authenticated with check (bucket_id='course-documents' and public.is_course_teacher(((storage.foldername(name))[1])::uuid));
create policy "teacher read course docs" on storage.objects for select to authenticated using (bucket_id='course-documents' and public.is_course_teacher(((storage.foldername(name))[1])::uuid));
create policy "teacher update course docs" on storage.objects for update to authenticated using (bucket_id='course-documents' and public.is_course_teacher(((storage.foldername(name))[1])::uuid));
create policy "teacher delete course docs" on storage.objects for delete to authenticated using (bucket_id='course-documents' and public.is_course_teacher(((storage.foldername(name))[1])::uuid));