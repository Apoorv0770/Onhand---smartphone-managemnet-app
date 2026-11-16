-- =============================================================================
-- Onhand · 0001_init
-- Core schema, Row Level Security and the data API (RPC functions).
--
-- Tenancy model
--   * Every tenant-owned row carries business_id.
--   * A user reaches a business only through public.business_members.
--   * Row Level Security on every table is the security boundary. The functions
--     the app calls for private data are SECURITY INVOKER, so they can never do
--     more than the caller's own policies allow.
--   * Storefront visitors (the anon role) have no access to any table. They
--     read through four SECURITY DEFINER functions that return a fixed,
--     public-safe set of fields: no internal notes, no hidden prices and no
--     row ids. (A shop's photos are addressed by its storage folder, which is
--     named after the business id. That id is not a secret: it grants nothing.)
--
-- Requires PostgreSQL 15 or newer. Safe to run more than once.
-- Storage (bucket and object policies) lives in 0002_storage.sql.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Private schema and pure helpers
--    "private" is not exposed by the Data API, so nothing here is callable
--    over HTTP.
-- -----------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Calendar day in India Standard Time (fixed UTC+05:30, no daylight saving).
create or replace function private.ist_day(p_at timestamptz)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select ((p_at at time zone 'UTC') + interval '5 hours 30 minutes')::date
$$;

-- Timestamps leave the database exactly as JavaScript's toISOString() writes
-- them, so the app can compare and sort them as strings.
create or replace function private.iso(p_at timestamptz)
returns text
language sql
stable
parallel safe
set search_path = ''
as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- "Date added" chosen by the retailer: today or later means now, an earlier
-- day means noon IST on that day.
create or replace function private.created_at_for(p_added_on date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_added_on is null or p_added_on >= private.ist_day(now()) then now()
    else (p_added_on::timestamp + interval '6 hours 30 minutes') at time zone 'UTC'
  end
$$;

-- Storefront addresses the app keeps for its own routes.
-- Mirrors RESERVED_SLUGS in src/lib/schemas.ts.
create or replace function private.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_slug = any (array[
    'admin', 'api', 'app', 'dashboard', 'demo', 'help', 'login', 'new',
    'onboarding', 'onhand', 'settings', 'shop', 'signup', 'support', 'www'
  ])
$$;

-- Fills in any setting a row does not carry yet.
create or replace function private.business_settings(p_settings jsonb)
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  select '{"showPricesByDefault": true, "showSoldDevices": true, "coverStyle": "graphite", "hours": null, "onboardingCompletedAt": null}'::jsonb
    || coalesce(p_settings, '{}'::jsonb)
$$;

-- Shape check for businesses.settings (mirrors BusinessSettings in the app).
create or replace function private.valid_business_settings(p_settings jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_settings) = 'object'
    and octet_length(p_settings::text) <= 4096
    and (not p_settings ? 'coverStyle'
         or p_settings ->> 'coverStyle' in ('graphite', 'paper', 'ember', 'lagoon', 'moss', 'dusk'))
    and (not p_settings ? 'showPricesByDefault' or jsonb_typeof(p_settings -> 'showPricesByDefault') = 'boolean')
    and (not p_settings ? 'showSoldDevices' or jsonb_typeof(p_settings -> 'showSoldDevices') = 'boolean')
    and (not p_settings ? 'hours' or jsonb_typeof(p_settings -> 'hours') in ('object', 'null'))
    and (not p_settings ? 'onboardingCompletedAt'
         or jsonb_typeof(p_settings -> 'onboardingCompletedAt') in ('string', 'null')),
    false
  )
$$;

-- Images are stored as object paths inside the public "device-images" bucket,
-- always "<business id>/<uuid>.<ext>". Keeping a path (not a URL) means a row
-- can never point at another tenant's folder or at an outside host.
create or replace function private.owns_image_path(p_business_id uuid, p_path text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    p_path ~ ('^' || p_business_id::text
              || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
    false
  )
$$;

-- "iPhone 14 Pro · 256 GB · Deep Purple". Mirrors deviceLabel() in the app.
create or replace function private.device_label(p_brand text, p_model text, p_storage_gb integer, p_colour text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select concat_ws(
    ' · ',
    nullif(
      case
        when btrim(coalesce(p_brand, '')) = '' then btrim(coalesce(p_model, ''))
        when btrim(coalesce(p_model, '')) = '' then btrim(p_brand)
        when lower(btrim(p_brand)) = 'apple' then btrim(p_model)
        when left(lower(btrim(p_model)), char_length(btrim(p_brand))) = lower(btrim(p_brand)) then btrim(p_model)
        else btrim(p_brand) || ' ' || btrim(p_model)
      end,
      ''
    ),
    case
      when p_storage_gb is null or p_storage_gb = 0 then null
      when p_storage_gb >= 1024 and p_storage_gb % 1024 = 0 then (p_storage_gb / 1024)::text || ' TB'
      else p_storage_gb::text || ' GB'
    end,
    nullif(btrim(coalesce(p_colour, '')), '')
  )
$$;

create or replace function private.status_action(p_status text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_status
    when 'sold' then 'device_sold'
    when 'reserved' then 'device_reserved'
    else 'device_available'
  end
$$;

create or replace function private.jsonb_text_array(p_value jsonb)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    array(
      select jsonb_array_elements_text(
        case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end
      )
    ),
    '{}'::text[]
  )
$$;

-- Eight characters from an alphabet without look-alikes (no 0/o, 1/l/i).
create or replace function private.generate_short_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  bytes bytea := uuid_send(gen_random_uuid());
  result text := '';
  idx integer;
begin
  -- Bytes 6 and 8 of a v4 UUID hold fixed version bits, so they are skipped.
  foreach idx in array array[0, 1, 2, 3, 4, 5, 9, 10] loop
    result := result || substr(alphabet, 1 + (get_byte(bytes, idx) % 31), 1);
  end loop;
  return result;
end;
$$;


-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- App-side mirror of auth.users. Filled by a trigger (section 4).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  constraint profiles_name_length check (char_length(name) <= 60)
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  -- Null only for the seeded, read-only demo retailers.
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  logo_path text,
  banner_path text,
  description text not null default '',
  location text not null default '',
  -- Digits with country code, no plus sign. Example: 919876543210
  whatsapp_number text not null,
  phone_number text,
  instagram_handle text,
  settings jsonb not null default '{"showPricesByDefault": true, "showSoldDevices": true, "coverStyle": "graphite", "hours": null, "onboardingCompletedAt": null}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint businesses_slug_key unique (slug),
  constraint businesses_name_length check (char_length(btrim(name)) between 2 and 60),
  constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  constraint businesses_slug_not_reserved check (not private.is_reserved_slug(slug)),
  constraint businesses_description_length check (char_length(description) <= 240),
  constraint businesses_location_length check (char_length(location) <= 120),
  constraint businesses_whatsapp_format check (whatsapp_number ~ '^[0-9]{8,15}$'),
  constraint businesses_phone_format check (phone_number is null or phone_number ~ '^[0-9]{8,15}$'),
  constraint businesses_instagram_format check (instagram_handle is null or instagram_handle ~ '^[a-z0-9._]{1,30}$'),
  constraint businesses_logo_path_owned check (logo_path is null or private.owns_image_path(id, logo_path)),
  constraint businesses_banner_path_owned check (banner_path is null or private.owns_image_path(id, banner_path)),
  constraint businesses_settings_valid check (private.valid_business_settings(settings)),
  constraint businesses_owner_or_demo check (owner_id is not null or is_demo)
);

-- One storefront per account in this version. Drop this index to allow more.
create unique index if not exists businesses_owner_id_key
  on public.businesses (owner_id)
  where owner_id is not null;

-- Who may manage which business. Owners are added by a trigger; staff
-- invitations are a later feature, so clients cannot write here at all.
create table if not exists public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id),
  constraint business_members_role check (role in ('owner', 'staff'))
);

create index if not exists business_members_user_id_idx on public.business_members (user_id);

-- One row per physical phone. Two identical models are still two rows.
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  -- Public identifier used in storefront URLs. Set by a trigger.
  short_id text not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  inventory_reference text not null,
  brand text not null,
  model text not null,
  storage_gb integer not null,
  colour text not null,
  battery_health smallint,
  condition text not null,
  cosmetic_condition text not null default '',
  functional_condition text not null default '',
  accessories text[] not null default '{}',
  warranty text not null default '',
  -- Internal only. Never returned by a public function.
  notes text not null default '',
  -- Asking price in whole rupees. Public only while show_price is true.
  price integer,
  show_price boolean not null default false,
  availability_status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz,
  constraint devices_short_id_key unique (short_id),
  constraint devices_id_business_key unique (id, business_id),
  constraint devices_reference_format check (
    inventory_reference ~ '^[A-Za-z0-9][A-Za-z0-9_/.-]*$' and char_length(inventory_reference) <= 24
  ),
  constraint devices_brand_length check (char_length(brand) between 1 and 40),
  constraint devices_model_length check (char_length(model) between 1 and 60),
  constraint devices_storage_range check (storage_gb between 1 and 4096),
  constraint devices_colour_length check (char_length(colour) between 1 and 40),
  constraint devices_battery_range check (battery_health is null or battery_health between 1 and 100),
  constraint devices_condition check (condition in ('like_new', 'excellent', 'good', 'fair')),
  constraint devices_cosmetic_length check (char_length(cosmetic_condition) <= 200),
  constraint devices_functional_length check (char_length(functional_condition) <= 200),
  constraint devices_accessories_count check (cardinality(accessories) <= 12),
  constraint devices_warranty_length check (char_length(warranty) <= 80),
  constraint devices_notes_length check (char_length(notes) <= 1000),
  constraint devices_price_range check (price is null or price between 0 and 10000000),
  constraint devices_status check (availability_status in ('available', 'reserved', 'sold'))
);

-- References are unique inside a business, ignoring case.
create unique index if not exists devices_business_reference_key
  on public.devices (business_id, lower(inventory_reference));

create index if not exists devices_business_created_idx
  on public.devices (business_id, created_at desc);

create table if not exists public.device_images (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Object path in the "device-images" bucket: "<business id>/<uuid>.<ext>".
  image_path text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  -- The composite key ties an image to a device of the same business.
  constraint device_images_device_fk foreign key (device_id, business_id)
    references public.devices (id, business_id) on delete cascade,
  constraint device_images_device_path_key unique (device_id, image_path),
  constraint device_images_path_owned check (private.owns_image_path(business_id, image_path))
);

create index if not exists device_images_device_idx
  on public.device_images (device_id, business_id, sort_order);

create index if not exists device_images_business_id_idx
  on public.device_images (business_id);

create unique index if not exists device_images_one_primary_key
  on public.device_images (device_id)
  where is_primary;

-- Append-only log of what happened to the inventory.
create table if not exists public.inventory_activity (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  business_id uuid not null references public.businesses (id) on delete cascade,
  device_id uuid,
  action text not null,
  -- Snapshot of what the entry refers to, so it survives device deletion.
  subject text not null default '',
  reference text,
  performed_by uuid references auth.users (id) on delete set null,
  performed_by_name text not null default '',
  created_at timestamptz not null default clock_timestamp(),
  constraint inventory_activity_device_fk foreign key (device_id, business_id)
    references public.devices (id, business_id) on delete set null (device_id),
  constraint inventory_activity_action check (action in (
    'business_created', 'storefront_updated', 'device_added', 'device_updated', 'device_sold',
    'device_reserved', 'device_available', 'device_deleted', 'price_shown', 'price_hidden'
  )),
  constraint inventory_activity_subject_length check (char_length(subject) <= 200),
  constraint inventory_activity_reference_length check (reference is null or char_length(reference) <= 24)
);

create index if not exists inventory_activity_business_idx
  on public.inventory_activity (business_id, created_at desc, seq desc);

create index if not exists inventory_activity_device_idx
  on public.inventory_activity (device_id, business_id);

create index if not exists inventory_activity_performed_by_idx
  on public.inventory_activity (performed_by);

-- Storefront analytics as daily counters: one row per business, day, event
-- type and (for inquiries about one phone) device. Views use an empty device.
create table if not exists public.storefront_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Calendar day in India Standard Time.
  day date not null,
  event_type text not null,
  device_short_id text not null default '',
  count integer not null default 0,
  constraint storefront_events_bucket_key unique (business_id, day, event_type, device_short_id),
  constraint storefront_events_type check (event_type in ('view', 'inquiry')),
  constraint storefront_events_count check (count >= 0)
);


-- -----------------------------------------------------------------------------
-- 3. Membership helpers
--    SECURITY DEFINER so policies can consult business_members without
--    recursing into its own policies. search_path is pinned.
-- -----------------------------------------------------------------------------

-- Businesses the signed-in user may manage inventory for.
create or replace function private.current_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from public.business_members m
  where m.user_id = (select auth.uid())
$$;

-- Businesses the signed-in user owns (may change storefront settings).
create or replace function private.owned_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from public.business_members m
  where m.user_id = (select auth.uid())
    and m.role = 'owner'
$$;

create or replace function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'onhand:unauthenticated';
  end if;
  return v_user;
end;
$$;

create or replace function private.require_member(p_business_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_user();
  if p_business_id is null or p_business_id not in (select private.current_business_ids()) then
    raise exception 'onhand:forbidden';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Triggers
-- -----------------------------------------------------------------------------

-- 4a. Keep public.profiles in step with auth.users.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, created_at)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1)), 60),
    coalesce(new.email, ''),
    coalesce(new.created_at, now())
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

drop trigger if exists onhand_on_auth_user_created on auth.users;
create trigger onhand_on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop trigger if exists onhand_on_auth_user_email_changed on auth.users;
create trigger onhand_on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Accounts that existed before this migration ran.
insert into public.profiles (id, name, email, created_at)
select
  u.id,
  left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(u.email, ''), '@', 1)), 60),
  coalesce(u.email, ''),
  coalesce(u.created_at, now())
from auth.users u
on conflict (id) do nothing;

-- 4b. Activity entries always record who really made them.
create or replace function private.inventory_activity_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is not null then
    new.performed_by := v_user;
    new.performed_by_name := coalesce(
      nullif((select p.name from public.profiles p where p.id = v_user), ''),
      'Someone'
    );
    new.created_at := clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_activity_before_insert on public.inventory_activity;
create trigger inventory_activity_before_insert
  before insert on public.inventory_activity
  for each row execute function private.inventory_activity_before_insert();

-- 4c. Creating a business makes its creator the owner, atomically.
create or replace function private.businesses_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null then
    insert into public.business_members (business_id, user_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict (business_id, user_id) do nothing;

    insert into public.inventory_activity (business_id, device_id, action, subject, reference, performed_by, performed_by_name)
    values (
      new.id, null, 'business_created', left(new.name, 200), null, new.owner_id,
      coalesce(nullif((select p.name from public.profiles p where p.id = new.owner_id), ''), 'Someone')
    );
  end if;
  return null;
end;
$$;

drop trigger if exists businesses_after_insert on public.businesses;
create trigger businesses_after_insert
  after insert on public.businesses
  for each row execute function private.businesses_after_insert();

-- 4d. Device housekeeping: public short id, sold_at and updated_at.
--     SECURITY DEFINER only so the short id can be checked against every
--     tenant's devices. It changes nothing but the row being written.
create or replace function private.devices_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate text;
  v_attempts integer := 0;
begin
  if tg_op = 'INSERT' then
    if new.short_id is null or new.short_id = '' then
      loop
        v_candidate := private.generate_short_id();
        v_attempts := v_attempts + 1;
        exit when v_attempts >= 8
          or not exists (select 1 from public.devices d where d.short_id = v_candidate);
      end loop;
      new.short_id := v_candidate;
    end if;
    if new.availability_status = 'sold' then
      new.sold_at := coalesce(new.sold_at, now());
    else
      new.sold_at := null;
    end if;
  else
    new.short_id := old.short_id;
    if new.availability_status = 'sold' then
      if old.availability_status is distinct from 'sold' then
        new.sold_at := now();
      else
        new.sold_at := old.sold_at;
      end if;
    else
      new.sold_at := null;
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists devices_before_write on public.devices;
create trigger devices_before_write
  before insert or update on public.devices
  for each row execute function private.devices_before_write();


-- -----------------------------------------------------------------------------
-- 5. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.devices enable row level security;
alter table public.device_images enable row level security;
alter table public.inventory_activity enable row level security;
alter table public.storefront_events enable row level security;

-- profiles: a user sees and renames only themselves.
drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- businesses: members read, a user creates only their own, owners update.
-- (owner_id is checked directly so INSERT ... RETURNING works before the
-- membership row from the trigger exists.)
drop policy if exists "Members read their business" on public.businesses;
create policy "Members read their business" on public.businesses
  for select to authenticated
  using (owner_id = (select auth.uid()) or id in (select private.current_business_ids()));

drop policy if exists "Users create their own business" on public.businesses;
create policy "Users create their own business" on public.businesses
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and is_demo = false);

drop policy if exists "Owners update their business" on public.businesses;
create policy "Owners update their business" on public.businesses
  for update to authenticated
  using (id in (select private.owned_business_ids()))
  with check (id in (select private.owned_business_ids()));

-- business_members: read-only for clients.
drop policy if exists "Users read their memberships" on public.business_members;
create policy "Users read their memberships" on public.business_members
  for select to authenticated
  using (user_id = (select auth.uid()) or business_id in (select private.owned_business_ids()));

-- devices: full control inside your own business, nothing outside it.
drop policy if exists "Members read devices" on public.devices;
create policy "Members read devices" on public.devices
  for select to authenticated
  using (business_id in (select private.current_business_ids()));

drop policy if exists "Members add devices" on public.devices;
create policy "Members add devices" on public.devices
  for insert to authenticated
  with check (business_id in (select private.current_business_ids()));

drop policy if exists "Members update devices" on public.devices;
create policy "Members update devices" on public.devices
  for update to authenticated
  using (business_id in (select private.current_business_ids()))
  with check (business_id in (select private.current_business_ids()));

drop policy if exists "Members delete devices" on public.devices;
create policy "Members delete devices" on public.devices
  for delete to authenticated
  using (business_id in (select private.current_business_ids()));

-- device_images: same rule as devices.
drop policy if exists "Members read device images" on public.device_images;
create policy "Members read device images" on public.device_images
  for select to authenticated
  using (business_id in (select private.current_business_ids()));

drop policy if exists "Members add device images" on public.device_images;
create policy "Members add device images" on public.device_images
  for insert to authenticated
  with check (business_id in (select private.current_business_ids()));

drop policy if exists "Members update device images" on public.device_images;
create policy "Members update device images" on public.device_images
  for update to authenticated
  using (business_id in (select private.current_business_ids()))
  with check (business_id in (select private.current_business_ids()));

drop policy if exists "Members delete device images" on public.device_images;
create policy "Members delete device images" on public.device_images
  for delete to authenticated
  using (business_id in (select private.current_business_ids()));

-- inventory_activity: members read and append. No update, no delete.
drop policy if exists "Members read activity" on public.inventory_activity;
create policy "Members read activity" on public.inventory_activity
  for select to authenticated
  using (business_id in (select private.current_business_ids()));

drop policy if exists "Members log activity" on public.inventory_activity;
create policy "Members log activity" on public.inventory_activity
  for insert to authenticated
  with check (
    business_id in (select private.current_business_ids())
    and performed_by = (select auth.uid())
  );

-- storefront_events: members read their counters. Writes only happen inside
-- public.record_storefront_event().
drop policy if exists "Members read storefront events" on public.storefront_events;
create policy "Members read storefront events" on public.storefront_events
  for select to authenticated
  using (business_id in (select private.current_business_ids()));


-- -----------------------------------------------------------------------------
-- 6. Table privileges
--    Start from nothing, then grant the minimum. Visitors (anon) get no table
--    access at all. Column lists keep ids, tenant keys and flags immutable.
-- -----------------------------------------------------------------------------

revoke all on table
  public.profiles,
  public.businesses,
  public.business_members,
  public.devices,
  public.device_images,
  public.inventory_activity,
  public.storefront_events
from public, anon, authenticated;

grant all on table
  public.profiles,
  public.businesses,
  public.business_members,
  public.devices,
  public.device_images,
  public.inventory_activity,
  public.storefront_events
to service_role;

-- Identity columns own a sequence each. Inserts never need a privilege on it,
-- so nobody outside the database owner gets one.
do $revoke$
declare
  v_sequence text;
begin
  for v_sequence in
    select pg_get_serial_sequence(format('public.%I', t.table_name), t.column_name)
    from (values ('inventory_activity', 'seq'), ('storefront_events', 'id')) as t(table_name, column_name)
  loop
    if v_sequence is not null then
      execute format('revoke all on sequence %s from public, anon, authenticated', v_sequence);
    end if;
  end loop;
end
$revoke$;

grant select on table public.profiles to authenticated;
grant update (name) on table public.profiles to authenticated;

grant select on table public.businesses to authenticated;
grant insert (owner_id, name, slug, description, location, whatsapp_number, phone_number, instagram_handle)
  on table public.businesses to authenticated;
grant update (name, slug, logo_path, banner_path, description, location, whatsapp_number, phone_number, instagram_handle, settings)
  on table public.businesses to authenticated;

grant select on table public.business_members to authenticated;

grant select, delete on table public.devices to authenticated;
grant insert (
  business_id, inventory_reference, brand, model, storage_gb, colour, battery_health, condition,
  cosmetic_condition, functional_condition, accessories, warranty, notes, price, show_price,
  availability_status, created_at
) on table public.devices to authenticated;
grant update (
  inventory_reference, brand, model, storage_gb, colour, battery_health, condition,
  cosmetic_condition, functional_condition, accessories, warranty, notes, price, show_price,
  availability_status, created_at
) on table public.devices to authenticated;

grant select, delete on table public.device_images to authenticated;
grant insert (device_id, business_id, image_path, sort_order, is_primary) on table public.device_images to authenticated;
grant update (sort_order, is_primary) on table public.device_images to authenticated;

grant select on table public.inventory_activity to authenticated;
grant insert (business_id, device_id, action, subject, reference) on table public.inventory_activity to authenticated;

grant select on table public.storefront_events to authenticated;


-- -----------------------------------------------------------------------------
-- 7. JSON shapes
--    Rows leave the database in the app's own camelCase shapes.
-- -----------------------------------------------------------------------------

create or replace function private.business_json(b public.businesses)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id,
    'ownerId', coalesce(b.owner_id::text, ''),
    'name', b.name,
    'slug', b.slug,
    'logoPath', b.logo_path,
    'bannerPath', b.banner_path,
    'description', b.description,
    'location', b.location,
    'whatsappNumber', b.whatsapp_number,
    'phoneNumber', b.phone_number,
    'instagramHandle', b.instagram_handle,
    'settings', private.business_settings(b.settings),
    'isDemo', b.is_demo,
    'createdAt', private.iso(b.created_at)
  )
$$;

-- Full device for the dashboard. Runs with the caller's rights.
create or replace function private.device_json(d public.devices)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id,
    'shortId', d.short_id,
    'businessId', d.business_id,
    'inventoryReference', d.inventory_reference,
    'brand', d.brand,
    'model', d.model,
    'storageGb', d.storage_gb,
    'colour', d.colour,
    'batteryHealth', d.battery_health,
    'condition', d.condition,
    'cosmeticCondition', d.cosmetic_condition,
    'functionalCondition', d.functional_condition,
    'accessories', to_jsonb(d.accessories),
    'warranty', d.warranty,
    'notes', d.notes,
    'price', d.price,
    'showPrice', d.show_price,
    'availabilityStatus', d.availability_status,
    'images', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', i.id, 'path', i.image_path, 'sortOrder', i.sort_order, 'isPrimary', i.is_primary)
          order by i.sort_order, i.created_at, i.id
        )
        from public.device_images i
        where i.device_id = d.id
      ),
      '[]'::jsonb
    ),
    'createdAt', private.iso(d.created_at),
    'updatedAt', private.iso(d.updated_at),
    'soldAt', private.iso(d.sold_at)
  )
$$;

-- The only place a device row becomes public data. Anything not listed here
-- cannot reach a storefront: notes, hidden prices, the device's internal id.
-- Photo paths begin with the shop's own storage folder (its business id).
create or replace function private.public_device_json(d public.devices)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.short_id,
    'reference', d.inventory_reference,
    'brand', d.brand,
    'model', d.model,
    'storageGb', d.storage_gb,
    'colour', d.colour,
    'batteryHealth', d.battery_health,
    'condition', d.condition,
    'cosmeticCondition', d.cosmetic_condition,
    'functionalCondition', d.functional_condition,
    'accessories', to_jsonb(d.accessories),
    'warranty', d.warranty,
    'availability', d.availability_status,
    'price', case
      when d.show_price and d.price is not null and d.availability_status <> 'sold' then d.price
      else null
    end,
    'images', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('path', i.image_path, 'isPrimary', i.is_primary)
          order by i.is_primary desc, i.sort_order, i.created_at, i.id
        )
        from public.device_images i
        where i.device_id = d.id
      ),
      '[]'::jsonb
    ),
    'addedAt', private.iso(d.created_at)
  )
$$;

create or replace function private.log_activity(
  p_business_id uuid,
  p_device_id uuid,
  p_action text,
  p_subject text,
  p_reference text
)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.inventory_activity (business_id, device_id, action, subject, reference)
  values (p_business_id, p_device_id, p_action, left(coalesce(p_subject, ''), 200), p_reference)
$$;

-- Makes a device's photo list exactly match p_images
-- ([{ "path": "...", "isPrimary": true }, ...]) and returns the paths removed.
create or replace function private.replace_device_images(p_device_id uuid, p_business_id uuid, p_images jsonb)
returns text[]
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_items jsonb := case when jsonb_typeof(p_images) = 'array' then p_images else '[]'::jsonb end;
  v_paths text[];
  v_primary_path text;
  v_removed text[];
begin
  if jsonb_array_length(v_items) > 8 then
    raise exception 'onhand:too_many_images';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as e(item)
    where not private.owns_image_path(p_business_id, e.item ->> 'path')
  ) then
    raise exception 'onhand:image_not_owned';
  end if;

  -- First photo flagged as primary, otherwise the first photo.
  select coalesce(
    (
      select e.item ->> 'path'
      from jsonb_array_elements(v_items) with ordinality as e(item, ord)
      where coalesce((e.item ->> 'isPrimary')::boolean, false)
      order by e.ord
      limit 1
    ),
    v_items -> 0 ->> 'path'
  )
  into v_primary_path;

  -- Paths in order, without repeats.
  select coalesce(array_agg(s.path order by s.ord), '{}'::text[])
  into v_paths
  from (
    select e.item ->> 'path' as path, min(e.ord) as ord
    from jsonb_array_elements(v_items) with ordinality as e(item, ord)
    group by e.item ->> 'path'
  ) s;

  select coalesce(array_agg(i.image_path), '{}'::text[])
  into v_removed
  from public.device_images i
  where i.device_id = p_device_id
    and not (i.image_path = any (v_paths));

  delete from public.device_images i
  where i.device_id = p_device_id
    and not (i.image_path = any (v_paths));

  update public.device_images i
  set is_primary = false
  where i.device_id = p_device_id
    and i.is_primary;

  insert into public.device_images (device_id, business_id, image_path, sort_order, is_primary)
  select p_device_id, p_business_id, p.path, (p.ord - 1)::integer, false
  from unnest(v_paths) with ordinality as p(path, ord)
  where not exists (
    select 1 from public.device_images i where i.device_id = p_device_id and i.image_path = p.path
  );

  update public.device_images i
  set sort_order = (p.ord - 1)::integer,
      is_primary = (p.path = v_primary_path)
  from unnest(v_paths) with ordinality as p(path, ord)
  where i.device_id = p_device_id
    and i.image_path = p.path;

  return v_removed;
end;
$$;


-- -----------------------------------------------------------------------------
-- 8. Private data API (signed-in retailers)
--    SECURITY INVOKER: every statement below still passes through RLS.
--    Errors use "onhand:<code>" messages that the app maps to friendly text.
-- -----------------------------------------------------------------------------

create or replace function public.get_my_profile()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'email', p.email,
    'createdAt', private.iso(p.created_at)
  )
  from public.profiles p
  where p.id = (select auth.uid())
$$;

create or replace function public.update_my_profile(p_name text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_result jsonb;
begin
  update public.profiles
  set name = left(btrim(coalesce(p_name, '')), 60)
  where id = v_user;

  select public.get_my_profile() into v_result;
  if v_result is null then
    raise exception 'onhand:account_not_found';
  end if;
  return v_result;
end;
$$;

-- The business the signed-in user manages (their first membership), or null.
create or replace function public.get_my_business()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.business_json(b)
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = (select auth.uid())
  order by m.created_at, b.id
  limit 1
$$;

-- Profile and business in one round trip: what every dashboard request needs.
create or replace function public.get_my_context()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', public.get_my_profile(),
    'business', public.get_my_business()
  )
$$;

-- Whether a storefront address is free. SECURITY DEFINER because it has to
-- look across every tenant. It reveals only what the public storefront URL
-- already reveals.
create or replace function public.is_slug_available(p_slug text, p_except_business_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_slug is not null
    and not private.is_reserved_slug(p_slug)
    and not exists (
      select 1
      from public.businesses b
      where b.slug = p_slug
        and (p_except_business_id is null or b.id <> p_except_business_id)
    )
$$;

create or replace function public.create_business(p_input jsonb)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_slug text := p_input ->> 'slug';
  v_business public.businesses;
  v_constraint text;
begin
  if exists (select 1 from public.business_members m where m.user_id = v_user) then
    raise exception 'onhand:already_has_business';
  end if;
  if not public.is_slug_available(v_slug) then
    raise exception 'onhand:slug_taken';
  end if;

  insert into public.businesses (owner_id, name, slug, description, location, whatsapp_number, phone_number, instagram_handle)
  values (
    v_user,
    p_input ->> 'name',
    v_slug,
    coalesce(p_input ->> 'description', ''),
    coalesce(p_input ->> 'location', ''),
    p_input ->> 'whatsappNumber',
    p_input ->> 'phoneNumber',
    p_input ->> 'instagramHandle'
  )
  returning * into v_business;

  return private.business_json(v_business);
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'businesses_owner_id_key' then
      raise exception 'onhand:already_has_business';
    elsif v_constraint = 'businesses_slug_key' then
      raise exception 'onhand:slug_taken';
    end if;
    raise;
end;
$$;

-- Input mirrors StorefrontSettingsInput, with logoPath / bannerPath in place
-- of URLs. Returns { business, stalePaths } so replaced files can be removed.
create or replace function public.update_storefront(p_business_id uuid, p_input jsonb)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_current public.businesses;
  v_updated public.businesses;
  v_slug text := p_input ->> 'slug';
  v_logo text := p_input ->> 'logoPath';
  v_banner text := p_input ->> 'bannerPath';
  v_stale text[] := '{}'::text[];
  v_constraint text;
begin
  perform private.require_member(p_business_id);

  select * into v_current from public.businesses b where b.id = p_business_id;
  if not found then
    raise exception 'onhand:forbidden';
  end if;

  if v_slug is distinct from v_current.slug and not public.is_slug_available(v_slug, p_business_id) then
    raise exception 'onhand:slug_taken';
  end if;
  if v_logo is not null and v_logo is distinct from v_current.logo_path
     and not private.owns_image_path(p_business_id, v_logo) then
    raise exception 'onhand:logo_not_owned';
  end if;
  if v_banner is not null and v_banner is distinct from v_current.banner_path
     and not private.owns_image_path(p_business_id, v_banner) then
    raise exception 'onhand:banner_not_owned';
  end if;

  if v_current.logo_path is not null and v_current.logo_path is distinct from v_logo then
    v_stale := v_stale || v_current.logo_path;
  end if;
  if v_current.banner_path is not null and v_current.banner_path is distinct from v_banner then
    v_stale := v_stale || v_current.banner_path;
  end if;

  update public.businesses b
  set name = p_input ->> 'name',
      slug = v_slug,
      description = coalesce(p_input ->> 'description', ''),
      location = coalesce(p_input ->> 'location', ''),
      whatsapp_number = p_input ->> 'whatsappNumber',
      phone_number = p_input ->> 'phoneNumber',
      instagram_handle = p_input ->> 'instagramHandle',
      logo_path = v_logo,
      banner_path = v_banner,
      settings = private.business_settings(b.settings) || jsonb_build_object(
        'coverStyle', coalesce(p_input ->> 'coverStyle', private.business_settings(b.settings) ->> 'coverStyle'),
        'hours', coalesce(p_input -> 'hours', 'null'::jsonb),
        'showPricesByDefault', coalesce((p_input ->> 'showPricesByDefault')::boolean, true),
        'showSoldDevices', coalesce((p_input ->> 'showSoldDevices')::boolean, true)
      )
  where b.id = p_business_id
  returning * into v_updated;

  -- No row means the caller is a member but not an owner.
  if not found then
    raise exception 'onhand:forbidden';
  end if;

  perform private.log_activity(p_business_id, null, 'storefront_updated', v_updated.name, null);

  return jsonb_build_object(
    'business', private.business_json(v_updated),
    'stalePaths', to_jsonb(v_stale)
  );
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'businesses_slug_key' then
      raise exception 'onhand:slug_taken';
    end if;
    raise;
end;
$$;

create or replace function public.complete_onboarding(p_business_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_member(p_business_id);

  update public.businesses b
  set settings = jsonb_set(
    private.business_settings(b.settings),
    '{onboardingCompletedAt}',
    to_jsonb(private.iso(now()))
  )
  where b.id = p_business_id
    and private.business_settings(b.settings) ->> 'onboardingCompletedAt' is null;

  select private.business_json(b) into v_result from public.businesses b where b.id = p_business_id;
  if v_result is null then
    raise exception 'onhand:forbidden';
  end if;
  return v_result;
end;
$$;

create or replace function public.list_devices(p_business_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_member(p_business_id);
  return coalesce(
    (
      select jsonb_agg(private.device_json(d) order by d.created_at desc, d.id)
      from public.devices d
      where d.business_id = p_business_id
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.get_device(p_business_id uuid, p_device_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_member(p_business_id);
  return (
    select private.device_json(d)
    from public.devices d
    where d.id = p_device_id
      and d.business_id = p_business_id
  );
end;
$$;

-- Business name and existing references, for suggesting the next reference.
create or replace function public.get_reference_context(p_business_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_member(p_business_id);
  return (
    select jsonb_build_object(
      'name', b.name,
      'references', coalesce(
        (select jsonb_agg(d.inventory_reference) from public.devices d where d.business_id = b.id),
        '[]'::jsonb
      )
    )
    from public.businesses b
    where b.id = p_business_id
  );
end;
$$;

-- Input mirrors DeviceInput, with images as [{ path, isPrimary }].
create or replace function public.create_device(p_business_id uuid, p_input jsonb)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_device public.devices;
  v_reference text := btrim(coalesce(p_input ->> 'inventoryReference', ''));
  v_constraint text;
begin
  perform private.require_member(p_business_id);

  if exists (
    select 1
    from public.devices d
    where d.business_id = p_business_id
      and lower(d.inventory_reference) = lower(v_reference)
  ) then
    raise exception 'onhand:reference_taken';
  end if;

  insert into public.devices (
    business_id, inventory_reference, brand, model, storage_gb, colour, battery_health, condition,
    cosmetic_condition, functional_condition, accessories, warranty, notes, price, show_price,
    availability_status, created_at
  )
  values (
    p_business_id,
    v_reference,
    p_input ->> 'brand',
    p_input ->> 'model',
    (p_input ->> 'storageGb')::integer,
    p_input ->> 'colour',
    (p_input ->> 'batteryHealth')::smallint,
    p_input ->> 'condition',
    coalesce(p_input ->> 'cosmeticCondition', ''),
    coalesce(p_input ->> 'functionalCondition', ''),
    private.jsonb_text_array(p_input -> 'accessories'),
    coalesce(p_input ->> 'warranty', ''),
    coalesce(p_input ->> 'notes', ''),
    (p_input ->> 'price')::integer,
    coalesce((p_input ->> 'showPrice')::boolean, false),
    coalesce(p_input ->> 'availabilityStatus', 'available'),
    private.created_at_for((p_input ->> 'addedOn')::date)
  )
  returning * into v_device;

  perform private.replace_device_images(v_device.id, p_business_id, p_input -> 'images');

  perform private.log_activity(
    p_business_id,
    v_device.id,
    'device_added',
    private.device_label(v_device.brand, v_device.model, v_device.storage_gb, v_device.colour),
    v_device.inventory_reference
  );

  return private.device_json(v_device);
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'devices_business_reference_key' then
      raise exception 'onhand:reference_taken';
    end if;
    raise;
end;
$$;

-- Returns { device, removedPaths }.
create or replace function public.update_device(p_business_id uuid, p_device_id uuid, p_input jsonb)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_old public.devices;
  v_new public.devices;
  v_reference text := btrim(coalesce(p_input ->> 'inventoryReference', ''));
  v_added_on date := (p_input ->> 'addedOn')::date;
  v_removed text[];
  v_subject text;
  v_constraint text;
begin
  perform private.require_member(p_business_id);

  select * into v_old
  from public.devices d
  where d.id = p_device_id
    and d.business_id = p_business_id
  for update;
  if not found then
    raise exception 'onhand:device_not_found';
  end if;

  if exists (
    select 1
    from public.devices d
    where d.business_id = p_business_id
      and d.id <> p_device_id
      and lower(d.inventory_reference) = lower(v_reference)
  ) then
    raise exception 'onhand:reference_taken';
  end if;

  v_removed := private.replace_device_images(p_device_id, p_business_id, p_input -> 'images');

  update public.devices d
  set inventory_reference = v_reference,
      brand = p_input ->> 'brand',
      model = p_input ->> 'model',
      storage_gb = (p_input ->> 'storageGb')::integer,
      colour = p_input ->> 'colour',
      battery_health = (p_input ->> 'batteryHealth')::smallint,
      condition = p_input ->> 'condition',
      cosmetic_condition = coalesce(p_input ->> 'cosmeticCondition', ''),
      functional_condition = coalesce(p_input ->> 'functionalCondition', ''),
      accessories = private.jsonb_text_array(p_input -> 'accessories'),
      warranty = coalesce(p_input ->> 'warranty', ''),
      notes = coalesce(p_input ->> 'notes', ''),
      price = (p_input ->> 'price')::integer,
      show_price = coalesce((p_input ->> 'showPrice')::boolean, false),
      availability_status = coalesce(p_input ->> 'availabilityStatus', 'available'),
      created_at = case
        when v_added_on is distinct from private.ist_day(d.created_at) then private.created_at_for(v_added_on)
        else d.created_at
      end
  where d.id = p_device_id
    and d.business_id = p_business_id
  returning * into v_new;

  v_subject := private.device_label(v_new.brand, v_new.model, v_new.storage_gb, v_new.colour);
  perform private.log_activity(p_business_id, p_device_id, 'device_updated', v_subject, v_new.inventory_reference);
  if v_old.availability_status is distinct from v_new.availability_status then
    perform private.log_activity(
      p_business_id, p_device_id, private.status_action(v_new.availability_status), v_subject, v_new.inventory_reference
    );
  end if;
  if v_old.show_price is distinct from v_new.show_price then
    perform private.log_activity(
      p_business_id, p_device_id,
      case when v_new.show_price then 'price_shown' else 'price_hidden' end,
      v_subject, v_new.inventory_reference
    );
  end if;

  return jsonb_build_object(
    'device', private.device_json(v_new),
    'removedPaths', to_jsonb(v_removed)
  );
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'devices_business_reference_key' then
      raise exception 'onhand:reference_taken';
    end if;
    raise;
end;
$$;

create or replace function public.set_device_availability(p_business_id uuid, p_device_id uuid, p_status text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_device public.devices;
begin
  perform private.require_member(p_business_id);

  select * into v_device
  from public.devices d
  where d.id = p_device_id
    and d.business_id = p_business_id
  for update;
  if not found then
    raise exception 'onhand:device_not_found';
  end if;

  if v_device.availability_status is distinct from p_status then
    update public.devices d
    set availability_status = p_status
    where d.id = p_device_id
      and d.business_id = p_business_id
    returning * into v_device;

    perform private.log_activity(
      p_business_id, p_device_id, private.status_action(v_device.availability_status),
      private.device_label(v_device.brand, v_device.model, v_device.storage_gb, v_device.colour),
      v_device.inventory_reference
    );
  end if;

  return private.device_json(v_device);
end;
$$;

create or replace function public.set_device_price_visibility(p_business_id uuid, p_device_id uuid, p_show_price boolean)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_device public.devices;
begin
  perform private.require_member(p_business_id);

  select * into v_device
  from public.devices d
  where d.id = p_device_id
    and d.business_id = p_business_id
  for update;
  if not found then
    raise exception 'onhand:device_not_found';
  end if;

  if v_device.show_price is distinct from coalesce(p_show_price, false) then
    update public.devices d
    set show_price = coalesce(p_show_price, false)
    where d.id = p_device_id
      and d.business_id = p_business_id
    returning * into v_device;

    perform private.log_activity(
      p_business_id, p_device_id,
      case when v_device.show_price then 'price_shown' else 'price_hidden' end,
      private.device_label(v_device.brand, v_device.model, v_device.storage_gb, v_device.colour),
      v_device.inventory_reference
    );
  end if;

  return private.device_json(v_device);
end;
$$;

-- Returns { removedPaths } so the device's files can be removed from storage.
create or replace function public.delete_device(p_business_id uuid, p_device_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_device public.devices;
  v_removed text[];
begin
  perform private.require_member(p_business_id);

  select * into v_device
  from public.devices d
  where d.id = p_device_id
    and d.business_id = p_business_id
  for update;
  if not found then
    raise exception 'onhand:device_not_found';
  end if;

  select coalesce(array_agg(i.image_path), '{}'::text[])
  into v_removed
  from public.device_images i
  where i.device_id = p_device_id;

  delete from public.devices d
  where d.id = p_device_id
    and d.business_id = p_business_id;

  perform private.log_activity(
    p_business_id, null, 'device_deleted',
    private.device_label(v_device.brand, v_device.model, v_device.storage_gb, v_device.colour),
    v_device.inventory_reference
  );

  return jsonb_build_object('removedPaths', to_jsonb(v_removed));
end;
$$;

create or replace function public.list_activity(p_business_id uuid, p_limit integer default 50)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_member(p_business_id);
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'businessId', a.business_id,
          'deviceId', a.device_id,
          'action', a.action,
          'subject', a.subject,
          'reference', a.reference,
          'performedBy', coalesce(a.performed_by::text, ''),
          'performedByName', a.performed_by_name,
          'timestamp', private.iso(a.created_at)
        )
        order by a.created_at desc, a.seq desc
      )
      from (
        select *
        from public.inventory_activity x
        where x.business_id = p_business_id
        order by x.created_at desc, x.seq desc
        limit greatest(0, least(coalesce(p_limit, 50), 500))
      ) a
    ),
    '[]'::jsonb
  );
end;
$$;

-- Daily storefront views and WhatsApp inquiries for the last p_days days (IST).
create or replace function public.get_analytics(p_business_id uuid, p_days integer default 14)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 14), 366));
  v_today date := private.ist_day(now());
  v_from date;
  v_result jsonb;
begin
  perform private.require_member(p_business_id);
  v_from := v_today - (v_days - 1);

  with series as (
    select generate_series(v_from::timestamp, v_today::timestamp, interval '1 day')::date as day
  ),
  per_day as (
    select
      s.day,
      coalesce((
        select sum(e.count) from public.storefront_events e
        where e.business_id = p_business_id and e.day = s.day and e.event_type = 'view'
      ), 0) as views,
      coalesce((
        select sum(e.count) from public.storefront_events e
        where e.business_id = p_business_id and e.day = s.day and e.event_type = 'inquiry'
      ), 0) as inquiries
    from series s
  )
  select jsonb_build_object(
    'days', (
      select jsonb_agg(
        jsonb_build_object('day', to_char(p.day, 'YYYY-MM-DD'), 'views', p.views, 'inquiries', p.inquiries)
        order by p.day
      )
      from per_day p
    ),
    'totalViews', (select coalesce(sum(p.views), 0) from per_day p),
    'totalInquiries', (select coalesce(sum(p.inquiries), 0) from per_day p),
    'inquiriesByDevice', coalesce(
      (
        select jsonb_object_agg(t.device_short_id, t.total)
        from (
          select e.device_short_id, sum(e.count) as total
          from public.storefront_events e
          where e.business_id = p_business_id
            and e.event_type = 'inquiry'
            and e.device_short_id <> ''
            and e.day between v_from and v_today
          group by e.device_short_id
        ) t
      ),
      '{}'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;


-- -----------------------------------------------------------------------------
-- 9. Public data API (storefront visitors, no sign-in)
--    SECURITY DEFINER with a pinned search_path. These are the only doors the
--    anon role has. Each returns whitelisted fields for one shop, found by its
--    public slug, so one retailer's catalog can never mix with another's.
-- -----------------------------------------------------------------------------

create or replace function public.get_public_shop(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', b.name,
    'slug', b.slug,
    'logoPath', b.logo_path,
    'bannerPath', b.banner_path,
    'description', b.description,
    'location', b.location,
    'whatsappNumber', b.whatsapp_number,
    'phoneNumber', b.phone_number,
    'instagramHandle', b.instagram_handle,
    'coverStyle', private.business_settings(b.settings) ->> 'coverStyle',
    'hours', private.business_settings(b.settings) -> 'hours',
    'isDemo', b.is_demo
  )
  from public.businesses b
  where b.slug = p_slug
$$;

-- Catalog order: available first, then reserved, then sold; newest first.
-- Sold phones are left out when the shop has chosen to hide them.
create or replace function public.list_public_devices(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      private.public_device_json(d)
      order by
        case d.availability_status when 'available' then 0 when 'reserved' then 1 else 2 end,
        d.created_at desc,
        d.id
    ),
    '[]'::jsonb
  )
  from public.businesses b
  join public.devices d on d.business_id = b.id
  where b.slug = p_slug
    and (
      d.availability_status <> 'sold'
      or coalesce((private.business_settings(b.settings) ->> 'showSoldDevices')::boolean, true)
    )
$$;

create or replace function public.get_public_device(p_slug text, p_short_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.public_device_json(d)
  from public.businesses b
  join public.devices d on d.business_id = b.id
  where b.slug = p_slug
    and d.short_id = p_short_id
    and (
      d.availability_status <> 'sold'
      or coalesce((private.business_settings(b.settings) ->> 'showSoldDevices')::boolean, true)
    )
$$;

-- Counts one storefront view or WhatsApp inquiry. It can only ever add 1 to
-- the counter of an existing shop for today: the caller chooses nothing else.
-- An unknown shop or event type is ignored. A device id that does not belong
-- to the shop is counted as a general inquiry.
create or replace function public.record_storefront_event(
  p_slug text,
  p_type text,
  p_device_short_id text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_device text := '';
begin
  if p_type is null or p_type not in ('view', 'inquiry') then
    return;
  end if;

  select b.id into v_business from public.businesses b where b.slug = p_slug;
  if v_business is null then
    return;
  end if;

  if p_type = 'inquiry' and p_device_short_id is not null then
    select d.short_id into v_device
    from public.devices d
    where d.business_id = v_business
      and d.short_id = p_device_short_id;
    v_device := coalesce(v_device, '');
  end if;

  insert into public.storefront_events as e (business_id, day, event_type, device_short_id, count)
  values (v_business, private.ist_day(now()), p_type, v_device, 1)
  on conflict (business_id, day, event_type, device_short_id)
  do update set count = e.count + 1;
end;
$$;


-- -----------------------------------------------------------------------------
-- 10. Function privileges
--     Postgres lets everyone execute a new function by default. Take that
--     away first, then grant exactly what each role needs.
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema private from public, anon, authenticated;

revoke execute on function
  public.get_my_profile(),
  public.update_my_profile(text),
  public.get_my_business(),
  public.get_my_context(),
  public.is_slug_available(text, uuid),
  public.create_business(jsonb),
  public.update_storefront(uuid, jsonb),
  public.complete_onboarding(uuid),
  public.list_devices(uuid),
  public.get_device(uuid, uuid),
  public.get_reference_context(uuid),
  public.create_device(uuid, jsonb),
  public.update_device(uuid, uuid, jsonb),
  public.set_device_availability(uuid, uuid, text),
  public.set_device_price_visibility(uuid, uuid, boolean),
  public.delete_device(uuid, uuid),
  public.list_activity(uuid, integer),
  public.get_analytics(uuid, integer),
  public.get_public_shop(text),
  public.list_public_devices(text),
  public.get_public_device(text, text),
  public.record_storefront_event(text, text, text)
from public, anon, authenticated;

-- Helpers that run with the caller's rights inside policies, CHECK
-- constraints and the private data API.
grant execute on function
  private.ist_day(timestamptz),
  private.iso(timestamptz),
  private.created_at_for(date),
  private.is_reserved_slug(text),
  private.business_settings(jsonb),
  private.valid_business_settings(jsonb),
  private.owns_image_path(uuid, text),
  private.device_label(text, text, integer, text),
  private.status_action(text),
  private.jsonb_text_array(jsonb),
  private.current_business_ids(),
  private.owned_business_ids(),
  private.require_user(),
  private.require_member(uuid),
  private.business_json(public.businesses),
  private.device_json(public.devices),
  private.log_activity(uuid, uuid, text, text, text),
  private.replace_device_images(uuid, uuid, jsonb)
to authenticated, service_role;

-- Signed-in retailers.
grant execute on function
  public.get_my_profile(),
  public.update_my_profile(text),
  public.get_my_business(),
  public.get_my_context(),
  public.is_slug_available(text, uuid),
  public.create_business(jsonb),
  public.update_storefront(uuid, jsonb),
  public.complete_onboarding(uuid),
  public.list_devices(uuid),
  public.get_device(uuid, uuid),
  public.get_reference_context(uuid),
  public.create_device(uuid, jsonb),
  public.update_device(uuid, uuid, jsonb),
  public.set_device_availability(uuid, uuid, text),
  public.set_device_price_visibility(uuid, uuid, boolean),
  public.delete_device(uuid, uuid),
  public.list_activity(uuid, integer),
  public.get_analytics(uuid, integer)
to authenticated, service_role;

-- Everyone, including storefront visitors.
grant execute on function
  public.get_public_shop(text),
  public.list_public_devices(text),
  public.get_public_device(text, text),
  public.record_storefront_event(text, text, text)
to anon, authenticated, service_role;
