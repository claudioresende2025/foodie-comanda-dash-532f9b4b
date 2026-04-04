-- Create table for waiter calls
CREATE TABLE public.chamadas_garcom (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  mesa_id UUID NOT NULL,
  comanda_id UUID,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'atendida', 'cancelada')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atendida_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.chamadas_garcom ENABLE ROW LEVEL SECURITY;

-- Allow public to create calls (from menu)
CREATE POLICY "Public can create chamadas"
ON public.chamadas_garcom
FOR INSERT
WITH CHECK (true);

-- Allow staff to view and manage calls for their empresa
CREATE POLICY "Staff can view chamadas"
ON public.chamadas_garcom
FOR SELECT
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Staff can update chamadas"
ON public.chamadas_garcom
FOR UPDATE
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Public can view their own calls (by mesa_id)
CREATE POLICY "Public can view own chamadas"
ON public.chamadas_garcom
FOR SELECT
USING (true);

-- Enable realtime for chamadas
ALTER PUBLICATION supabase_realtime ADD TABLE public.chamadas_garcom;