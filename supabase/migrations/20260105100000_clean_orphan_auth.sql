-- ============================================
-- FIX: Limpar registros órfãos do Auth
-- ============================================

-- 1. Remover identidades órfãs
DELETE FROM auth.identities 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2. Remover sessões órfãs
DELETE FROM auth.sessions 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 3. Remover refresh tokens órfãos (cast para uuid)
DELETE FROM auth.refresh_tokens 
WHERE user_id::uuid NOT IN (SELECT id FROM auth.users);

-- 4. Verificar se existe algum registro com o email problemático nas tabelas do auth
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verificar em identities
  SELECT COUNT(*) INTO v_count 
  FROM auth.identities 
  WHERE email ILIKE '%claudinhoresendemoura%';
  RAISE NOTICE 'Identities com email: %', v_count;
  
  -- Verificar em users
  SELECT COUNT(*) INTO v_count 
  FROM auth.users 
  WHERE email ILIKE '%claudinhoresendemoura%';
  RAISE NOTICE 'Users com email: %', v_count;
END $$;

-- 5. Limpar qualquer vestígio do email específico (se existir)
DELETE FROM auth.identities WHERE email = 'claudinhoresendemoura@gmail.com';

-- Verificação final
DO $$
BEGIN
  RAISE NOTICE '✅ Limpeza de registros órfãos concluída!';
END $$;
