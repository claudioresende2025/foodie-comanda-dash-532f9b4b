import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, Package, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DeliverySuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  
  const [isLoading, setIsLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      completeOrder();
    } else {
      setError('Sessão de pagamento não encontrada');
      setIsLoading(false);
    }
  }, [sessionId]);

  const completeOrder = async () => {
    try {
      console.log('[DeliverySuccess] Completando pedido com sessionId:', sessionId);
      
      // Recuperar items salvos do sessionStorage (evita limite de 500 chars do metadata)
      let items: any[] = [];
      let marcaCartao = '';
      
      try {
        const itemsStr = sessionStorage.getItem('delivery_checkout_items');
        if (itemsStr) {
          items = JSON.parse(itemsStr);
          console.log('[DeliverySuccess] Items recuperados do sessionStorage:', items.length);
        }
        marcaCartao = sessionStorage.getItem('delivery_checkout_marca_cartao') || '';
      } catch (e) {
        console.warn('[DeliverySuccess] Erro ao recuperar items do sessionStorage:', e);
      }
      
      // Usar URL do Supabase configurado (zlwpxflqtyhdwanmupgy)
      const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL || 'https://zlwpxflqtyhdwanmupgy.supabase.co'}/functions/v1`;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw";
      
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/complete-delivery-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ 
          sessionId,
          items, // Enviar items do sessionStorage
          marcaCartao, // Marca do cartão de fidelidade
        }),
      });

      const data = await response.json();
      console.log('[DeliverySuccess] Resposta:', data);
      
      // Limpar sessionStorage após uso
      sessionStorage.removeItem('delivery_checkout_items');
      sessionStorage.removeItem('delivery_checkout_marca_cartao');

      if (!response.ok) {
        console.error('[DeliverySuccess] Erro ao completar pedido:', data);
        throw new Error(data.error || 'Erro ao completar pedido');
      }

      if (data?.success && data?.orderId) {
        setSuccess(true);
        setPedidoId(data.orderId);
        console.log('[DeliverySuccess] Pedido criado com sucesso:', data.orderId);
      } else {
        setError(data?.error || 'Erro ao criar pedido após pagamento');
      }
    } catch (err: any) {
      console.error('[DeliverySuccess] Erro:', err);
      setError(err.message || 'Erro ao completar pedido. Entre em contato com o suporte.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Verificando pagamento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Ops!</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link to="/delivery">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar aos Restaurantes
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Pedido Confirmado!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Seu pedido foi recebido e está sendo preparado.
          </p>
          
          {pedidoId && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
                <Package className="w-4 h-4" />
                Número do Pedido
              </div>
              <p className="font-mono text-lg font-bold">
                #{pedidoId.slice(0, 8).toUpperCase()}
              </p>
            </div>
          )}

          <div className="pt-4 space-y-3">
            {pedidoId && (
              <Link to={`/delivery/tracking/${pedidoId}`}>
                <Button className="w-full">
                  Acompanhar Pedido
                </Button>
              </Link>
            )}
            <Link to="/delivery">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar aos Restaurantes
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
