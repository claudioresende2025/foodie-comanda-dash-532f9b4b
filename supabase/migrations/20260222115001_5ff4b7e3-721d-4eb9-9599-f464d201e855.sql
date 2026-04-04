
-- Fase 1: Atualizar trial_days de todos os planos para 14 dias
UPDATE public.planos SET trial_days = 14 WHERE trial_days IS NULL OR trial_days < 14;

-- Fase 5: Criar tabela de indicações
CREATE TABLE public.indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_indicadora_id uuid NOT NULL REFERENCES public.empresas(id),
  codigo_indicacao text UNIQUE NOT NULL,
  empresa_indicada_id uuid REFERENCES public.empresas(id),
  status text NOT NULL DEFAULT 'pendente',
  recompensa_aplicada boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  convertida_at timestamptz
);

ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresas podem ver suas indicacoes" ON public.indicacoes
  FOR SELECT USING (
    empresa_indicadora_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid())
    OR empresa_indicada_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Empresas podem criar indicacoes" ON public.indicacoes
  FOR INSERT WITH CHECK (
    empresa_indicadora_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Service role full access indicacoes" ON public.indicacoes
  FOR ALL USING (true) WITH CHECK (true);

-- Fase 6: Adicionar coluna trial_emails_sent em assinaturas
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS trial_emails_sent jsonb DEFAULT '[]'::jsonb;
