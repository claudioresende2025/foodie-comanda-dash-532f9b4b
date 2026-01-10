-- Migration: create RPC upsert_empresa_overrides
-- Execute this with the Supabase service_role (SQL Editor > Run)

create or replace function public.upsert_empresa_overrides(
  p_empresa_id uuid,
  p_overrides jsonb,
  p_kds_screens_limit integer,
  p_staff_limit integer
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.empresa_overrides (empresa_id, overrides, kds_screens_limit, staff_limit, created_at, updated_at)
  values (p_empresa_id, p_overrides, p_kds_screens_limit, p_staff_limit, now(), now())
  on conflict (empresa_id) do update
    set overrides = coalesce(excluded.overrides, empresa_overrides.overrides),
        kds_screens_limit = excluded.kds_screens_limit,
        staff_limit = excluded.staff_limit,
        updated_at = now();
end;
$$;

grant execute on function public.upsert_empresa_overrides(uuid, jsonb, integer, integer) to authenticated;
