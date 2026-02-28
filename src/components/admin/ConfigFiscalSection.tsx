import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Loader2, Upload, ShieldCheck, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const UFS_BRASILEIRAS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

type ConfigFiscalForm = {
  regime_tributario: string;
  codigo_ibge_cidade: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  uf: string;
  certificado_senha: string;
  csc: string;
  csc_id: string;
};

const emptyForm: ConfigFiscalForm = {
  regime_tributario: 'simples_nacional',
  codigo_ibge_cidade: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cep: '',
  uf: 'SP',
  certificado_senha: '',
  csc: '',
  csc_id: '',
};

export function ConfigFiscalSection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const [form, setForm] = useState<ConfigFiscalForm>(emptyForm);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certFileName, setCertFileName] = useState<string | null>(null);

  const { data: configFiscal, isLoading } = useQuery({
    queryKey: ['config-fiscal', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from('config_fiscal')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  useEffect(() => {
    if (configFiscal) {
      setForm({
        regime_tributario: configFiscal.regime_tributario || 'simples_nacional',
        codigo_ibge_cidade: configFiscal.codigo_ibge_cidade || '',
        logradouro: configFiscal.logradouro || '',
        numero: configFiscal.numero || '',
        bairro: configFiscal.bairro || '',
        cep: configFiscal.cep || '',
        uf: configFiscal.uf || 'SP',
        certificado_senha: configFiscal.certificado_senha || '',
        csc: configFiscal.csc || '',
        csc_id: configFiscal.csc_id || '',
      });
      if (configFiscal.certificado_path) {
        setCertFileName(configFiscal.certificado_path.split('/').pop() || 'certificado.pfx');
      }
    }
  }, [configFiscal]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error('Empresa não encontrada');

      let certificado_path = configFiscal?.certificado_path || null;

      // Upload certificado if changed
      if (certFile) {
        const fileExt = certFile.name.split('.').pop();
        const fileName = `${empresaId}/certificado.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('certificados')
          .upload(fileName, certFile, { upsert: true });

        if (uploadError) throw uploadError;
        certificado_path = fileName;
      }

      const payload = {
        empresa_id: empresaId,
        regime_tributario: form.regime_tributario,
        codigo_ibge_cidade: form.codigo_ibge_cidade || null,
        logradouro: form.logradouro || null,
        numero: form.numero || null,
        bairro: form.bairro || null,
        cep: form.cep || null,
        uf: form.uf || null,
        certificado_path,
        certificado_senha: form.certificado_senha || null,
        csc: form.csc || null,
        csc_id: form.csc_id || null,
        updated_at: new Date().toISOString(),
      };

      if (configFiscal?.id) {
        const { error } = await supabase
          .from('config_fiscal')
          .update(payload)
          .eq('id', configFiscal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('config_fiscal')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-fiscal'] });
      toast.success('Configurações fiscais salvas!');
    },
    onError: (error) => {
      console.error('Erro ao salvar config fiscal:', error);
      toast.error('Erro ao salvar configurações fiscais');
    },
  });

  const handleCertChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCertFile(file);
      setCertFileName(file.name);
    }
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Configurações Fiscais / NFC-e
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Regime Tributário + IBGE */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Regime Tributário</Label>
            <Select value={form.regime_tributario} onValueChange={(v) => setForm({ ...form, regime_tributario: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Código IBGE da Cidade</Label>
            <Input
              placeholder="Ex: 3550308 (São Paulo)"
              value={form.codigo_ibge_cidade}
              onChange={(e) => setForm({ ...form, codigo_ibge_cidade: e.target.value })}
              maxLength={7}
            />
          </div>
        </div>

        {/* Endereço Fiscal */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Endereço Fiscal</Label>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Logradouro</Label>
              <Input placeholder="Rua / Avenida" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Número</Label>
              <Input placeholder="123" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bairro</Label>
              <Input placeholder="Centro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CEP</Label>
              <Input placeholder="00000-000" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} maxLength={9} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">UF</Label>
              <Select value={form.uf} onValueChange={(v) => setForm({ ...form, uf: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UFS_BRASILEIRAS.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Certificado Digital */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Certificado Digital A1 (.pfx / .p12)</Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="cert-upload" className="cursor-pointer flex-1">
                <div className="flex items-center gap-2 p-3 border border-dashed rounded-lg hover:bg-muted transition-colors">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm truncate">
                    {certFileName || 'Selecionar certificado'}
                  </span>
                </div>
              </Label>
              <Input
                id="cert-upload"
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={handleCertChange}
              />
              {certFileName && (
                <ShieldCheck className="w-5 h-5 text-green-500 shrink-0" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Senha do Certificado</Label>
            <Input
              type="password"
              placeholder="Senha do arquivo .pfx"
              value={form.certificado_senha}
              onChange={(e) => setForm({ ...form, certificado_senha: e.target.value })}
              autoComplete="new-password"
            />
          </div>
        </div>

        {/* CSC */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>CSC (Código de Segurança do Contribuinte)</Label>
            <Input
              placeholder="Token CSC da SEFAZ"
              value={form.csc}
              onChange={(e) => setForm({ ...form, csc: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>ID do CSC</Label>
            <Input
              placeholder="Ex: 1"
              value={form.csc_id}
              onChange={(e) => setForm({ ...form, csc_id: e.target.value })}
            />
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full md:w-auto"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Configurações Fiscais
        </Button>
      </CardContent>
    </Card>
  );
}
