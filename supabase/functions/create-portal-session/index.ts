import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.21.0"

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
  })

  // 1. Validar Token do Usuário
  const authHeader = req.headers.get('Authorization')!
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await supabaseClient.auth.getUser()

  if (!user) return new Response("Não autorizado", { status: 401 })

  // 2. Buscar o stripe_customer_id no Banco
  const { data: assinatura } = await supabaseClient
    .from('assinaturas')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!assinatura?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: "Cliente não encontrado" }), { status: 404 })
  }

  // 3. Criar Sessão do Portal
  const session = await stripe.billingPortal.sessions.create({
    customer: assinatura.stripe_customer_id,
    return_url: `${req.headers.get('origin')}/perfil`, // Ajuste para sua rota de perfil
  })

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  })
})
