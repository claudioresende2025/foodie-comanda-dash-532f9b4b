-- Allow users to delete their own addresses
CREATE POLICY "Users can delete own addresses"
ON public.enderecos_cliente
FOR DELETE
USING (user_id = auth.uid());