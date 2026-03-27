


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'proprietario',
    'gerente',
    'garcom',
    'caixa',
    'motoboy'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."comanda_status" AS ENUM (
    'aberta',
    'fechada',
    'cancelada'
);


ALTER TYPE "public"."comanda_status" OWNER TO "postgres";


CREATE TYPE "public"."delivery_status" AS ENUM (
    'pendente',
    'confirmado',
    'em_preparo',
    'saiu_entrega',
    'entregue',
    'cancelado'
);


ALTER TYPE "public"."delivery_status" OWNER TO "postgres";


CREATE TYPE "public"."mesa_status" AS ENUM (
    'disponivel',
    'ocupada',
    'reservada',
    'juncao',
    'solicitou_fechamento',
    'aguardando_pagamento'
);


ALTER TYPE "public"."mesa_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."mesa_status" IS 'Status da mesa: disponivel, ocupada, reservada, juncao, solicitou_fechamento';



CREATE TYPE "public"."payment_method" AS ENUM (
    'dinheiro',
    'pix',
    'cartao_credito',
    'cartao_debito'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."pedido_status" AS ENUM (
    'pendente',
    'preparando',
    'pronto',
    'entregue',
    'cancelado'
);


ALTER TYPE "public"."pedido_status" OWNER TO "postgres";


CREATE TYPE "public"."refund_status" AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'canceled'
);


ALTER TYPE "public"."refund_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."abrir_comanda_e_ocupar_mesa"("p_empresa_id" "uuid", "p_mesa_id" "uuid", "p_qr_code_sessao" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_comanda_id uuid;
BEGIN
    -- 1. Cria a nova comanda
    INSERT INTO comandas (empresa_id, mesa_id, status, qr_code_sessao, total)
    VALUES (p_empresa_id, p_mesa_id, 'aberta', p_qr_code_sessao, 0)
    RETURNING id INTO v_comanda_id;

    -- 2. Atualiza o status da mesa para 'ocupada' (A CORREÇÃO PRINCIPAL)
    UPDATE mesas
    SET status = 'ocupada'
    WHERE id = p_mesa_id;

    RETURN v_comanda_id;
END;
$$;


ALTER FUNCTION "public"."abrir_comanda_e_ocupar_mesa"("p_empresa_id" "uuid", "p_mesa_id" "uuid", "p_qr_code_sessao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."abrir_comanda_e_ocupar_mesa"("p_empresa_id" "uuid", "p_mesa_id" "uuid", "p_items" "jsonb", "p_qr_code_sessao" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    new_comanda_id uuid;
    item_data jsonb;
    total_comanda numeric := 0;
BEGIN
    -- 1. Calcula o total
    SELECT COALESCE(SUM((item->>'subtotal')::numeric), 0) INTO total_comanda
    FROM jsonb_array_elements(p_items) AS item;

    -- 2. Cria e insere a nova comanda
    new_comanda_id := uuid_generate_v4();
    
    INSERT INTO comandas (id, empresa_id, mesa_id, status, qr_code_sessao, total, created_at)
    VALUES (new_comanda_id, p_empresa_id, p_mesa_id, 'aberta', p_qr_code_sessao, total_comanda, NOW());

    -- 3. Insere os pedidos (itens)
    FOR item_data IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO pedidos (
            comanda_id, 
            produto_id, 
            quantidade, 
            preco_unitario, 
            subtotal, 
            status_cozinha,
            notas_cliente,
            created_at
        )
        VALUES (
            new_comanda_id,
            (item_data->>'produto_id')::uuid,
            (item_data->>'quantidade')::numeric,
            (item_data->>'preco_unitario')::numeric,
            (item_data->>'subtotal')::numeric,
            'pendente', -- Status inicial correto
            item_data->>'notas_cliente',
            NOW()
        );
    END LOOP;

    -- 4. Ocupa a mesa
    UPDATE mesas
    SET status = 'ocupada'
    WHERE id = p_mesa_id;

    RETURN new_comanda_id;
END;
$$;


ALTER FUNCTION "public"."abrir_comanda_e_ocupar_mesa"("p_empresa_id" "uuid", "p_mesa_id" "uuid", "p_items" "jsonb", "p_qr_code_sessao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adicionar_pontos_por_pedido"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
DECLARE
    pontos_ganhos INT;
BEGIN
    -- Regra: 1 ponto para cada R$ 10,00 (baseado no subtotal)
    pontos_ganhos := FLOOR(NEW.subtotal / 10);

    IF pontos_ganhos > 0 THEN
        -- Insere ou atualiza o saldo
        INSERT INTO fidelidade_pontos (user_id, saldo, updated_at)
        VALUES (NEW.user_id, pontos_ganhos, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET saldo = fidelidade_pontos.saldo + pontos_ganhos, updated_at = NOW();

        -- Registra no histórico
        INSERT INTO fidelidade_transacoes (user_id, pontos, tipo, descricao)
        VALUES (NEW.user_id, pontos_ganhos, 'acumulo', 'Pontos ganhos no pedido #' || NEW.id);
    END IF;

    RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."adicionar_pontos_por_pedido"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_super_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verificar se já existe algum super admin
  SELECT COUNT(*) INTO v_count FROM public.super_admins WHERE ativo = true;
  
  -- Se não existe nenhum super admin, adicionar este usuário
  IF v_count = 0 THEN
    INSERT INTO public.super_admins (user_id, nome, email, ativo, permissoes)
    VALUES (
      NEW.id,
      COALESCE(NEW.nome, NEW.email),
      NEW.email,
      true,
      '["all"]'::jsonb
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE 'Super Admin criado automaticamente para: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_empresa_blocked"("p_empresa_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa RECORD;
  v_assinatura RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('blocked', true, 'reason', 'Empresa não encontrada');
  END IF;
  
  -- Verificar se está explicitamente bloqueada
  IF v_empresa.blocked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'blocked', true, 
      'reason', COALESCE(v_empresa.block_reason, 'Conta bloqueada'),
      'blocked_at', v_empresa.blocked_at
    );
  END IF;
  
  -- Buscar assinatura
  SELECT * INTO v_assinatura FROM public.assinaturas WHERE empresa_id = p_empresa_id;
  
  -- Se não tem assinatura, verificar trial da empresa
  IF NOT FOUND THEN
    IF v_empresa.trial_ends_at IS NOT NULL AND v_empresa.trial_ends_at < NOW() THEN
      RETURN jsonb_build_object(
        'blocked', true,
        'reason', 'Período de teste expirado',
        'trial_ended_at', v_empresa.trial_ends_at
      );
    END IF;
    
    -- Ainda no trial
    RETURN jsonb_build_object(
      'blocked', false,
      'status', 'trialing',
      'trial_ends_at', v_empresa.trial_ends_at,
      'days_remaining', GREATEST(0, EXTRACT(DAY FROM v_empresa.trial_ends_at - NOW()))
    );
  END IF;
  
  -- Verificar status da assinatura
  IF v_assinatura.status = 'active' THEN
    RETURN jsonb_build_object(
      'blocked', false,
      'status', 'active',
      'current_period_end', v_assinatura.current_period_end
    );
  ELSIF v_assinatura.status = 'trialing' THEN
    IF v_assinatura.trial_end < NOW() THEN
      RETURN jsonb_build_object(
        'blocked', true,
        'reason', 'Período de teste expirado',
        'trial_ended_at', v_assinatura.trial_end
      );
    END IF;
    RETURN jsonb_build_object(
      'blocked', false,
      'status', 'trialing',
      'trial_ends_at', v_assinatura.trial_end,
      'days_remaining', GREATEST(0, EXTRACT(DAY FROM v_assinatura.trial_end - NOW()))
    );
  ELSIF v_assinatura.status IN ('canceled', 'unpaid', 'past_due') THEN
    RETURN jsonb_build_object(
      'blocked', true,
      'reason', CASE v_assinatura.status 
        WHEN 'canceled' THEN 'Assinatura cancelada'
        WHEN 'unpaid' THEN 'Pagamento pendente'
        WHEN 'past_due' THEN 'Pagamento atrasado'
      END,
      'status', v_assinatura.status
    );
  END IF;
  
  RETURN jsonb_build_object('blocked', false, 'status', v_assinatura.status);
END;
$$;


ALTER FUNCTION "public"."check_empresa_blocked"("p_empresa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_super_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid() AND ativo = true
  );
END;
$$;


ALTER FUNCTION "public"."check_is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_mesas_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  limite integer;
  total integer;
BEGIN
  SELECT COALESCE(eo.mesas_limit, p.mesas_limit, 10)
    INTO limite
    FROM empresas em
    LEFT JOIN empresa_overrides eo ON eo.empresa_id = em.id
    LEFT JOIN assinaturas a ON a.empresa_id = em.id
    LEFT JOIN planos p ON p.id = a.plano_id
    WHERE em.id = NEW.empresa_id;

  SELECT count(*) INTO total FROM mesas WHERE empresa_id = NEW.empresa_id;

  IF limite IS NOT NULL AND (total + 1) > limite THEN
    RAISE EXCEPTION 'Limite de mesas atingido para este plano';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_mesas_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_trial_subscription"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Criar assinatura de trial automaticamente quando empresa é criada
  INSERT INTO public.assinaturas (empresa_id, status, trial_start, trial_end)
  VALUES (NEW.id, 'trialing', NOW(), NOW() + INTERVAL '7 days')
  ON CONFLICT (empresa_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_trial_subscription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_avaliacao_pendente"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_nome_restaurante TEXT;
  v_bairro TEXT;
BEGIN
  -- Só executar quando status muda para 'entregue'
  IF NEW.status = 'entregue' AND (OLD.status IS NULL OR OLD.status != 'entregue') THEN
    -- Buscar nome do restaurante
    SELECT nome_fantasia INTO v_nome_restaurante
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    -- Buscar bairro do endereço
    SELECT bairro INTO v_bairro
    FROM enderecos_cliente
    WHERE id = NEW.endereco_id;
    
    -- Inserir avaliação pendente (ignorar se já existe)
    INSERT INTO avaliacoes_pendentes (
      user_id,
      pedido_delivery_id,
      empresa_id,
      nome_restaurante,
      bairro
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.empresa_id,
      COALESCE(v_nome_restaurante, 'Restaurante'),
      v_bairro
    )
    ON CONFLICT (pedido_delivery_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."criar_avaliacao_pendente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debitar_pontos_fidelidade"("userid" "uuid", "qtd_pontos" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE fidelidade_pontos
    SET saldo = saldo - qtd_pontos,
        updated_at = NOW()
    WHERE user_id = userid AND saldo >= qtd_pontos;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Saldo de pontos insuficiente ou usuário não encontrado.';
    END IF;

    -- Registra a transação no histórico
    INSERT INTO fidelidade_transacoes (user_id, pontos, tipo, descricao)
    VALUES (userid, qtd_pontos, 'resgate', 'Resgate de desconto em pedido delivery');
END;
$$;


ALTER FUNCTION "public"."debitar_pontos_fidelidade"("userid" "uuid", "qtd_pontos" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."exec_sql"("sql" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  EXECUTE sql;
  RETURN '{}'::jsonb;
END;
$$;


ALTER FUNCTION "public"."exec_sql"("sql" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_pix"("p_valor" numeric, "p_comanda_id" "uuid", "p_empresa_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
    -- O SELECT deve retornar o JSON com as chaves esperadas pelo seu código React
    SELECT jsonb_build_object(
        'qr_code_url', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAO0A...', -- URL ou Base64 real do QR Code
        'pix_copia_cola', '00020101021226580014br.gov.bcb.pix.10.8256.0.4.79255010101041000000022204' || md5(p_comanda_id::text) || '5204000053039865802BR5913NOME COMPLETO6008CIDADE SP62070503***6304CA15', 
        'valor', p_valor
    );
$$;


ALTER FUNCTION "public"."gerar_pix"("p_valor" numeric, "p_comanda_id" "uuid", "p_empresa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_empresa_public_info"("_empresa_id" "uuid") RETURNS TABLE("id" "uuid", "nome_fantasia" "text", "logo_url" "text", "endereco_completo" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id, nome_fantasia, logo_url, endereco_completo
  FROM empresas
  WHERE id = _empresa_id
$$;


ALTER FUNCTION "public"."get_empresa_public_info"("_empresa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_empresa_publico"("p_empresa_id" "uuid") RETURNS TABLE("id" "uuid", "nome_fantasia" "text", "logo_url" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT e.id, e.nome_fantasia, e.logo_url
    FROM public.empresas e
    WHERE e.id = p_empresa_id;
$$;


ALTER FUNCTION "public"."get_empresa_publico"("p_empresa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_taxa_entrega_bairro"("p_empresa_id" "uuid", "p_bairro" "text") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_taxa DECIMAL(10, 2);
  v_taxa_padrao DECIMAL(10, 2);
BEGIN
  -- Buscar taxa do bairro
  SELECT taxa INTO v_taxa
  FROM taxas_bairro
  WHERE empresa_id = p_empresa_id
  AND bairro_normalizado = LOWER(TRIM(p_bairro))
  AND ativo = true
  LIMIT 1;
  
  -- Se encontrou, retornar
  IF v_taxa IS NOT NULL THEN
    RETURN v_taxa;
  END IF;
  
  -- Caso contrário, buscar taxa padrão da config_delivery
  SELECT taxa_entrega INTO v_taxa_padrao
  FROM config_delivery
  WHERE empresa_id = p_empresa_id
  LIMIT 1;
  
  RETURN COALESCE(v_taxa_padrao, 0);
END;
$$;


ALTER FUNCTION "public"."get_taxa_entrega_bairro"("p_empresa_id" "uuid", "p_bairro" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_empresa_id"("_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT empresa_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_empresa_id"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_nome TEXT;
BEGIN
  -- Extrair nome de forma segura
  v_nome := COALESCE(
    NEW.raw_user_meta_data ->> 'nome',
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Inserir profile
  BEGIN
    INSERT INTO public.profiles (id, nome, email, created_at, updated_at)
    VALUES (NEW.id, v_nome, NEW.email, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erros para não bloquear criação do usuário
    NULL;
  END;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_empresa_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND empresa_id = _empresa_id
      AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_empresa_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = p_user_id AND ativo = true
  );
END;
$$;


ALTER FUNCTION "public"."is_super_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin_direct"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid() AND ativo = true
  );
$$;


ALTER FUNCTION "public"."is_super_admin_direct"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."liberar_mesa"("p_mesa_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Log para debug
  RAISE NOTICE 'Liberando mesa: %', p_mesa_id;
  
  -- Atualiza a mesa para disponível
  UPDATE public.mesas 
  SET 
    status = 'disponivel', 
    mesa_juncao_id = NULL,
    updated_at = now()
  WHERE id = p_mesa_id;
  
  -- Se for uma mesa principal de junção, libera também as mesas filhas
  UPDATE public.mesas 
  SET 
    status = 'disponivel', 
    mesa_juncao_id = NULL,
    updated_at = now()
  WHERE mesa_juncao_id = p_mesa_id;
  
  RAISE NOTICE 'Mesa % liberada com sucesso', p_mesa_id;
END;
$$;


ALTER FUNCTION "public"."liberar_mesa"("p_mesa_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."liberar_mesa"("p_mesa_id" "uuid") IS 'Libera uma mesa (e suas mesas filhas de junção) para status disponível';



CREATE OR REPLACE FUNCTION "public"."processar_fidelidade_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Só age se o status mudar para 'entregue'
    IF (NEW.status = 'entregue' AND (OLD.status IS NULL OR OLD.status <> 'entregue')) THEN
        BEGIN
            -- Tenta inserir os pontos de forma segura
            INSERT INTO fidelidade_pontos (user_id, empresa_id, saldo)
            VALUES (NEW.user_id, NEW.empresa_id, 1)
            ON CONFLICT (user_id) DO UPDATE SET saldo = fidelidade_pontos.saldo + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Ignora erros e permite que o pedido seja salvo (Crucial para image_efb604)
            RETURN NEW;
        END;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."processar_fidelidade_entrega"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."solicitar_fechamento_mesa"("p_mesa_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE mesas
  SET status = 'solicitou_fechamento', updated_at = now()
  WHERE id = p_mesa_id
    AND status IN ('ocupada', 'disponivel');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa não encontrada ou já em processo de fechamento';
  END IF;
END;
$$;


ALTER FUNCTION "public"."solicitar_fechamento_mesa"("p_mesa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_entregador_location_to_pedidos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Quando a localização do entregador é atualizada,
    -- sincronizar para todos os pedidos dele que estão "saiu_entrega"
    
    IF NEW.is_active THEN
        -- Atualizar ou inserir localização em delivery_locations para cada pedido ativo
        INSERT INTO delivery_locations (pedido_delivery_id, latitude, longitude, precisao, updated_at)
        SELECT 
            pd.id,
            NEW.latitude,
            NEW.longitude,
            NEW.precisao,
            NOW()
        FROM pedidos_delivery pd
        WHERE pd.entregador_id = NEW.user_id
        AND pd.empresa_id = NEW.empresa_id
        AND pd.status = 'saiu_entrega'
        ON CONFLICT (pedido_delivery_id) 
        DO UPDATE SET 
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            precisao = EXCLUDED.precisao,
            updated_at = EXCLUDED.updated_at;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_entregador_location_to_pedidos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_mesa_status_on_comanda"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Quando uma nova comanda é criada com status 'aberta'
  IF TG_OP = 'INSERT' AND NEW.mesa_id IS NOT NULL AND NEW.status = 'aberta' THEN
    UPDATE public.mesas 
    SET status = 'ocupada', updated_at = now()
    WHERE id = NEW.mesa_id AND status = 'disponivel';
  END IF;
  
  -- Quando uma comanda é fechada ou cancelada
  IF TG_OP = 'UPDATE' AND NEW.mesa_id IS NOT NULL AND NEW.status IN ('fechada', 'cancelada') THEN
    -- Só muda para disponível se não houver outras comandas abertas para essa mesa
    IF NOT EXISTS (
      SELECT 1 FROM public.comandas 
      WHERE mesa_id = NEW.mesa_id 
      AND status = 'aberta' 
      AND id != NEW.id
    ) THEN
      UPDATE public.mesas 
      SET status = 'disponivel', mesa_juncao_id = NULL, updated_at = now()
      WHERE id = NEW.mesa_id;
      
      -- Também libera mesas filhas se houver junção
      UPDATE public.mesas 
      SET status = 'disponivel', mesa_juncao_id = NULL, updated_at = now()
      WHERE mesa_juncao_id = NEW.mesa_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_mesa_status_on_comanda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_empresa_overrides"("p_empresa_id" "uuid", "p_overrides" "jsonb" DEFAULT NULL::"jsonb", "p_kds_screens_limit" integer DEFAULT NULL::integer, "p_staff_limit" integer DEFAULT NULL::integer, "p_mesas_limit" integer DEFAULT NULL::integer, "p_garcom_limit" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.empresa_overrides (
    empresa_id, 
    overrides, 
    kds_screens_limit, 
    staff_limit, 
    mesas_limit, 
    garcom_limit, 
    created_at, 
    updated_at
  )
  VALUES (
    p_empresa_id, 
    COALESCE(p_overrides, '{}'::jsonb), 
    p_kds_screens_limit, 
    p_staff_limit, 
    p_mesas_limit, 
    p_garcom_limit, 
    now(), 
    now()
  )
  ON CONFLICT (empresa_id) DO UPDATE
    SET 
      overrides = CASE 
        WHEN p_overrides IS NOT NULL THEN p_overrides 
        ELSE empresa_overrides.overrides 
      END,
      kds_screens_limit = COALESCE(p_kds_screens_limit, empresa_overrides.kds_screens_limit),
      staff_limit = COALESCE(p_staff_limit, empresa_overrides.staff_limit),
      mesas_limit = COALESCE(p_mesas_limit, empresa_overrides.mesas_limit),
      garcom_limit = COALESCE(p_garcom_limit, empresa_overrides.garcom_limit),
      updated_at = now();
END;
$$;


ALTER FUNCTION "public"."upsert_empresa_overrides"("p_empresa_id" "uuid", "p_overrides" "jsonb", "p_kds_screens_limit" integer, "p_staff_limit" integer, "p_mesas_limit" integer, "p_garcom_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_profile_empresa"("p_user_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."upsert_profile_empresa"("p_user_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_belongs_to_empresa"("_user_id" "uuid", "_empresa_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND empresa_id = _empresa_id
  )
$$;


ALTER FUNCTION "public"."user_belongs_to_empresa"("_user_id" "uuid", "_empresa_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."analytics_eventos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "empresa_id" "uuid",
    "tipo_evento" "text" NOT NULL,
    "dados" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_eventos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assinaturas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "plano_id" "uuid",
    "status" "public"."subscription_status" DEFAULT 'trialing'::"public"."subscription_status",
    "stripe_customer_id" character varying(255),
    "stripe_subscription_id" character varying(255),
    "periodo" character varying(20) DEFAULT 'mensal'::character varying,
    "trial_start" timestamp with time zone DEFAULT "now"(),
    "trial_end" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "canceled_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "data_fim" timestamp with time zone,
    "data_inicio" timestamp with time zone DEFAULT "now"(),
    "plano_nome" "text"
);


ALTER TABLE "public"."assinaturas" OWNER TO "postgres";


COMMENT ON TABLE "public"."assinaturas" IS 'Assinaturas das empresas';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "acao" character varying(100) NOT NULL,
    "tabela" character varying(100),
    "registro_id" "uuid",
    "dados_antigos" "jsonb",
    "dados_novos" "jsonb",
    "ip_address" character varying(50),
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_logs" IS 'Logs de auditoria para ações importantes';



CREATE TABLE IF NOT EXISTS "public"."avaliacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "pedido_delivery_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nota_restaurante" integer NOT NULL,
    "nota_produto" integer,
    "comentario" "text",
    "nome_cliente" "text" NOT NULL,
    "bairro" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "avaliacoes_nota_produto_check" CHECK ((("nota_produto" IS NULL) OR (("nota_produto" >= 1) AND ("nota_produto" <= 5)))),
    CONSTRAINT "avaliacoes_nota_restaurante_check" CHECK ((("nota_restaurante" >= 1) AND ("nota_restaurante" <= 5)))
);


ALTER TABLE "public"."avaliacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avaliacoes_pendentes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pedido_delivery_id" "uuid" NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome_restaurante" "text" NOT NULL,
    "bairro" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expirado" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."avaliacoes_pendentes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."avaliacoes_stats" AS
 SELECT "empresa_id",
    "count"(*) AS "total_avaliacoes",
    "round"("avg"("nota_restaurante"), 2) AS "media_restaurante",
    "round"("avg"("nota_produto"), 2) AS "media_produto",
    "count"(
        CASE
            WHEN ("nota_restaurante" = 5) THEN 1
            ELSE NULL::integer
        END) AS "cinco_estrelas",
    "count"(
        CASE
            WHEN ("nota_restaurante" = 4) THEN 1
            ELSE NULL::integer
        END) AS "quatro_estrelas",
    "count"(
        CASE
            WHEN ("nota_restaurante" = 3) THEN 1
            ELSE NULL::integer
        END) AS "tres_estrelas",
    "count"(
        CASE
            WHEN ("nota_restaurante" = 2) THEN 1
            ELSE NULL::integer
        END) AS "duas_estrelas",
    "count"(
        CASE
            WHEN ("nota_restaurante" = 1) THEN 1
            ELSE NULL::integer
        END) AS "uma_estrela"
   FROM "public"."avaliacoes"
  GROUP BY "empresa_id";


ALTER VIEW "public"."avaliacoes_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."caixas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "usuario_id" "uuid",
    "valor_abertura" numeric(10,2) NOT NULL,
    "valor_fechamento" numeric(10,2),
    "data_abertura" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" NOT NULL,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "data_fechamento" timestamp with time zone
);


ALTER TABLE "public"."caixas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "ordem" integer DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chamadas_garcom" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "mesa_id" "uuid",
    "comanda_id" "uuid",
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "atendida_at" timestamp with time zone,
    "motivo" "text" DEFAULT 'atendimento'::"text"
);


ALTER TABLE "public"."chamadas_garcom" OWNER TO "postgres";


COMMENT ON COLUMN "public"."chamadas_garcom"."motivo" IS 'Tipo de chamada: atendimento (chamar garçom), fechamento (solicitar conta)';



CREATE TABLE IF NOT EXISTS "public"."chat_conversas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'ativa'::"text",
    "ultima_mensagem" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_conversas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_mensagens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversa_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "mensagem" "text" NOT NULL,
    "tipo" "text" DEFAULT 'texto'::"text",
    "lida" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_mensagens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enderecos_cliente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_cliente" "text" NOT NULL,
    "telefone" "text" NOT NULL,
    "cep" "text" NOT NULL,
    "rua" "text" NOT NULL,
    "numero" "text" NOT NULL,
    "bairro" "text",
    "cidade" "text",
    "estado" "text" DEFAULT 'SP'::"text",
    "complemento" "text",
    "referencia" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "is_default" boolean DEFAULT false,
    "latitude" numeric,
    "longitude" numeric
);


ALTER TABLE "public"."enderecos_cliente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pedidos_delivery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "user_id" "uuid",
    "endereco_id" "uuid",
    "cupom_id" "uuid",
    "status" "text" DEFAULT 'pendente'::"text",
    "forma_pagamento" "text",
    "notas" "text",
    "tempo_estimado" "text",
    "subtotal" numeric(10,2) DEFAULT 0,
    "taxa_entrega" numeric(10,2) DEFAULT 0,
    "desconto" numeric(10,2) DEFAULT 0,
    "total" numeric(10,2) DEFAULT 0,
    "troco_para" numeric(10,2) DEFAULT 0,
    "stripe_payment_intent_id" "text",
    "stripe_payment_status" "text",
    "agendado_para" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stripe_payment_id" "text",
    "metodo_pagamento" "text" DEFAULT 'pix'::"text",
    "entregador_id" "uuid"
);

ALTER TABLE ONLY "public"."pedidos_delivery" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."pedidos_delivery" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."pedidos_delivery" OWNER TO "postgres";


COMMENT ON TABLE "public"."pedidos_delivery" IS 'Pedidos de delivery realizados pelos clientes';



CREATE OR REPLACE VIEW "public"."clientes_stats" AS
 SELECT "pd"."empresa_id",
    "pd"."user_id",
    "max"(COALESCE("a"."nome_cliente", "ec"."nome_cliente", 'Cliente'::"text")) AS "nome_cliente",
    "max"("ec"."bairro") AS "bairro",
    "count"("pd"."id") AS "total_pedidos",
    "sum"("pd"."total") AS "valor_total",
    "max"("pd"."created_at") AS "ultimo_pedido",
    "min"("pd"."created_at") AS "primeiro_pedido"
   FROM (("public"."pedidos_delivery" "pd"
     LEFT JOIN "public"."enderecos_cliente" "ec" ON (("pd"."endereco_id" = "ec"."id")))
     LEFT JOIN "public"."avaliacoes" "a" ON (("pd"."id" = "a"."pedido_delivery_id")))
  WHERE ("pd"."status" <> 'cancelado'::"text")
  GROUP BY "pd"."empresa_id", "pd"."user_id";


ALTER VIEW "public"."clientes_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comandas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "mesa_id" "uuid",
    "status" "text" DEFAULT 'aberta'::"text" NOT NULL,
    "nome_cliente" "text",
    "forma_pagamento" "text",
    "troco_para" numeric,
    "total" numeric,
    "data_fechamento" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "qr_code_sessao" "text",
    "telefone_cliente" "text",
    "comanda_mestre_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "formas_pagamento" "text"
);


ALTER TABLE "public"."comandas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."combo_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "combo_id" "uuid" NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "quantidade" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."combo_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."combos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "preco_combo" numeric NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "imagem_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."combos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config_delivery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "delivery_ativo" boolean DEFAULT false NOT NULL,
    "taxa_entrega" numeric(10,2) DEFAULT 0.00,
    "pedido_minimo" numeric(10,2) DEFAULT 0.00,
    "tempo_estimado_min" integer,
    "tempo_estimado_max" integer,
    "raio_entrega_km" numeric(5,2),
    "horario_abertura" time without time zone,
    "horario_fechamento" time without time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone,
    "aceita_pix" boolean DEFAULT true,
    "valor_minimo_pedido" numeric(10,2) DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "dias_funcionamento" integer[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]
);


ALTER TABLE "public"."config_delivery" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config_fiscal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "regime_tributario" "text" DEFAULT 'simples_nacional'::"text",
    "codigo_ibge_cidade" "text",
    "logradouro" "text",
    "numero" "text",
    "bairro" "text",
    "cep" "text",
    "uf" "text" DEFAULT 'SP'::"text",
    "api_token_nfe" "text",
    "modo_producao" boolean DEFAULT false,
    "certificado_path" "text",
    "certificado_senha" "text",
    "csc" "text",
    "csc_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."config_fiscal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config_sistema" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "chave" character varying(100) NOT NULL,
    "valor" "text",
    "tipo" character varying(50) DEFAULT 'string'::character varying,
    "descricao" "text",
    "grupo" character varying(50),
    "editavel" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."config_sistema" OWNER TO "postgres";


COMMENT ON TABLE "public"."config_sistema" IS 'Configurações globais do sistema (Stripe, PIX, etc)';



CREATE TABLE IF NOT EXISTS "public"."cupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "codigo" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "valor_minimo" numeric(10,2) DEFAULT 0,
    "data_expiracao" timestamp with time zone,
    "uso_maximo" integer,
    "uso_atual" integer DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_delivery_id" "uuid" NOT NULL,
    "latitude" numeric(10,8) NOT NULL,
    "longitude" numeric(11,8) NOT NULL,
    "precisao" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."delivery_locations" REPLICA IDENTITY FULL;


ALTER TABLE "public"."delivery_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_tracking" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pedido_delivery_id" "uuid" NOT NULL,
    "status" "public"."delivery_status" NOT NULL,
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."delivery_tracking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresa_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "overrides" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "kds_screens_limit" integer,
    "staff_limit" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "mesas_limit" integer,
    "garcom_limit" integer
);


ALTER TABLE "public"."empresa_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresa_overrides_backup" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "overrides" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "kds_screens_limit" integer,
    "staff_limit" integer,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."empresa_overrides_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_fantasia" "text" NOT NULL,
    "usuario_proprietario_id" "uuid",
    "cnpj" "text",
    "endereco_completo" "text",
    "inscricao_estadual" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "chave_pix" "text",
    "slug" "text",
    "ativo" boolean DEFAULT true,
    "usuario_id" "uuid",
    "trial_ends_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "subscription_status" character varying(50) DEFAULT 'trialing'::character varying,
    "blocked_at" timestamp with time zone,
    "block_reason" "text"
);


ALTER TABLE "public"."empresas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entregador_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "latitude" numeric(10,8) NOT NULL,
    "longitude" numeric(11,8) NOT NULL,
    "precisao" numeric(10,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entregador_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fidelidade_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "pontos_por_real" numeric DEFAULT 1 NOT NULL,
    "pontos_necessarios" integer DEFAULT 100 NOT NULL,
    "valor_recompensa" numeric DEFAULT 10 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fidelidade_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fidelidade_pontos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "telefone_cliente" "text" NOT NULL,
    "pontos_atuais" integer DEFAULT 0,
    "user_id" "uuid",
    "saldo" numeric DEFAULT 0,
    "pontos" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "historico" "jsonb" DEFAULT '[]'::"jsonb"
);

ALTER TABLE ONLY "public"."fidelidade_pontos" REPLICA IDENTITY FULL;


ALTER TABLE "public"."fidelidade_pontos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itens_delivery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_delivery_id" "uuid",
    "produto_id" "uuid",
    "nome_produto" "text" NOT NULL,
    "quantidade" integer NOT NULL,
    "preco_unitario" numeric(10,2) NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."itens_delivery" OWNER TO "postgres";


COMMENT ON TABLE "public"."itens_delivery" IS 'Itens individuais de cada pedido de delivery';



CREATE TABLE IF NOT EXISTS "public"."mesas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "numero_mesa" integer NOT NULL,
    "status" "public"."mesa_status" DEFAULT 'disponivel'::"public"."mesa_status",
    "capacidade" integer DEFAULT 4,
    "mesa_juncao_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "numero" "text",
    "nome" "text"
);


ALTER TABLE "public"."mesas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimentacoes_caixa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caixa_id" "uuid" NOT NULL,
    "comanda_id" "uuid",
    "pedido_delivery_id" "uuid",
    "tipo" "text" NOT NULL,
    "forma_pagamento" "public"."payment_method" NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."movimentacoes_caixa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notas_fiscais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "comanda_id" "uuid",
    "pedido_delivery_id" "uuid",
    "numero_nota" "text",
    "serie" "text",
    "chave_acesso" "text",
    "status" "text" DEFAULT 'pendente'::"text",
    "danfe_url" "text",
    "xml_url" "text",
    "valor_total" numeric,
    "erro_sefaz" "text",
    "api_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notas_fiscais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificacoes_push" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "tipo" "text",
    "data" "jsonb",
    "lida" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notificacoes_push" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos_assinatura" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "assinatura_id" "uuid",
    "empresa_id" "uuid" NOT NULL,
    "stripe_payment_intent_id" character varying(255),
    "stripe_invoice_id" character varying(255),
    "valor" numeric(10,2) NOT NULL,
    "status" character varying(50) NOT NULL,
    "metodo_pagamento" character varying(50),
    "descricao" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pagamentos_assinatura" OWNER TO "postgres";


COMMENT ON TABLE "public"."pagamentos_assinatura" IS 'Histórico de pagamentos de assinaturas';



CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."password_reset_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pedidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comanda_id" "uuid" NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "quantidade" numeric NOT NULL,
    "preco_unitario" numeric NOT NULL,
    "subtotal" numeric NOT NULL,
    "status_cozinha" "public"."pedido_status" DEFAULT 'pendente'::"public"."pedido_status" NOT NULL,
    "notas_cliente" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone,
    "empresa_id" "uuid"
);

ALTER TABLE ONLY "public"."pedidos" REPLICA IDENTITY FULL;


ALTER TABLE "public"."pedidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nome" character varying(100) NOT NULL,
    "descricao" "text",
    "preco_mensal" numeric(10,2),
    "preco_anual" numeric(10,2),
    "stripe_price_id_mensal" character varying(255),
    "stripe_price_id_anual" character varying(255),
    "recursos" "jsonb" DEFAULT '[]'::"jsonb",
    "limite_pedidos_mes" integer,
    "limite_mesas" integer,
    "limite_usuarios" integer,
    "destaque" boolean DEFAULT false,
    "ativo" boolean DEFAULT true,
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text",
    "preco" numeric(10,2),
    "trial_days" integer DEFAULT 0,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "mesas_limit" integer
);


ALTER TABLE "public"."planos" OWNER TO "postgres";


COMMENT ON TABLE "public"."planos" IS 'Planos de assinatura disponíveis';



CREATE TABLE IF NOT EXISTS "public"."produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "categoria_id" "uuid",
    "nome" "text" NOT NULL,
    "descricao" "text",
    "preco" numeric(10,2) NOT NULL,
    "imagem_url" "text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "variacoes" "jsonb",
    "ncm" "text"
);


ALTER TABLE "public"."produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "empresa_id" "uuid",
    "nome" "text" NOT NULL,
    "email" "text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'user'::"text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promocoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "nome" "text" NOT NULL,
    "descricao" "text",
    "tipo" "text" DEFAULT 'fixo'::"text" NOT NULL,
    "valor_desconto" numeric(10,2) DEFAULT 0,
    "data_inicio" timestamp with time zone DEFAULT "now"(),
    "data_fim" timestamp with time zone,
    "ativa" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "preco" numeric(10,2),
    "preco_promocional" numeric(10,2),
    CONSTRAINT "promocoes_preco_positive" CHECK ((("preco" IS NULL) OR ("preco" > (0)::numeric))),
    CONSTRAINT "promocoes_preco_promocional_positive" CHECK ((("preco_promocional" IS NULL) OR ("preco_promocional" > (0)::numeric))),
    CONSTRAINT "promocoes_valor_desconto_nonneg" CHECK (("valor_desconto" >= (0)::numeric))
);


ALTER TABLE "public"."promocoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "empresa_id" "uuid",
    "endpoint" "text" NOT NULL,
    "p256dh" "text" DEFAULT ''::"text" NOT NULL,
    "auth_key" "text" DEFAULT ''::"text" NOT NULL,
    "type" "text" DEFAULT 'admin'::"text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reembolsos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "empresa_id" "uuid",
    "pedido_delivery_id" "uuid",
    "assinatura_id" "uuid",
    "tipo" character varying(50) NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "motivo" "text",
    "status" "public"."refund_status" DEFAULT 'pending'::"public"."refund_status",
    "stripe_refund_id" character varying(255),
    "metodo_original" character varying(50),
    "dados_reembolso" "jsonb",
    "processado_por" "uuid",
    "processado_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reembolsos" OWNER TO "postgres";


COMMENT ON TABLE "public"."reembolsos" IS 'Solicitações de reembolso (pedidos ou assinaturas)';



CREATE TABLE IF NOT EXISTS "public"."relatorio_clientes_inativos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "ultima_compra" timestamp with time zone,
    "dias_inativo" integer,
    "total_gasto" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."relatorio_clientes_inativos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relatorio_fidelidade_clientes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "total_pontos" integer DEFAULT 0,
    "pontos_gastos" integer DEFAULT 0,
    "total_pedidos" integer DEFAULT 0,
    "valor_total_gasto" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."relatorio_fidelidade_clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relatorio_horarios_pico" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "dia_semana" integer NOT NULL,
    "hora" integer NOT NULL,
    "quantidade_pedidos" integer DEFAULT 0,
    "receita" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."relatorio_horarios_pico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relatorio_produtos_vendidos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "produto_id" "uuid",
    "nome_produto" "text" NOT NULL,
    "quantidade_vendida" integer DEFAULT 0,
    "receita_total" numeric(10,2) DEFAULT 0,
    "periodo_inicio" "date" NOT NULL,
    "periodo_fim" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."relatorio_produtos_vendidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relatorio_vendas_diarias" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "total_vendas" numeric(10,2) DEFAULT 0,
    "total_pedidos" integer DEFAULT 0,
    "ticket_medio" numeric(10,2) DEFAULT 0,
    "total_delivery" numeric(10,2) DEFAULT 0,
    "total_presencial" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."relatorio_vendas_diarias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "mesa_id" "uuid",
    "nome_cliente" "text" NOT NULL,
    "telefone_cliente" "text",
    "email_cliente" "text",
    "data_reserva" "date" NOT NULL,
    "horario_reserva" time without time zone NOT NULL,
    "numero_pessoas" integer NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."reservas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."super_admins" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nome" character varying(255),
    "email" character varying(255),
    "ativo" boolean DEFAULT true,
    "permissoes" "jsonb" DEFAULT '["all"]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."super_admins" OWNER TO "postgres";


COMMENT ON TABLE "public"."super_admins" IS 'Usuários com acesso de super administrador';



CREATE TABLE IF NOT EXISTS "public"."taxas_bairro" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "bairro" "text" NOT NULL,
    "bairro_normalizado" "text" GENERATED ALWAYS AS ("lower"(TRIM(BOTH FROM "bairro"))) STORED NOT NULL,
    "taxa" numeric(10,2) DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."taxas_bairro" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas_concluidas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "comanda_id" "uuid",
    "mesa_id" "uuid",
    "valor_subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "valor_desconto" numeric(10,2) DEFAULT 0,
    "valor_taxa_servico" numeric(10,2) DEFAULT 0,
    "valor_couver" numeric(10,2) DEFAULT 0,
    "valor_total" numeric(10,2) NOT NULL,
    "forma_pagamento" character varying(50) NOT NULL,
    "formas_pagamento_detalhes" "jsonb",
    "troco_para" numeric(10,2),
    "processado_por" "uuid",
    "tipo_processamento" character varying(20) DEFAULT 'caixa'::character varying,
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendas_concluidas" OWNER TO "postgres";


COMMENT ON TABLE "public"."vendas_concluidas" IS 'Registro financeiro de todas as vendas concluídas para relatórios';



COMMENT ON COLUMN "public"."vendas_concluidas"."tipo_processamento" IS 'caixa = fechado pelo caixa, garcom = "dar baixa" pelo garçom';



CREATE OR REPLACE VIEW "public"."vendas_por_bairro" AS
 SELECT "pd"."empresa_id",
    COALESCE("ec"."bairro", 'Não informado'::"text") AS "bairro",
    "count"("pd"."id") AS "total_pedidos",
    "sum"("pd"."total") AS "valor_total",
    "round"("avg"("pd"."total"), 2) AS "ticket_medio"
   FROM ("public"."pedidos_delivery" "pd"
     LEFT JOIN "public"."enderecos_cliente" "ec" ON (("pd"."endereco_id" = "ec"."id")))
  WHERE ("pd"."status" <> 'cancelado'::"text")
  GROUP BY "pd"."empresa_id", "ec"."bairro";


ALTER VIEW "public"."vendas_por_bairro" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event" "text" NOT NULL,
    "referencia" "text",
    "empresa_id" "uuid",
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_signature" "text",
    "raw_body" "text",
    "status" "text"
);


ALTER TABLE "public"."webhook_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."analytics_eventos"
    ADD CONSTRAINT "analytics_eventos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assinaturas"
    ADD CONSTRAINT "assinaturas_empresa_id_key" UNIQUE ("empresa_id");



ALTER TABLE ONLY "public"."assinaturas"
    ADD CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_pedido_unique" UNIQUE ("pedido_delivery_id");



ALTER TABLE ONLY "public"."avaliacoes_pendentes"
    ADD CONSTRAINT "avaliacoes_pendentes_pedido_unique" UNIQUE ("pedido_delivery_id");



ALTER TABLE ONLY "public"."avaliacoes_pendentes"
    ADD CONSTRAINT "avaliacoes_pendentes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."caixas"
    ADD CONSTRAINT "caixas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chamadas_garcom"
    ADD CONSTRAINT "chamadas_garcom_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_conversas"
    ADD CONSTRAINT "chat_conversas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_mensagens"
    ADD CONSTRAINT "chat_mensagens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "comandas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."combos"
    ADD CONSTRAINT "combos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_delivery"
    ADD CONSTRAINT "config_delivery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_fiscal"
    ADD CONSTRAINT "config_fiscal_empresa_id_key" UNIQUE ("empresa_id");



ALTER TABLE ONLY "public"."config_fiscal"
    ADD CONSTRAINT "config_fiscal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_sistema"
    ADD CONSTRAINT "config_sistema_chave_key" UNIQUE ("chave");



ALTER TABLE ONLY "public"."config_sistema"
    ADD CONSTRAINT "config_sistema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cupons"
    ADD CONSTRAINT "cupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_locations"
    ADD CONSTRAINT "delivery_locations_pedido_unique" UNIQUE ("pedido_delivery_id");



ALTER TABLE ONLY "public"."delivery_locations"
    ADD CONSTRAINT "delivery_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_tracking"
    ADD CONSTRAINT "delivery_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa_overrides_backup"
    ADD CONSTRAINT "empresa_overrides_backup_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa_overrides"
    ADD CONSTRAINT "empresa_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enderecos_cliente"
    ADD CONSTRAINT "enderecos_cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entregador_locations"
    ADD CONSTRAINT "entregador_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entregador_locations"
    ADD CONSTRAINT "entregador_locations_user_empresa_unique" UNIQUE ("user_id", "empresa_id");



ALTER TABLE ONLY "public"."fidelidade_config"
    ADD CONSTRAINT "fidelidade_config_empresa_id_key" UNIQUE ("empresa_id");



ALTER TABLE ONLY "public"."fidelidade_config"
    ADD CONSTRAINT "fidelidade_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fidelidade_pontos"
    ADD CONSTRAINT "fidelidade_pontos_empresa_id_telefone_key" UNIQUE ("empresa_id", "telefone_cliente");



ALTER TABLE ONLY "public"."fidelidade_pontos"
    ADD CONSTRAINT "fidelidade_pontos_empresa_id_user_id_key" UNIQUE ("empresa_id", "user_id");



ALTER TABLE ONLY "public"."fidelidade_pontos"
    ADD CONSTRAINT "fidelidade_pontos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itens_delivery"
    ADD CONSTRAINT "itens_delivery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mesas"
    ADD CONSTRAINT "mesas_empresa_id_numero_mesa_key" UNIQUE ("empresa_id", "numero_mesa");



ALTER TABLE ONLY "public"."mesas"
    ADD CONSTRAINT "mesas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas_fiscais"
    ADD CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificacoes_push"
    ADD CONSTRAINT "notificacoes_push_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos_assinatura"
    ADD CONSTRAINT "pagamentos_assinatura_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."pedidos_delivery"
    ADD CONSTRAINT "pedidos_delivery_id_unique" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_id_unique" UNIQUE ("id");



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planos"
    ADD CONSTRAINT "planos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promocoes"
    ADD CONSTRAINT "promocoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reembolsos"
    ADD CONSTRAINT "reembolsos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relatorio_clientes_inativos"
    ADD CONSTRAINT "relatorio_clientes_inativos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relatorio_fidelidade_clientes"
    ADD CONSTRAINT "relatorio_fidelidade_clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relatorio_horarios_pico"
    ADD CONSTRAINT "relatorio_horarios_pico_empresa_id_dia_semana_hora_key" UNIQUE ("empresa_id", "dia_semana", "hora");



ALTER TABLE ONLY "public"."relatorio_horarios_pico"
    ADD CONSTRAINT "relatorio_horarios_pico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relatorio_produtos_vendidos"
    ADD CONSTRAINT "relatorio_produtos_vendidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relatorio_vendas_diarias"
    ADD CONSTRAINT "relatorio_vendas_diarias_empresa_id_data_key" UNIQUE ("empresa_id", "data");



ALTER TABLE ONLY "public"."relatorio_vendas_diarias"
    ADD CONSTRAINT "relatorio_vendas_diarias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."taxas_bairro"
    ADD CONSTRAINT "taxas_bairro_empresa_bairro_unique" UNIQUE ("empresa_id", "bairro_normalizado");



ALTER TABLE ONLY "public"."taxas_bairro"
    ADD CONSTRAINT "taxas_bairro_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_delivery"
    ADD CONSTRAINT "unique_empresa_config" UNIQUE ("empresa_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_empresa_id_role_key" UNIQUE ("user_id", "empresa_id", "role");



ALTER TABLE ONLY "public"."vendas_concluidas"
    ADD CONSTRAINT "vendas_concluidas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "caixas_empresa_id_idx" ON "public"."caixas" USING "btree" ("empresa_id");



CREATE INDEX "caixas_usuario_id_idx" ON "public"."caixas" USING "btree" ("usuario_id");



CREATE INDEX "chamadas_garcom_comanda_id_idx" ON "public"."chamadas_garcom" USING "btree" ("comanda_id");



CREATE INDEX "chamadas_garcom_empresa_id_idx" ON "public"."chamadas_garcom" USING "btree" ("empresa_id");



CREATE INDEX "chamadas_garcom_mesa_id_idx" ON "public"."chamadas_garcom" USING "btree" ("mesa_id");



CREATE INDEX "config_delivery_empresa_id_idx" ON "public"."config_delivery" USING "btree" ("empresa_id");



CREATE INDEX "idx_analytics_empresa" ON "public"."analytics_eventos" USING "btree" ("empresa_id");



CREATE INDEX "idx_assinaturas_empresa" ON "public"."assinaturas" USING "btree" ("empresa_id");



CREATE INDEX "idx_assinaturas_status" ON "public"."assinaturas" USING "btree" ("status");



CREATE INDEX "idx_assinaturas_stripe_customer" ON "public"."assinaturas" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_assinaturas_stripe_subscription" ON "public"."assinaturas" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_audit_logs_acao" ON "public"."audit_logs" USING "btree" ("acao");



CREATE INDEX "idx_audit_logs_user" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_avaliacoes_created" ON "public"."avaliacoes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_avaliacoes_empresa" ON "public"."avaliacoes" USING "btree" ("empresa_id");



CREATE INDEX "idx_avaliacoes_nota_restaurante" ON "public"."avaliacoes" USING "btree" ("nota_restaurante");



CREATE INDEX "idx_avaliacoes_pendentes_empresa" ON "public"."avaliacoes_pendentes" USING "btree" ("empresa_id");



CREATE INDEX "idx_avaliacoes_pendentes_expirado" ON "public"."avaliacoes_pendentes" USING "btree" ("expirado") WHERE ("expirado" = false);



CREATE INDEX "idx_avaliacoes_pendentes_user" ON "public"."avaliacoes_pendentes" USING "btree" ("user_id");



CREATE INDEX "idx_avaliacoes_user" ON "public"."avaliacoes" USING "btree" ("user_id");



CREATE INDEX "idx_chat_conversas_empresa" ON "public"."chat_conversas" USING "btree" ("empresa_id");



CREATE INDEX "idx_chat_conversas_user" ON "public"."chat_conversas" USING "btree" ("user_id");



CREATE INDEX "idx_chat_mensagens_conversa" ON "public"."chat_mensagens" USING "btree" ("conversa_id");



CREATE INDEX "idx_comandas_empresa_id" ON "public"."comandas" USING "btree" ("empresa_id");



CREATE INDEX "idx_config_sistema_grupo" ON "public"."config_sistema" USING "btree" ("grupo");



CREATE INDEX "idx_delivery_locations_pedido" ON "public"."delivery_locations" USING "btree" ("pedido_delivery_id");



CREATE INDEX "idx_delivery_tracking_pedido" ON "public"."delivery_tracking" USING "btree" ("pedido_delivery_id");



CREATE INDEX "idx_empresas_subscription_status" ON "public"."empresas" USING "btree" ("subscription_status");



CREATE INDEX "idx_empresas_trial" ON "public"."empresas" USING "btree" ("trial_ends_at");



CREATE INDEX "idx_enderecos_cliente_user_id" ON "public"."enderecos_cliente" USING "btree" ("user_id");



CREATE INDEX "idx_entregador_locations_active" ON "public"."entregador_locations" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_entregador_locations_empresa" ON "public"."entregador_locations" USING "btree" ("empresa_id");



CREATE INDEX "idx_entregador_locations_user" ON "public"."entregador_locations" USING "btree" ("user_id");



CREATE INDEX "idx_itens_delivery_pedido_id" ON "public"."itens_delivery" USING "btree" ("pedido_delivery_id");



CREATE INDEX "idx_mesas_empresa_id" ON "public"."mesas" USING "btree" ("empresa_id");



CREATE INDEX "idx_notificacoes_lida" ON "public"."notificacoes_push" USING "btree" ("user_id", "lida");



CREATE INDEX "idx_notificacoes_user" ON "public"."notificacoes_push" USING "btree" ("user_id");



CREATE INDEX "idx_pagamentos_assinatura" ON "public"."pagamentos_assinatura" USING "btree" ("assinatura_id");



CREATE INDEX "idx_pagamentos_assinatura_assinatura_id" ON "public"."pagamentos_assinatura" USING "btree" ("assinatura_id");



CREATE INDEX "idx_pagamentos_empresa" ON "public"."pagamentos_assinatura" USING "btree" ("empresa_id");



CREATE INDEX "idx_pedidos_comanda_status" ON "public"."pedidos" USING "btree" ("comanda_id", "status_cozinha");



CREATE INDEX "idx_pedidos_delivery_empresa_id" ON "public"."pedidos_delivery" USING "btree" ("empresa_id");



CREATE INDEX "idx_pedidos_delivery_entregador" ON "public"."pedidos_delivery" USING "btree" ("entregador_id");



CREATE INDEX "idx_pedidos_delivery_status" ON "public"."pedidos_delivery" USING "btree" ("status");



CREATE INDEX "idx_pedidos_delivery_stripe_payment" ON "public"."pedidos_delivery" USING "btree" ("stripe_payment_id");



CREATE INDEX "idx_pedidos_delivery_user_id" ON "public"."pedidos_delivery" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_planos_slug_unique" ON "public"."planos" USING "btree" ("slug");



CREATE INDEX "idx_profiles_id_empresa_id" ON "public"."profiles" USING "btree" ("id", "empresa_id");



CREATE INDEX "idx_reembolsos_assinatura_id" ON "public"."reembolsos" USING "btree" ("assinatura_id");



CREATE INDEX "idx_reembolsos_empresa" ON "public"."reembolsos" USING "btree" ("empresa_id");



CREATE INDEX "idx_reembolsos_empresa_id" ON "public"."reembolsos" USING "btree" ("empresa_id");



CREATE INDEX "idx_reembolsos_pedido_delivery_id" ON "public"."reembolsos" USING "btree" ("pedido_delivery_id");



CREATE INDEX "idx_reembolsos_status" ON "public"."reembolsos" USING "btree" ("status");



CREATE INDEX "idx_relatorio_fidelidade_empresa" ON "public"."relatorio_fidelidade_clientes" USING "btree" ("empresa_id");



CREATE INDEX "idx_relatorio_horarios_empresa" ON "public"."relatorio_horarios_pico" USING "btree" ("empresa_id");



CREATE INDEX "idx_relatorio_inativos_empresa" ON "public"."relatorio_clientes_inativos" USING "btree" ("empresa_id");



CREATE INDEX "idx_relatorio_produtos_empresa" ON "public"."relatorio_produtos_vendidos" USING "btree" ("empresa_id");



CREATE INDEX "idx_relatorio_vendas_empresa_data" ON "public"."relatorio_vendas_diarias" USING "btree" ("empresa_id", "data");



CREATE INDEX "idx_taxas_bairro_ativo" ON "public"."taxas_bairro" USING "btree" ("ativo") WHERE ("ativo" = true);



CREATE INDEX "idx_taxas_bairro_empresa" ON "public"."taxas_bairro" USING "btree" ("empresa_id");



CREATE INDEX "idx_taxas_bairro_normalizado" ON "public"."taxas_bairro" USING "btree" ("bairro_normalizado");



CREATE INDEX "idx_vendas_concluidas_data" ON "public"."vendas_concluidas" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_vendas_concluidas_empresa" ON "public"."vendas_concluidas" USING "btree" ("empresa_id");



CREATE INDEX "idx_vendas_concluidas_forma_pagamento" ON "public"."vendas_concluidas" USING "btree" ("forma_pagamento");



CREATE INDEX "idx_webhook_logs_created_at" ON "public"."webhook_logs" USING "btree" ("created_at");



CREATE INDEX "idx_webhook_logs_empresa" ON "public"."webhook_logs" USING "btree" ("empresa_id");



CREATE INDEX "idx_webhook_logs_stripe_signature" ON "public"."webhook_logs" USING "btree" ("stripe_signature");



CREATE INDEX "movimentacoes_caixa_caixa_id_idx" ON "public"."movimentacoes_caixa" USING "btree" ("caixa_id");



CREATE INDEX "movimentacoes_caixa_comanda_id_idx" ON "public"."movimentacoes_caixa" USING "btree" ("comanda_id");



CREATE INDEX "movimentacoes_caixa_pedido_delivery_id_idx" ON "public"."movimentacoes_caixa" USING "btree" ("pedido_delivery_id");



CREATE UNIQUE INDEX "planos_slug_uindex" ON "public"."planos" USING "btree" ("slug");



CREATE INDEX "reservas_data_reserva_idx" ON "public"."reservas" USING "btree" ("data_reserva");



CREATE INDEX "reservas_empresa_id_idx" ON "public"."reservas" USING "btree" ("empresa_id");



CREATE INDEX "reservas_mesa_id_idx" ON "public"."reservas" USING "btree" ("mesa_id");



CREATE INDEX "reservas_nome_cliente_idx" ON "public"."reservas" USING "btree" ("nome_cliente");



CREATE UNIQUE INDEX "uniq_empresa_overrides_empresa_id" ON "public"."empresa_overrides" USING "btree" ("empresa_id");



CREATE INDEX "webhook_logs_created_idx" ON "public"."webhook_logs" USING "btree" ("created_at");



CREATE INDEX "webhook_logs_empresa_idx" ON "public"."webhook_logs" USING "btree" ("empresa_id");



CREATE OR REPLACE TRIGGER "criar_avaliacao_pendente_trigger" AFTER INSERT OR UPDATE ON "public"."pedidos_delivery" FOR EACH ROW EXECUTE FUNCTION "public"."criar_avaliacao_pendente"();



CREATE OR REPLACE TRIGGER "sync_entregador_location_trigger" AFTER INSERT OR UPDATE ON "public"."entregador_locations" FOR EACH ROW EXECUTE FUNCTION "public"."sync_entregador_location_to_pedidos"();



CREATE OR REPLACE TRIGGER "trigger_auto_super_admin" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."auto_super_admin"();



CREATE OR REPLACE TRIGGER "trigger_check_mesas_limit" BEFORE INSERT ON "public"."mesas" FOR EACH ROW EXECUTE FUNCTION "public"."check_mesas_limit"();



CREATE OR REPLACE TRIGGER "trigger_create_trial" AFTER INSERT ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."create_trial_subscription"();



CREATE OR REPLACE TRIGGER "trigger_update_mesa_status" AFTER INSERT OR UPDATE ON "public"."comandas" FOR EACH ROW EXECUTE FUNCTION "public"."update_mesa_status_on_comanda"();



CREATE OR REPLACE TRIGGER "update_categorias_updated_at" BEFORE UPDATE ON "public"."categorias" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_chat_conversas_updated_at" BEFORE UPDATE ON "public"."chat_conversas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_comandas_updated_at" BEFORE UPDATE ON "public"."comandas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_combos_updated_at" BEFORE UPDATE ON "public"."combos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_empresas_updated_at" BEFORE UPDATE ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_entregador_locations_updated_at" BEFORE UPDATE ON "public"."entregador_locations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_fidelidade_config_updated_at" BEFORE UPDATE ON "public"."fidelidade_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mesas_updated_at" BEFORE UPDATE ON "public"."mesas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_produtos_updated_at" BEFORE UPDATE ON "public"."produtos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_taxas_bairro_updated_at" BEFORE UPDATE ON "public"."taxas_bairro" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."analytics_eventos"
    ADD CONSTRAINT "analytics_eventos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assinaturas"
    ADD CONSTRAINT "assinaturas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assinaturas"
    ADD CONSTRAINT "assinaturas_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_pedido_delivery_id_fkey" FOREIGN KEY ("pedido_delivery_id") REFERENCES "public"."pedidos_delivery"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes_pendentes"
    ADD CONSTRAINT "avaliacoes_pendentes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes_pendentes"
    ADD CONSTRAINT "avaliacoes_pendentes_pedido_delivery_id_fkey" FOREIGN KEY ("pedido_delivery_id") REFERENCES "public"."pedidos_delivery"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversas"
    ADD CONSTRAINT "chat_conversas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversas"
    ADD CONSTRAINT "chat_conversas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_mensagens"
    ADD CONSTRAINT "chat_mensagens_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "public"."chat_conversas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_mensagens"
    ADD CONSTRAINT "chat_mensagens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "comandas_comanda_mestre_id_fkey" FOREIGN KEY ("comanda_mestre_id") REFERENCES "public"."comandas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "comandas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "comandas_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id");



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."combos"
    ADD CONSTRAINT "combos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."config_fiscal"
    ADD CONSTRAINT "config_fiscal_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."cupons"
    ADD CONSTRAINT "cupons_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_locations"
    ADD CONSTRAINT "delivery_locations_pedido_delivery_id_fkey" FOREIGN KEY ("pedido_delivery_id") REFERENCES "public"."pedidos_delivery"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_tracking"
    ADD CONSTRAINT "delivery_tracking_pedido_delivery_id_fkey" FOREIGN KEY ("pedido_delivery_id") REFERENCES "public"."pedidos_delivery"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresa_overrides"
    ADD CONSTRAINT "empresa_overrides_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_usuario_proprietario_id_fkey" FOREIGN KEY ("usuario_proprietario_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."enderecos_cliente"
    ADD CONSTRAINT "enderecos_cliente_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entregador_locations"
    ADD CONSTRAINT "entregador_locations_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fidelidade_config"
    ADD CONSTRAINT "fidelidade_config_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fidelidade_pontos"
    ADD CONSTRAINT "fidelidade_pontos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fidelidade_pontos"
    ADD CONSTRAINT "fidelidade_pontos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "fk_caixa" FOREIGN KEY ("caixa_id") REFERENCES "public"."caixas"("id");



ALTER TABLE ONLY "public"."caixas"
    ADD CONSTRAINT "fk_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."chamadas_garcom"
    ADD CONSTRAINT "fk_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."config_delivery"
    ADD CONSTRAINT "fk_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "fk_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."vendas_concluidas"
    ADD CONSTRAINT "fk_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "fk_empresa_proprietario" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chamadas_garcom"
    ADD CONSTRAINT "fk_mesa" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id");



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "fk_mesa" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id");



ALTER TABLE ONLY "public"."caixas"
    ADD CONSTRAINT "fk_usuario" FOREIGN KEY ("usuario_id") REFERENCES "public"."user_roles"("id");



ALTER TABLE ONLY "public"."itens_delivery"
    ADD CONSTRAINT "itens_delivery_pedido_delivery_id_fkey" FOREIGN KEY ("pedido_delivery_id") REFERENCES "public"."pedidos_delivery"("id") ON DELETE CASCADE;



COMMENT ON CONSTRAINT "itens_delivery_pedido_delivery_id_fkey" ON "public"."itens_delivery" IS 'Relacionamento entre itens e pedidos de delivery';



ALTER TABLE ONLY "public"."itens_delivery"
    ADD CONSTRAINT "itens_delivery_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id");



ALTER TABLE ONLY "public"."mesas"
    ADD CONSTRAINT "mesas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mesas"
    ADD CONSTRAINT "mesas_mesa_juncao_id_fkey" FOREIGN KEY ("mesa_juncao_id") REFERENCES "public"."mesas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notas_fiscais"
    ADD CONSTRAINT "notas_fiscais_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "public"."comandas"("id");



ALTER TABLE ONLY "public"."notas_fiscais"
    ADD CONSTRAINT "notas_fiscais_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."notas_fiscais"
    ADD CONSTRAINT "notas_fiscais_pedido_delivery_id_fkey" FOREIGN KEY ("pedido_delivery_id") REFERENCES "public"."pedidos_delivery"("id");



ALTER TABLE ONLY "public"."notificacoes_push"
    ADD CONSTRAINT "notificacoes_push_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos_assinatura"
    ADD CONSTRAINT "pagamentos_assinatura_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "public"."assinaturas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pagamentos_assinatura"
    ADD CONSTRAINT "pagamentos_assinatura_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "public"."comandas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos_delivery"
    ADD CONSTRAINT "pedidos_delivery_cupom_id_fkey" FOREIGN KEY ("cupom_id") REFERENCES "public"."cupons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedidos_delivery"
    ADD CONSTRAINT "pedidos_delivery_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos_delivery"
    ADD CONSTRAINT "pedidos_delivery_endereco_id_fkey" FOREIGN KEY ("endereco_id") REFERENCES "public"."enderecos_cliente"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedidos_delivery"
    ADD CONSTRAINT "pedidos_delivery_entregador_id_fkey" FOREIGN KEY ("entregador_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promocoes"
    ADD CONSTRAINT "promocoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reembolsos"
    ADD CONSTRAINT "reembolsos_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "public"."assinaturas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reembolsos"
    ADD CONSTRAINT "reembolsos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reembolsos"
    ADD CONSTRAINT "reembolsos_pedido_delivery_id_fkey" FOREIGN KEY ("pedido_delivery_id") REFERENCES "public"."pedidos_delivery"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reembolsos"
    ADD CONSTRAINT "reembolsos_processado_por_fkey" FOREIGN KEY ("processado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."relatorio_clientes_inativos"
    ADD CONSTRAINT "relatorio_clientes_inativos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relatorio_clientes_inativos"
    ADD CONSTRAINT "relatorio_clientes_inativos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relatorio_fidelidade_clientes"
    ADD CONSTRAINT "relatorio_fidelidade_clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relatorio_fidelidade_clientes"
    ADD CONSTRAINT "relatorio_fidelidade_clientes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relatorio_horarios_pico"
    ADD CONSTRAINT "relatorio_horarios_pico_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relatorio_produtos_vendidos"
    ADD CONSTRAINT "relatorio_produtos_vendidos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relatorio_produtos_vendidos"
    ADD CONSTRAINT "relatorio_produtos_vendidos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relatorio_vendas_diarias"
    ADD CONSTRAINT "relatorio_vendas_diarias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."taxas_bairro"
    ADD CONSTRAINT "taxas_bairro_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendas_concluidas"
    ADD CONSTRAINT "vendas_concluidas_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "public"."comandas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vendas_concluidas"
    ADD CONSTRAINT "vendas_concluidas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendas_concluidas"
    ADD CONSTRAINT "vendas_concluidas_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vendas_concluidas"
    ADD CONSTRAINT "vendas_concluidas_processado_por_fkey" FOREIGN KEY ("processado_por") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



CREATE POLICY "Admin cupons access" ON "public"."cupons" TO "authenticated" USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Admin fidelidade pontos access" ON "public"."fidelidade_pontos" TO "authenticated" USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Admin gerencia sua empresa" ON "public"."empresas" TO "authenticated" USING (("auth"."uid"() = "usuario_id")) WITH CHECK (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Admin promocoes access" ON "public"."promocoes" TO "authenticated" USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Allow anon insert enderecos_cliente" ON "public"."enderecos_cliente" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anon insert itens_delivery" ON "public"."itens_delivery" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow anon insert pedidos_delivery" ON "public"."pedidos_delivery" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow anon to insert order if comanda is open" ON "public"."pedidos" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."comandas" "c"
  WHERE (("c"."id" = "pedidos"."comanda_id") AND ("c"."status" = 'aberta'::"text")))));



CREATE POLICY "Allow anonymous insert on open comanda" ON "public"."pedidos" FOR INSERT TO "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."comandas" "c"
  WHERE (("c"."id" = "pedidos"."comanda_id") AND ("c"."status" = 'aberta'::"text")))));



CREATE POLICY "Allow anonymous read access to active comanda" ON "public"."comandas" FOR SELECT TO "anon" USING (("status" = 'aberta'::"text"));



CREATE POLICY "Allow anonymous read access to comandas" ON "public"."comandas" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."empresas" "e"
  WHERE ("e"."id" = "comandas"."empresa_id"))));



CREATE POLICY "Allow anonymous read access to companies based on slug" ON "public"."empresas" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to orders on open comanda" ON "public"."pedidos" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."comandas" "c"
  WHERE (("c"."id" = "pedidos"."comanda_id") AND ("c"."status" = 'aberta'::"text")))));



CREATE POLICY "Allow anonymous read access to products" ON "public"."produtos" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to tables by company" ON "public"."mesas" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."empresas" "e"
  WHERE ("e"."id" = "mesas"."empresa_id"))));



CREATE POLICY "Allow authenticated insert enderecos_cliente" ON "public"."enderecos_cliente" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated to select comanda by empresa_id" ON "public"."comandas" FOR SELECT TO "authenticated" USING (("empresa_id" = ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Allow authenticated to select mesas by empresa_id" ON "public"."mesas" FOR SELECT TO "authenticated", "authenticator" USING (("empresa_id" = ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Allow authenticated to select products by empresa_id" ON "public"."produtos" FOR SELECT TO "authenticated" USING (("empresa_id" = ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Allow authenticated to update comanda status" ON "public"."comandas" FOR UPDATE TO "authenticated" USING (("empresa_id" = ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("empresa_id" = ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Allow authenticated to update mesa status" ON "public"."mesas" FOR UPDATE TO "authenticated" USING (("empresa_id" = ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("empresa_id" = ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Allow authenticated to update their company's orders status" ON "public"."pedidos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."comandas" "c"
  WHERE (("c"."id" = "pedidos"."comanda_id") AND ("c"."empresa_id" = ( SELECT "profiles"."empresa_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to change status on their company tab" ON "public"."mesas" FOR UPDATE TO "authenticated" USING (("empresa_id" = ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("empresa_id" = ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Allow authenticated users to read their company's orders" ON "public"."pedidos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."comandas" "c"
  WHERE (("c"."id" = "pedidos"."comanda_id") AND ("c"."empresa_id" = ( SELECT "profiles"."empresa_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))));



CREATE POLICY "Allow public insert to chamadas_garcom" ON "public"."chamadas_garcom" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated can select caixas" ON "public"."caixas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can set mesa to disponivel" ON "public"."mesas" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (("status" = 'disponivel'::"public"."mesa_status"));



CREATE POLICY "Authenticated can update caixas" ON "public"."caixas" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can read super_admins" ON "public"."super_admins" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Configs de delivery são visíveis para todos" ON "public"."config_delivery" FOR SELECT USING (true);



CREATE POLICY "Empresas podem ver suas assinaturas" ON "public"."assinaturas" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."empresa_id" = "assinaturas"."empresa_id")))));



CREATE POLICY "Empresas são visíveis para todos" ON "public"."empresas" FOR SELECT USING (true);



CREATE POLICY "Empresas visíveis para todos" ON "public"."empresas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."comandas" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for users based on user_id" ON "public"."user_roles" FOR INSERT TO "authenticated", "anon", "authenticator" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable read access for all users" ON "public"."empresas" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users on public categories" ON "public"."categorias" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users on public products" ON "public"."produtos" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."comandas" FOR SELECT TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Gerenciar categorias da empresa" ON "public"."categorias" TO "authenticated" USING (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"()))) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"())));



CREATE POLICY "Gerenciar mesas da empresa" ON "public"."mesas" TO "authenticated", "authenticator" USING (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"()))) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"())));



CREATE POLICY "Gerenciar produtos da empresa" ON "public"."produtos" TO "authenticated" USING (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"()))) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"())));



CREATE POLICY "Leitura de endereços para todos" ON "public"."enderecos_cliente" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Leitura para todos" ON "public"."enderecos_cliente" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Leitura pública de categorias" ON "public"."categorias" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Leitura pública de config_delivery" ON "public"."config_delivery" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Leitura pública de empresas" ON "public"."empresas" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Leitura pública de mesas" ON "public"."mesas" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Leitura pública de produtos" ON "public"."produtos" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Owners can view subscription payments" ON "public"."pagamentos_assinatura" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."assinaturas" "a"
     JOIN "public"."profiles" "p" ON (("p"."empresa_id" = "a"."empresa_id")))
  WHERE (("a"."id" = "pagamentos_assinatura"."assinatura_id") AND ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Permitir inserção inicial de empresas" ON "public"."empresas" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Permitir inserção para usuários autenticados" ON "public"."empresas" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Permitir leitura pública de cupons" ON "public"."cupons" FOR SELECT USING (true);



CREATE POLICY "Permitir visualização pública para o delivery" ON "public"."empresas" FOR SELECT TO "anon" USING (("ativo" = true));



CREATE POLICY "Proprietários podem atualizar sua empresa" ON "public"."empresas" FOR UPDATE TO "authenticated" USING (("usuario_proprietario_id" = "auth"."uid"()));



CREATE POLICY "Proprietários podem gerenciar roles" ON "public"."user_roles" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."empresas"
  WHERE (("empresas"."id" = "user_roles"."empresa_id") AND ("empresas"."usuario_proprietario_id" = "auth"."uid"())))));



CREATE POLICY "Public can update mesa status to ocupada" ON "public"."mesas" FOR UPDATE USING (true) WITH CHECK (("status" = 'ocupada'::"public"."mesa_status"));



CREATE POLICY "Public can view active combos" ON "public"."combos" FOR SELECT USING (("ativo" = true));



CREATE POLICY "Public can view active fidelidade_config" ON "public"."fidelidade_config" FOR SELECT USING (("ativo" = true));



CREATE POLICY "Public can view combo_itens" ON "public"."combo_itens" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."combos" "c"
  WHERE (("c"."id" = "combo_itens"."combo_id") AND ("c"."ativo" = true)))));



CREATE POLICY "Public can view delivery by stripe session" ON "public"."pedidos_delivery" FOR SELECT USING (("stripe_payment_id" IS NOT NULL));



CREATE POLICY "Public can view empresa for delivery" ON "public"."empresas" FOR SELECT USING (true);



CREATE POLICY "Public can view empresa for menu" ON "public"."empresas" FOR SELECT USING (true);



CREATE POLICY "Public can view own address anon" ON "public"."enderecos_cliente" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public insert" ON "public"."enderecos_cliente" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."push_subscriptions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."super_admins" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Staff can manage combo_itens" ON "public"."combo_itens" USING ((EXISTS ( SELECT 1
   FROM "public"."combos" "c"
  WHERE (("c"."id" = "combo_itens"."combo_id") AND ("c"."empresa_id" = "public"."get_user_empresa_id"("auth"."uid"()))))));



CREATE POLICY "Staff can manage combos" ON "public"."combos" USING (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"())));



CREATE POLICY "Staff can manage delivery orders" ON "public"."pedidos_delivery" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "pedidos_delivery"."empresa_id")))));



CREATE POLICY "Staff can manage fidelidade_config" ON "public"."fidelidade_config" USING (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"())));



CREATE POLICY "Super admins can manage empresa overrides" ON "public"."empresa_overrides" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE (("super_admins"."user_id" = "auth"."uid"()) AND ("super_admins"."ativo" = true)))));



CREATE POLICY "Users can check own super_admin status" ON "public"."super_admins" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own addresses" ON "public"."enderecos_cliente" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own addresses" ON "public"."enderecos_cliente" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own empresa overrides" ON "public"."empresa_overrides" FOR SELECT TO "authenticated" USING ((("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE (("super_admins"."user_id" = "auth"."uid"()) AND ("super_admins"."ativo" = true))))));



CREATE POLICY "Users can view their own refunds" ON "public"."reembolsos" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."empresa_id" = "reembolsos"."empresa_id")))) OR ((("tipo")::"text" = 'pedido'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."pedidos_delivery" "pd"
  WHERE (("pd"."id" = "reembolsos"."pedido_delivery_id") AND ("pd"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users manage own subscriptions" ON "public"."push_subscriptions" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Usuarios podem inserir vendas" ON "public"."vendas_concluidas" FOR INSERT WITH CHECK (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Usuarios podem ver vendas da empresa" ON "public"."vendas_concluidas" FOR SELECT USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Usuários podem atualizar a própria empresa" ON "public"."empresas" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "usuario_id")) WITH CHECK (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuários podem criar próprio perfil" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Usuários podem excluir seus próprios endereços" ON "public"."enderecos_cliente" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuários podem ver a própria empresa" ON "public"."empresas" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuários podem ver perfis da mesma empresa" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"())) OR ("id" = "auth"."uid"())));



CREATE POLICY "Usuários podem ver seu próprio perfil" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Ver categorias da empresa" ON "public"."categorias" FOR SELECT TO "authenticated" USING (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"())));



CREATE POLICY "Ver mesas da empresa" ON "public"."mesas" FOR SELECT TO "authenticated" USING (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"())));



CREATE POLICY "Ver produtos da empresa" ON "public"."produtos" FOR SELECT TO "authenticated" USING (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"())));



CREATE POLICY "Ver roles da própria empresa" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("empresa_id" = "public"."get_user_empresa_id"("auth"."uid"())));



CREATE POLICY "View pedidos by comanda session" ON "public"."pedidos" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."comandas" "c"
  WHERE ("c"."id" = "pedidos"."comanda_id"))));



CREATE POLICY "allow anon to insert new comanda" ON "public"."comandas" FOR INSERT TO "authenticated", "anon", "authenticator" WITH CHECK (true);



ALTER TABLE "public"."analytics_eventos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_eventos_all" ON "public"."analytics_eventos" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "analytics_eventos"."empresa_id")))));



CREATE POLICY "anon_insert_delivery_items" ON "public"."itens_delivery" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "anon_insert_delivery_orders" ON "public"."pedidos_delivery" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



ALTER TABLE "public"."assinaturas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assinaturas_select" ON "public"."assinaturas" FOR SELECT USING ((("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE (("super_admins"."user_id" = "auth"."uid"()) AND ("super_admins"."ativo" = true))))));



CREATE POLICY "assinaturas_super_admin" ON "public"."assinaturas" USING ((EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE (("super_admins"."user_id" = "auth"."uid"()) AND ("super_admins"."ativo" = true)))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_super_admin" ON "public"."audit_logs" USING ((EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE (("super_admins"."user_id" = "auth"."uid"()) AND ("super_admins"."ativo" = true)))));



ALTER TABLE "public"."avaliacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "avaliacoes_insert" ON "public"."avaliacoes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."avaliacoes_pendentes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "avaliacoes_pendentes_delete_own" ON "public"."avaliacoes_pendentes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "avaliacoes_pendentes_insert" ON "public"."avaliacoes_pendentes" FOR INSERT WITH CHECK (true);



CREATE POLICY "avaliacoes_pendentes_select_own" ON "public"."avaliacoes_pendentes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "avaliacoes_select_own" ON "public"."avaliacoes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "avaliacoes_select_staff" ON "public"."avaliacoes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "avaliacoes"."empresa_id") AND ("ur"."role" = ANY (ARRAY['proprietario'::"public"."app_role", 'gerente'::"public"."app_role", 'garcom'::"public"."app_role", 'caixa'::"public"."app_role"]))))));



ALTER TABLE "public"."caixas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "caixas_delete_empresa" ON "public"."caixas" FOR DELETE USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "caixas_insert_empresa" ON "public"."caixas" FOR INSERT WITH CHECK (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "caixas_select_empresa" ON "public"."caixas" FOR SELECT USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "caixas_update_empresa" ON "public"."caixas" FOR UPDATE USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chamadas_garcom" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chamadas_garcom_all_authenticated" ON "public"."chamadas_garcom" TO "authenticated" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "chamadas_garcom_delete_auth" ON "public"."chamadas_garcom" FOR DELETE USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "chamadas_garcom_insert_empresa" ON "public"."chamadas_garcom" FOR INSERT WITH CHECK (("empresa_id" IS NOT NULL));



CREATE POLICY "chamadas_garcom_select_empresa" ON "public"."chamadas_garcom" FOR SELECT USING (("empresa_id" IS NOT NULL));



CREATE POLICY "chamadas_garcom_update_auth" ON "public"."chamadas_garcom" FOR UPDATE USING ((("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR ("empresa_id" IS NOT NULL)));



ALTER TABLE "public"."chat_conversas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_conversas_insert" ON "public"."chat_conversas" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "chat_conversas_select" ON "public"."chat_conversas" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."chat_mensagens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_mensagens_insert" ON "public"."chat_mensagens" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_conversas"
  WHERE (("chat_conversas"."id" = "chat_mensagens"."conversa_id") AND ("chat_conversas"."user_id" = "auth"."uid"())))));



CREATE POLICY "chat_mensagens_select" ON "public"."chat_mensagens" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_conversas"
  WHERE (("chat_conversas"."id" = "chat_mensagens"."conversa_id") AND ("chat_conversas"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."comandas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comandas_delete_auth" ON "public"."comandas" FOR DELETE USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "comandas_delete_permissive" ON "public"."comandas" FOR DELETE USING (true);



CREATE POLICY "comandas_insert_auth" ON "public"."comandas" FOR INSERT WITH CHECK (("empresa_id" IS NOT NULL));



CREATE POLICY "comandas_insert_permissive" ON "public"."comandas" FOR INSERT WITH CHECK (true);



CREATE POLICY "comandas_select_empresa" ON "public"."comandas" FOR SELECT USING (("empresa_id" IS NOT NULL));



CREATE POLICY "comandas_select_permissive" ON "public"."comandas" FOR SELECT USING (true);



CREATE POLICY "comandas_update_auth" ON "public"."comandas" FOR UPDATE USING ((("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR ("empresa_id" IS NOT NULL)));



CREATE POLICY "comandas_update_permissive" ON "public"."comandas" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."combo_itens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."combos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."config_delivery" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "config_delivery_all_authenticated" ON "public"."config_delivery" TO "authenticated" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."config_fiscal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."config_sistema" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "config_sistema_super_admin" ON "public"."config_sistema" USING ((EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE (("super_admins"."user_id" = "auth"."uid"()) AND ("super_admins"."ativo" = true)))));



ALTER TABLE "public"."cupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delivery_locations_insert_update" ON "public"."delivery_locations" USING (true) WITH CHECK (true);



CREATE POLICY "delivery_locations_select_all" ON "public"."delivery_locations" FOR SELECT USING (true);



ALTER TABLE "public"."delivery_tracking" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delivery_tracking_select" ON "public"."delivery_tracking" FOR SELECT USING (true);



ALTER TABLE "public"."empresa_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."empresa_overrides_backup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."empresas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empresas_insert_authenticated" ON "public"."empresas" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "empresas_select" ON "public"."empresas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "empresas_select_public" ON "public"."empresas" FOR SELECT USING (true);



CREATE POLICY "empresas_service_role" ON "public"."empresas" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "empresas_update" ON "public"."empresas" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "empresas_update_authenticated" ON "public"."empresas" FOR UPDATE USING (("id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."enderecos_cliente" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enderecos_cliente_delete_auth" ON "public"."enderecos_cliente" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "enderecos_cliente_insert_all" ON "public"."enderecos_cliente" FOR INSERT WITH CHECK (("nome_cliente" IS NOT NULL));



CREATE POLICY "enderecos_cliente_select_all" ON "public"."enderecos_cliente" FOR SELECT USING (("id" IS NOT NULL));



CREATE POLICY "enderecos_cliente_update_auth" ON "public"."enderecos_cliente" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR ("id" IS NOT NULL)));



ALTER TABLE "public"."entregador_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "entregador_locations_delete" ON "public"."entregador_locations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "entregador_locations_insert" ON "public"."entregador_locations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "entregador_locations_select_all" ON "public"."entregador_locations" FOR SELECT USING (true);



CREATE POLICY "entregador_locations_update" ON "public"."entregador_locations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."fidelidade_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fidelidade_pontos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itens_delivery" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "itens_delivery_delete_auth" ON "public"."itens_delivery" FOR DELETE USING (("pedido_delivery_id" IN ( SELECT "pedidos_delivery"."id"
   FROM "public"."pedidos_delivery"
  WHERE ("pedidos_delivery"."empresa_id" IN ( SELECT "profiles"."empresa_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "itens_delivery_insert_empresa" ON "public"."itens_delivery" FOR INSERT WITH CHECK (("pedido_delivery_id" IS NOT NULL));



CREATE POLICY "itens_delivery_select_empresa" ON "public"."itens_delivery" FOR SELECT USING (("pedido_delivery_id" IS NOT NULL));



CREATE POLICY "itens_delivery_select_via_pedido" ON "public"."itens_delivery" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pedidos_delivery" "pd"
  WHERE (("pd"."id" = "itens_delivery"."pedido_delivery_id") AND (("auth"."uid"() = "pd"."user_id") OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "pd"."empresa_id")))))))));



CREATE POLICY "itens_delivery_update_auth" ON "public"."itens_delivery" FOR UPDATE USING ((("pedido_delivery_id" IN ( SELECT "pedidos_delivery"."id"
   FROM "public"."pedidos_delivery"
  WHERE ("pedidos_delivery"."empresa_id" IN ( SELECT "profiles"."empresa_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))) OR ("pedido_delivery_id" IS NOT NULL)));



ALTER TABLE "public"."mesas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mesas_delete_auth" ON "public"."mesas" FOR DELETE USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "mesas_insert_auth" ON "public"."mesas" FOR INSERT WITH CHECK (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "mesas_select_empresa" ON "public"."mesas" FOR SELECT USING (("empresa_id" IS NOT NULL));



CREATE POLICY "mesas_update_auth" ON "public"."mesas" FOR UPDATE USING ((("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR ("empresa_id" IS NOT NULL)));



ALTER TABLE "public"."movimentacoes_caixa" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "movimentacoes_caixa_all_authenticated" ON "public"."movimentacoes_caixa" TO "authenticated" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."notas_fiscais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificacoes_push" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificacoes_push_select" ON "public"."notificacoes_push" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notificacoes_push_update" ON "public"."notificacoes_push" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."pagamentos_assinatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pagamentos_assinatura_select" ON "public"."pagamentos_assinatura" FOR SELECT USING ((("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE (("super_admins"."user_id" = "auth"."uid"()) AND ("super_admins"."ativo" = true))))));



ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pedidos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pedidos_delete_auth" ON "public"."pedidos" FOR DELETE USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "pedidos_delete_permissive" ON "public"."pedidos" FOR DELETE USING (true);



ALTER TABLE "public"."pedidos_delivery" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pedidos_delivery_delete_auth" ON "public"."pedidos_delivery" FOR DELETE USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "pedidos_delivery_insert_empresa" ON "public"."pedidos_delivery" FOR INSERT WITH CHECK (("empresa_id" IS NOT NULL));



CREATE POLICY "pedidos_delivery_select_empresa" ON "public"."pedidos_delivery" FOR SELECT USING (("empresa_id" IS NOT NULL));



CREATE POLICY "pedidos_delivery_select_own_or_staff" ON "public"."pedidos_delivery" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "pedidos_delivery"."empresa_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."empresas" "e" ON (("e"."usuario_proprietario_id" = "p"."id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("e"."id" = "pedidos_delivery"."empresa_id"))))));



COMMENT ON POLICY "pedidos_delivery_select_own_or_staff" ON "public"."pedidos_delivery" IS 'Permite clientes verem seus próprios pedidos e staff ver pedidos da empresa';



CREATE POLICY "pedidos_delivery_update_policy" ON "public"."pedidos_delivery" FOR UPDATE USING ((("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR ("user_id" = "auth"."uid"()) OR (("empresa_id" IS NOT NULL) AND ("auth"."uid"() IS NULL)) OR (("empresa_id" IS NOT NULL) AND ("auth"."uid"() IS NOT NULL))));



CREATE POLICY "pedidos_insert_empresa" ON "public"."pedidos" FOR INSERT WITH CHECK (("empresa_id" IS NOT NULL));



CREATE POLICY "pedidos_insert_permissive" ON "public"."pedidos" FOR INSERT WITH CHECK (true);



CREATE POLICY "pedidos_select_empresa" ON "public"."pedidos" FOR SELECT USING (("empresa_id" IS NOT NULL));



CREATE POLICY "pedidos_select_permissive" ON "public"."pedidos" FOR SELECT USING (true);



CREATE POLICY "pedidos_update_auth" ON "public"."pedidos" FOR UPDATE USING ((("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR ("empresa_id" IS NOT NULL)));



CREATE POLICY "pedidos_update_permissive" ON "public"."pedidos" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "permitir_criar_chamado_anonimo" ON "public"."chamadas_garcom" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "permitir_leitura_anonima" ON "public"."chamadas_garcom" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."planos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planos_select" ON "public"."planos" FOR SELECT USING (true);



ALTER TABLE "public"."produtos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."promocoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reembolsos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reembolsos_select" ON "public"."reembolsos" FOR SELECT USING ((("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE (("super_admins"."user_id" = "auth"."uid"()) AND ("super_admins"."ativo" = true))))));



CREATE POLICY "reembolsos_super_admin" ON "public"."reembolsos" USING ((EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE (("super_admins"."user_id" = "auth"."uid"()) AND ("super_admins"."ativo" = true)))));



ALTER TABLE "public"."relatorio_clientes_inativos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "relatorio_clientes_inativos_select" ON "public"."relatorio_clientes_inativos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "relatorio_clientes_inativos"."empresa_id")))));



ALTER TABLE "public"."relatorio_fidelidade_clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "relatorio_fidelidade_clientes_select" ON "public"."relatorio_fidelidade_clientes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "relatorio_fidelidade_clientes"."empresa_id")))));



ALTER TABLE "public"."relatorio_horarios_pico" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "relatorio_horarios_pico_select" ON "public"."relatorio_horarios_pico" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "relatorio_horarios_pico"."empresa_id")))));



ALTER TABLE "public"."relatorio_produtos_vendidos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "relatorio_produtos_vendidos_select" ON "public"."relatorio_produtos_vendidos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "relatorio_produtos_vendidos"."empresa_id")))));



ALTER TABLE "public"."relatorio_vendas_diarias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "relatorio_vendas_diarias_select" ON "public"."relatorio_vendas_diarias" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "relatorio_vendas_diarias"."empresa_id")))));



ALTER TABLE "public"."reservas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reservas_all_authenticated" ON "public"."reservas" TO "authenticated" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "service_role_all" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "staff_manage_delivery_items" ON "public"."itens_delivery" USING ((EXISTS ( SELECT 1
   FROM ("public"."pedidos_delivery" "pd"
     JOIN "public"."user_roles" "ur" ON (("ur"."empresa_id" = "pd"."empresa_id")))
  WHERE (("pd"."id" = "itens_delivery"."pedido_delivery_id") AND ("ur"."user_id" = "auth"."uid"())))));



CREATE POLICY "staff_manage_delivery_orders" ON "public"."pedidos_delivery" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "pedidos_delivery"."empresa_id")))));



ALTER TABLE "public"."super_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admins_manage" ON "public"."super_admins" TO "authenticated", "anon" USING ("public"."is_super_admin_direct"());



ALTER TABLE "public"."taxas_bairro" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "taxas_bairro_delete_staff" ON "public"."taxas_bairro" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "taxas_bairro"."empresa_id") AND ("ur"."role" = ANY (ARRAY['proprietario'::"public"."app_role", 'gerente'::"public"."app_role"]))))));



CREATE POLICY "taxas_bairro_insert_staff" ON "public"."taxas_bairro" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "taxas_bairro"."empresa_id") AND ("ur"."role" = ANY (ARRAY['proprietario'::"public"."app_role", 'gerente'::"public"."app_role"]))))));



CREATE POLICY "taxas_bairro_select_public" ON "public"."taxas_bairro" FOR SELECT USING ((("ativo" = true) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "taxas_bairro"."empresa_id") AND ("ur"."role" = ANY (ARRAY['proprietario'::"public"."app_role", 'gerente'::"public"."app_role"])))))));



CREATE POLICY "taxas_bairro_update_staff" ON "public"."taxas_bairro" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "taxas_bairro"."empresa_id") AND ("ur"."role" = ANY (ARRAY['proprietario'::"public"."app_role", 'gerente'::"public"."app_role"]))))));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_view_delivery_items" ON "public"."itens_delivery" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pedidos_delivery" "pd"
  WHERE (("pd"."id" = "itens_delivery"."pedido_delivery_id") AND (("pd"."user_id" = "auth"."uid"()) OR ("pd"."stripe_payment_id" IS NOT NULL) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."empresa_id" = "pd"."empresa_id")))))))));



ALTER TABLE "public"."vendas_concluidas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."caixas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."categorias";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chamadas_garcom";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comandas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."combo_itens";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."combos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."config_delivery";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."cupons";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."delivery_locations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."empresas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."enderecos_cliente";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."entregador_locations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."fidelidade_config";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."fidelidade_pontos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."itens_delivery";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."mesas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."movimentacoes_caixa";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pedidos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pedidos_delivery";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."produtos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."promocoes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."reservas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_roles";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."abrir_comanda_e_ocupar_mesa"("p_empresa_id" "uuid", "p_mesa_id" "uuid", "p_qr_code_sessao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."abrir_comanda_e_ocupar_mesa"("p_empresa_id" "uuid", "p_mesa_id" "uuid", "p_qr_code_sessao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."abrir_comanda_e_ocupar_mesa"("p_empresa_id" "uuid", "p_mesa_id" "uuid", "p_qr_code_sessao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."abrir_comanda_e_ocupar_mesa"("p_empresa_id" "uuid", "p_mesa_id" "uuid", "p_items" "jsonb", "p_qr_code_sessao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."abrir_comanda_e_ocupar_mesa"("p_empresa_id" "uuid", "p_mesa_id" "uuid", "p_items" "jsonb", "p_qr_code_sessao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."abrir_comanda_e_ocupar_mesa"("p_empresa_id" "uuid", "p_mesa_id" "uuid", "p_items" "jsonb", "p_qr_code_sessao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."adicionar_pontos_por_pedido"() TO "anon";
GRANT ALL ON FUNCTION "public"."adicionar_pontos_por_pedido"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."adicionar_pontos_por_pedido"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_empresa_blocked"("p_empresa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_empresa_blocked"("p_empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_empresa_blocked"("p_empresa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_mesas_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_mesas_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_mesas_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_trial_subscription"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_trial_subscription"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_trial_subscription"() TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_avaliacao_pendente"() TO "anon";
GRANT ALL ON FUNCTION "public"."criar_avaliacao_pendente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_avaliacao_pendente"() TO "service_role";



GRANT ALL ON FUNCTION "public"."debitar_pontos_fidelidade"("userid" "uuid", "qtd_pontos" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."debitar_pontos_fidelidade"("userid" "uuid", "qtd_pontos" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."debitar_pontos_fidelidade"("userid" "uuid", "qtd_pontos" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gerar_pix"("p_valor" numeric, "p_comanda_id" "uuid", "p_empresa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_pix"("p_valor" numeric, "p_comanda_id" "uuid", "p_empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_pix"("p_valor" numeric, "p_comanda_id" "uuid", "p_empresa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_empresa_public_info"("_empresa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_empresa_public_info"("_empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_empresa_public_info"("_empresa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_empresa_publico"("p_empresa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_empresa_publico"("p_empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_empresa_publico"("p_empresa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_taxa_entrega_bairro"("p_empresa_id" "uuid", "p_bairro" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_taxa_entrega_bairro"("p_empresa_id" "uuid", "p_bairro" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_taxa_entrega_bairro"("p_empresa_id" "uuid", "p_bairro" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_empresa_id"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_empresa_id"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_empresa_id"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_empresa_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_empresa_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_empresa_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin_direct"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin_direct"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin_direct"() TO "service_role";



GRANT ALL ON FUNCTION "public"."liberar_mesa"("p_mesa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."liberar_mesa"("p_mesa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."liberar_mesa"("p_mesa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."processar_fidelidade_entrega"() TO "anon";
GRANT ALL ON FUNCTION "public"."processar_fidelidade_entrega"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."processar_fidelidade_entrega"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."solicitar_fechamento_mesa"("p_mesa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."solicitar_fechamento_mesa"("p_mesa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."solicitar_fechamento_mesa"("p_mesa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_entregador_location_to_pedidos"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_entregador_location_to_pedidos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_entregador_location_to_pedidos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_mesa_status_on_comanda"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_mesa_status_on_comanda"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_mesa_status_on_comanda"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_empresa_overrides"("p_empresa_id" "uuid", "p_overrides" "jsonb", "p_kds_screens_limit" integer, "p_staff_limit" integer, "p_mesas_limit" integer, "p_garcom_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_empresa_overrides"("p_empresa_id" "uuid", "p_overrides" "jsonb", "p_kds_screens_limit" integer, "p_staff_limit" integer, "p_mesas_limit" integer, "p_garcom_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_empresa_overrides"("p_empresa_id" "uuid", "p_overrides" "jsonb", "p_kds_screens_limit" integer, "p_staff_limit" integer, "p_mesas_limit" integer, "p_garcom_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_profile_empresa"("p_user_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_profile_empresa"("p_user_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_profile_empresa"("p_user_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_belongs_to_empresa"("_user_id" "uuid", "_empresa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_belongs_to_empresa"("_user_id" "uuid", "_empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_belongs_to_empresa"("_user_id" "uuid", "_empresa_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."analytics_eventos" TO "anon";
GRANT ALL ON TABLE "public"."analytics_eventos" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_eventos" TO "service_role";



GRANT ALL ON TABLE "public"."assinaturas" TO "anon";
GRANT ALL ON TABLE "public"."assinaturas" TO "authenticated";
GRANT ALL ON TABLE "public"."assinaturas" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."avaliacoes" TO "anon";
GRANT ALL ON TABLE "public"."avaliacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."avaliacoes" TO "service_role";



GRANT ALL ON TABLE "public"."avaliacoes_pendentes" TO "anon";
GRANT ALL ON TABLE "public"."avaliacoes_pendentes" TO "authenticated";
GRANT ALL ON TABLE "public"."avaliacoes_pendentes" TO "service_role";



GRANT ALL ON TABLE "public"."avaliacoes_stats" TO "anon";
GRANT ALL ON TABLE "public"."avaliacoes_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."avaliacoes_stats" TO "service_role";



GRANT ALL ON TABLE "public"."caixas" TO "anon";
GRANT ALL ON TABLE "public"."caixas" TO "authenticated";
GRANT ALL ON TABLE "public"."caixas" TO "service_role";



GRANT ALL ON TABLE "public"."categorias" TO "anon";
GRANT ALL ON TABLE "public"."categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias" TO "service_role";



GRANT ALL ON TABLE "public"."chamadas_garcom" TO "anon";
GRANT ALL ON TABLE "public"."chamadas_garcom" TO "authenticated";
GRANT ALL ON TABLE "public"."chamadas_garcom" TO "service_role";



GRANT ALL ON TABLE "public"."chat_conversas" TO "anon";
GRANT ALL ON TABLE "public"."chat_conversas" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_conversas" TO "service_role";



GRANT ALL ON TABLE "public"."chat_mensagens" TO "anon";
GRANT ALL ON TABLE "public"."chat_mensagens" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_mensagens" TO "service_role";



GRANT ALL ON TABLE "public"."enderecos_cliente" TO "anon";
GRANT ALL ON TABLE "public"."enderecos_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."enderecos_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos_delivery" TO "anon";
GRANT ALL ON TABLE "public"."pedidos_delivery" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos_delivery" TO "service_role";



GRANT ALL ON TABLE "public"."clientes_stats" TO "anon";
GRANT ALL ON TABLE "public"."clientes_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes_stats" TO "service_role";



GRANT ALL ON TABLE "public"."comandas" TO "anon";
GRANT ALL ON TABLE "public"."comandas" TO "authenticated";
GRANT ALL ON TABLE "public"."comandas" TO "service_role";



GRANT ALL ON TABLE "public"."combo_itens" TO "anon";
GRANT ALL ON TABLE "public"."combo_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."combo_itens" TO "service_role";



GRANT ALL ON TABLE "public"."combos" TO "anon";
GRANT ALL ON TABLE "public"."combos" TO "authenticated";
GRANT ALL ON TABLE "public"."combos" TO "service_role";



GRANT ALL ON TABLE "public"."config_delivery" TO "anon";
GRANT ALL ON TABLE "public"."config_delivery" TO "authenticated";
GRANT ALL ON TABLE "public"."config_delivery" TO "service_role";



GRANT ALL ON TABLE "public"."config_fiscal" TO "anon";
GRANT ALL ON TABLE "public"."config_fiscal" TO "authenticated";
GRANT ALL ON TABLE "public"."config_fiscal" TO "service_role";



GRANT ALL ON TABLE "public"."config_sistema" TO "anon";
GRANT ALL ON TABLE "public"."config_sistema" TO "authenticated";
GRANT ALL ON TABLE "public"."config_sistema" TO "service_role";



GRANT ALL ON TABLE "public"."cupons" TO "anon";
GRANT ALL ON TABLE "public"."cupons" TO "authenticated";
GRANT ALL ON TABLE "public"."cupons" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_locations" TO "anon";
GRANT ALL ON TABLE "public"."delivery_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_locations" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_tracking" TO "anon";
GRANT ALL ON TABLE "public"."delivery_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."empresa_overrides" TO "anon";
GRANT ALL ON TABLE "public"."empresa_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."empresa_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."empresa_overrides_backup" TO "anon";
GRANT ALL ON TABLE "public"."empresa_overrides_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."empresa_overrides_backup" TO "service_role";



GRANT ALL ON TABLE "public"."empresas" TO "anon";
GRANT ALL ON TABLE "public"."empresas" TO "authenticated";
GRANT ALL ON TABLE "public"."empresas" TO "service_role";



GRANT ALL ON TABLE "public"."entregador_locations" TO "anon";
GRANT ALL ON TABLE "public"."entregador_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."entregador_locations" TO "service_role";



GRANT ALL ON TABLE "public"."fidelidade_config" TO "anon";
GRANT ALL ON TABLE "public"."fidelidade_config" TO "authenticated";
GRANT ALL ON TABLE "public"."fidelidade_config" TO "service_role";



GRANT ALL ON TABLE "public"."fidelidade_pontos" TO "anon";
GRANT ALL ON TABLE "public"."fidelidade_pontos" TO "authenticated";
GRANT ALL ON TABLE "public"."fidelidade_pontos" TO "service_role";



GRANT ALL ON TABLE "public"."itens_delivery" TO "anon";
GRANT ALL ON TABLE "public"."itens_delivery" TO "authenticated";
GRANT ALL ON TABLE "public"."itens_delivery" TO "service_role";



GRANT ALL ON TABLE "public"."mesas" TO "anon";
GRANT ALL ON TABLE "public"."mesas" TO "authenticated";
GRANT ALL ON TABLE "public"."mesas" TO "service_role";



GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "anon";
GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "authenticated";
GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "service_role";



GRANT ALL ON TABLE "public"."notas_fiscais" TO "anon";
GRANT ALL ON TABLE "public"."notas_fiscais" TO "authenticated";
GRANT ALL ON TABLE "public"."notas_fiscais" TO "service_role";



GRANT ALL ON TABLE "public"."notificacoes_push" TO "anon";
GRANT ALL ON TABLE "public"."notificacoes_push" TO "authenticated";
GRANT ALL ON TABLE "public"."notificacoes_push" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_assinatura" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos_assinatura" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_assinatura" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_tokens" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos" TO "anon";
GRANT ALL ON TABLE "public"."pedidos" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos" TO "service_role";



GRANT ALL ON TABLE "public"."planos" TO "anon";
GRANT ALL ON TABLE "public"."planos" TO "authenticated";
GRANT ALL ON TABLE "public"."planos" TO "service_role";



GRANT ALL ON TABLE "public"."produtos" TO "anon";
GRANT ALL ON TABLE "public"."produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promocoes" TO "anon";
GRANT ALL ON TABLE "public"."promocoes" TO "authenticated";
GRANT ALL ON TABLE "public"."promocoes" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."reembolsos" TO "anon";
GRANT ALL ON TABLE "public"."reembolsos" TO "authenticated";
GRANT ALL ON TABLE "public"."reembolsos" TO "service_role";



GRANT ALL ON TABLE "public"."relatorio_clientes_inativos" TO "anon";
GRANT ALL ON TABLE "public"."relatorio_clientes_inativos" TO "authenticated";
GRANT ALL ON TABLE "public"."relatorio_clientes_inativos" TO "service_role";



GRANT ALL ON TABLE "public"."relatorio_fidelidade_clientes" TO "anon";
GRANT ALL ON TABLE "public"."relatorio_fidelidade_clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."relatorio_fidelidade_clientes" TO "service_role";



GRANT ALL ON TABLE "public"."relatorio_horarios_pico" TO "anon";
GRANT ALL ON TABLE "public"."relatorio_horarios_pico" TO "authenticated";
GRANT ALL ON TABLE "public"."relatorio_horarios_pico" TO "service_role";



GRANT ALL ON TABLE "public"."relatorio_produtos_vendidos" TO "anon";
GRANT ALL ON TABLE "public"."relatorio_produtos_vendidos" TO "authenticated";
GRANT ALL ON TABLE "public"."relatorio_produtos_vendidos" TO "service_role";



GRANT ALL ON TABLE "public"."relatorio_vendas_diarias" TO "anon";
GRANT ALL ON TABLE "public"."relatorio_vendas_diarias" TO "authenticated";
GRANT ALL ON TABLE "public"."relatorio_vendas_diarias" TO "service_role";



GRANT ALL ON TABLE "public"."reservas" TO "anon";
GRANT ALL ON TABLE "public"."reservas" TO "authenticated";
GRANT ALL ON TABLE "public"."reservas" TO "service_role";



GRANT ALL ON TABLE "public"."super_admins" TO "anon";
GRANT ALL ON TABLE "public"."super_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."super_admins" TO "service_role";



GRANT ALL ON TABLE "public"."taxas_bairro" TO "anon";
GRANT ALL ON TABLE "public"."taxas_bairro" TO "authenticated";
GRANT ALL ON TABLE "public"."taxas_bairro" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_concluidas" TO "anon";
GRANT ALL ON TABLE "public"."vendas_concluidas" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_concluidas" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_por_bairro" TO "anon";
GRANT ALL ON TABLE "public"."vendas_por_bairro" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_por_bairro" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_logs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































