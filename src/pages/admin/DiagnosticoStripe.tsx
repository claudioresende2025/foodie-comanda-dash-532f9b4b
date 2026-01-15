import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type DiagnoseResult = {
  success: boolean;
  diagnose: {
    env: {
      STRIPE_SECRET_KEY: boolean;
      STRIPE_WEBHOOK_SECRET: boolean;
      SUPABASE_URL: boolean;
      SUPABASE_SERVICE_ROLE_KEY: boolean;
    };
    webhook_endpoint_match: any;
    recent_events: any[];
    recent_webhook_logs: any[];
    assinatura: any;
  };
};

export default function DiagnosticoStripe() {
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState("");
  const [data, setData] = useState<DiagnoseResult | null>(null);

  const fetchDiagnose = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { "x-diagnostic": "1" };
      const { data: resp, error } = await supabase.functions.invoke("stripe-subscription-webhook", {
        headers,
        body: empresaId ? { empresaId } : {},
      });
      if (error) {
        toast.error(error.message || "Erro ao consultar diagnóstico");
      } else {
        setData(resp as DiagnoseResult);
        toast.success("Diagnóstico atualizado");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao consultar diagnóstico");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnose();
  }, []);

  const envOk =
    data?.diagnose?.env?.STRIPE_SECRET_KEY && data?.diagnose?.env?.STRIPE_WEBHOOK_SECRET;
  const endpointMatched = !!data?.diagnose?.webhook_endpoint_match?.matched;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Diagnóstico Stripe</h1>
        <Button onClick={fetchDiagnose} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verificação de Ambiente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span>STRIPE_SECRET_KEY</span>
            <Badge variant={envOk ? "default" : "destructive"}>
              {data?.diagnose?.env?.STRIPE_SECRET_KEY ? "OK" : "Faltando"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span>STRIPE_WEBHOOK_SECRET</span>
            <Badge variant={envOk ? "default" : "destructive"}>
              {data?.diagnose?.env?.STRIPE_WEBHOOK_SECRET ? "OK" : "Faltando"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span>Webhook Endpoint</span>
            <Badge variant={endpointMatched ? "default" : "destructive"}>
              {endpointMatched ? "Correto" : "Divergente"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assinatura por Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="empresaId"
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
            />
            <Button onClick={fetchDiagnose} disabled={loading}>
              Consultar
            </Button>
          </div>
          {data?.diagnose?.assinatura && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Plano</span>
                <p className="font-medium">{data.diagnose.assinatura.plano_id || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className="font-medium">{data.diagnose.assinatura.status || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Início do Período</span>
                <p className="font-medium">{data.diagnose.assinatura.current_period_start || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Fim do Período</span>
                <p className="font-medium">{data.diagnose.assinatura.current_period_end || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Trial Início</span>
                <p className="font-medium">{data.diagnose.assinatura.trial_start || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Trial Fim</span>
                <p className="font-medium">{data.diagnose.assinatura.trial_end || "—"}</p>
              </div>
              <div className="md:col-span-2">
                <span className="text-muted-foreground">Stripe Subscription</span>
                <p className="font-medium">{data.diagnose.assinatura.stripe_subscription_id || "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {(data?.diagnose?.recent_events || []).map((ev: any) => (
              <div key={ev.id || ev.created} className="flex items-center justify-between border rounded px-3 py-2">
                <span>{ev.type || ev.error}</span>
                <span className="text-muted-foreground">{ev.id || "—"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs do Webhook</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {(data?.diagnose?.recent_webhook_logs || []).map((l: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between border rounded px-3 py-2">
                <span>{l.event || l.error}</span>
                <span className="text-muted-foreground">{l.referencia || l.created_at || "—"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
