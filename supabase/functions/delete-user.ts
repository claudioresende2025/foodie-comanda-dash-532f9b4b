
import { serve } from "std/server";
import { createClient } from "jsr:@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const { userId } = await req.json()
  if (!userId) return new Response('Missing userId', { status: 400 })

  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return new Response(error.message, { status: 500 })

  return new Response('OK', { status: 200 })
})
