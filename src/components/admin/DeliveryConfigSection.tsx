import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Truck, Clock, DollarSign, Loader2, Save, QrCode } from 'lucide-react';

type DeliveryConfig = {
  id?: string;
  empresa_id: string;
  delivery_ativo: boolean;
  taxa_entrega: number;
  tempo_estimado_min: number;
  tempo_estimado_max: number;
  pedido_minimo: number;
  horario_abertura: string | null;
  horario_fechamento: string | null;
  raio_entrega_km: number | null;
};

export default function DeliveryConfigSection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<DeliveryConfig>({
    empresa_id: profile?.empresa_id || '',
    delivery_ativo: false,
    taxa_entrega: 5,
    tempo_estimado_min: 30,
    tempo_estimado_max: 60,
    pedido_minimo: 20,
    horario_abertura: '09:00',
    horario_fechamento: '22:00',
    raio_entrega_km: 10,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['delivery-config', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return null;
      const { data, error } = await supabase
        .from('config_delivery')
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.empresa_id,
  });

  useEffect(() => {
    if (existingConfig) {
      setConfig({
        ...existingConfig,
        empresa_id: existingConfig.empresa_id,
      });
    } else if (profile?.empresa_id) {
      setConfig(prev => ({ ...prev, empresa_id: profile.empresa_id }));
    }
  }, [existingConfig, profile?.empresa_id]);

  const saveMutation = useMutation({
    mutationFn: async (data: DeliveryConfig) => {
      const payload = {
        delivery_ativo: data.delivery_ativo,
        taxa_entrega: data.taxa_entrega,
        tempo_estimado_min: data.tempo_estimado_min,
        tempo_estimado_max: data.tempo_estimado_max,
        pedido_minimo: data.pedido_minimo,
        horario_abertura: data.horario_abertura,
        horario_fechamento: data.horario_fechamento,
        raio_entrega_km: data.raio_entrega_km,
      };

      if (existingConfig?.id) {
        const { error } = await supabase
          .from('config_delivery')
          .update(payload)
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('config_delivery')
          .insert({
            ...payload,
            empresa_id: data.empresa_id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-config'] });
      setHasChanges(false);
      toast.success('Configurações de delivery salvas!');
    },
    onError: (error) => {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configurações.');
    },
  });

  const handleChange = (field: keyof DeliveryConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!profile?.empresa_id) {
      toast.error('Empresa não identificada');
      return;
    }
    saveMutation.mutate(config);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Delivery</CardTitle>
        </div>
        <CardDescription>Configure as opções de entrega e pagamentos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Delivery Ativo</Label>
            <p className="text-sm text-muted-foreground">
              Seu restaurante aparecerá na página pública de delivery
            </p>
          </div>
          <Switch
            checked={config.delivery_ativo}
            onCheckedChange={(v) => handleChange('delivery_ativo', v)}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Taxa de Entrega (R$)
          </Label>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={config.taxa_entrega}
            onChange={(e) => handleChange('taxa_entrega', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Pedido Mínimo (R$)
          </Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={config.pedido_minimo}
            onChange={(e) => handleChange('pedido_minimo', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Tempo Estimado de Entrega (minutos)
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Mínimo</Label>
              <Input
                type="number"
                min={5}
                value={config.tempo_estimado_min}
                onChange={(e) => handleChange('tempo_estimado_min', parseInt(e.target.value) || 30)}
              />
            </div>
            <div>
              <Label className="text-xs">Máximo</Label>
              <Input
                type="number"
                min={config.tempo_estimado_min}
                value={config.tempo_estimado_max}
                onChange={(e) => handleChange('tempo_estimado_max', parseInt(e.target.value) || 60)}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Horário de Funcionamento
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Abertura</Label>
              <Input
                type="time"
                value={config.horario_abertura || ''}
                onChange={(e) => handleChange('horario_abertura', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Fechamento</Label>
              <Input
                type="time"
                value={config.horario_fechamento || ''}
                onChange={(e) => handleChange('horario_fechamento', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Raio de Entrega (km)</Label>
          <Input
            type="number"
            min={1}
            value={config.raio_entrega_km || ''}
            onChange={(e) => handleChange('raio_entrega_km', parseFloat(e.target.value) || null)}
            placeholder="10"
          />
        </div>

        <Button
          className="w-full"
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
}
