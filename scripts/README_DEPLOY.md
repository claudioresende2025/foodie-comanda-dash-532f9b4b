Resumo de deploy para Lovable

Objetivo
- Aplicar todas as migrations e deployar todas as Edge Functions do repositório para o projeto Supabase de produção (Lovable).

Pré-requisitos
- Acesso ao projeto Lovable (project ref) e credenciais para executar migrations (service role DB URL ou supabase CLI autenticado com permissão de deploy).
- Supabase CLI instalado: https://supabase.com/docs/guides/cli
- Ter créditos/planos suficientes no projeto Lovable para deploys (Edge Functions não requerem créditos diretamente, mas operações no projeto precisam de projeto ativo).

Como usar (PowerShell)
1. Abra PowerShell no root do repositório.
2. Execute (substitua valores):

```powershell
$projectRef = 'zlwpxflqtyhdwanmupgy' # ref do projeto Lovable
$dbUrl = 'postgresql://postgres:<PASSWORD>@db.<project>.supabase.co:5432/postgres' # service_role connection string
.
\scripts\deploy_lovable.ps1 -ProjectRef $projectRef -DbUrl $dbUrl
```

Notas importantes
- O script executa os arquivos em `supabase/migrations/*.sql` em ordem alfanumérica; se uma migration falhar, o script aborta e você deve revisar o erro.
- Não coloque `SERVICE_ROLE` ou senhas no repositório. Use variáveis de ambiente ou GitHub Secrets quando automatizar.
- Se o `supabase db query` falhar por incompatibilidades (ex.: falta uuid_generate_v4), aplique as correções necessárias manualmente no Dashboard SQL.

Automação via CI (opcional)
- Recomendo criar um workflow GitHub Actions que rode esse script em um runner privado ou que instale e use `supabase` CLI com um token/secret do projeto.
- Posso gerar esse workflow se desejar.

Se quiser, eu gero também um workflow GitHub Actions pronto e/ou aplico pequenas validações adicionais (ex.: validar `stripe_price_id` e `stripe_customer_id` antes de usar).