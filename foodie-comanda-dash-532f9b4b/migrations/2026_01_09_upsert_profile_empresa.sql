-- Migration: create RPC upsert_profile_empresa
-- Execute this with the Supabase service_role (SQL Editor > Run)

create or replace function public.upsert_profile_empresa(
  p_user_id uuid,
  p_empresa_id uuid,
  p_nome text,
  p_email text
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, empresa_id, nome, email, created_at, updated_at)
  values (p_user_id, p_empresa_id, p_nome, p_email, now(), now())
  on conflict (id) do update
    set empresa_id = excluded.empresa_id,
        nome = excluded.nome,
        email = excluded.email,
        updated_at = now();
end;
$$;

grant execute on function public.upsert_profile_empresa(uuid, uuid, text, text) to authenticated;
