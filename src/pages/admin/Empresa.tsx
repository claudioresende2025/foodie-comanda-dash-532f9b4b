import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Upload, Save, Loader2 } from 'lucide-react';
import { maskCNPJ } from '@/utils/masks';

export default function Empresa() {
  const { profile } = useAuth();
  const { canEditPixKey } = useUserRole();
  const queryClient = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data: empresa, isLoading } = useQuery({
    queryKey: ['empresa', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return null;
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', profile.empresa_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.empresa_id,
  });

  const [formData, setFormData] = useState({
    nome_fantasia: '',
    cnpj: '',
    endereco_completo: '',
    inscricao_estadual: '',
    chave_pix: '',
  });

  // Update form when empresa loads
  useEffect(() => {
    if (empresa) {
      setFormData({
        nome_fantasia: empresa.nome_fantasia || '',
        cnpj: empresa.cnpj ? maskCNPJ(empresa.cnpj) : '',
        endereco_completo: empresa.endereco_completo || '',
        inscricao_estadual: empresa.inscricao_estadual || '',
        chave_pix: (empresa as any).chave_pix || '',
      });
    }
  }, [empresa]);

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCNPJ(e.target.value);
    setFormData({ ...formData, cnpj: masked });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.empresa_id) throw new Error('Empresa não encontrada');

      let logo_url = empresa?.logo_url;

      // Upload logo if changed
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${profile.empresa_id}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName);
        
        logo_url = publicUrl;
      }

      // Remove CNPJ mask before saving
      const cnpjClean = formData.cnpj.replace(/\D/g, '');

      const { error } = await supabase
        .from('empresas')
        .update({
          nome_fantasia: formData.nome_fantasia,
          cnpj: cnpjClean || null,
          endereco_completo: formData.endereco_completo || null,
          inscricao_estadual: formData.inscricao_estadual || null,
          chave_pix: formData.chave_pix || null,
          logo_url,
        })
        .eq('id', profile.empresa_id);

      if (error) {
        console.error('Erro ao atualizar empresa:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa'] });
      toast.success('Dados da empresa atualizados!');
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast.error('Erro ao atualizar dados. Verifique se você tem permissão.');
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentLogo = logoPreview || empresa?.logo_url;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dados da Empresa</h1>
        <p className="text-muted-foreground">Gerencie as informações do seu estabelecimento</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
              {currentLogo ? (
                <img src={currentLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Building2 className="w-16 h-16 text-muted-foreground" />
              )}
            </div>
            <div>
              <Label htmlFor="logo" className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 p-3 border border-dashed rounded-lg hover:bg-muted transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Alterar Logo</span>
                </div>
              </Label>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dados */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Informações Fiscais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Input
                  id="nome_fantasia"
                  value={formData.nome_fantasia || empresa?.nome_fantasia || ''}
                  onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                  placeholder="Nome do estabelecimento"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={handleCNPJChange}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                <Input
                  id="inscricao_estadual"
                  value={formData.inscricao_estadual || empresa?.inscricao_estadual || ''}
                  onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                  placeholder="Inscrição estadual"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco_completo">Endereço Completo</Label>
                <Input
                  id="endereco_completo"
                  value={formData.endereco_completo || empresa?.endereco_completo || ''}
                  onChange={(e) => setFormData({ ...formData, endereco_completo: e.target.value })}
                  placeholder="Rua, número, bairro, cidade - UF"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="chave_pix">Chave PIX</Label>
                <Input
                  id="chave_pix"
                  value={formData.chave_pix}
                  onChange={(e) => setFormData({ ...formData, chave_pix: e.target.value })}
                  placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
                  disabled={!canEditPixKey}
                />
                <p className="text-xs text-muted-foreground">
                  {canEditPixKey 
                    ? 'Configure sua chave PIX para gerar QR Codes de pagamento corretos'
                    : 'Apenas o proprietário pode editar a chave PIX'}
                </p>
              </div>
            </div>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full md:w-auto"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
