-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Proprietários podem atualizar sua empresa" ON public.empresas;

-- Create a new policy that allows proprietarios and gerentes to update
CREATE POLICY "Staff can update empresa" 
ON public.empresas 
FOR UPDATE 
USING (
  usuario_proprietario_id = auth.uid() 
  OR has_role(auth.uid(), id, 'proprietario')
  OR has_role(auth.uid(), id, 'gerente')
);