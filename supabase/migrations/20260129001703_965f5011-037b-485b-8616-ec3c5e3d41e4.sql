-- Adicionar valor 'motoboy' ao enum app_role (se ainda não existir)
DO $$
BEGIN
  -- PostgreSQL não permite IF NOT EXISTS em ADD VALUE, então verificamos manualmente
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'motoboy' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'motoboy';
  END IF;
END $$;