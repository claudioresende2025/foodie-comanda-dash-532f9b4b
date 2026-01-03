import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Building2, Upload, Loader2, CheckCircle2 } from 'lucide-react';

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nome_fantasia: '',
    cnpj: '',
    endereco_completo: '',
    inscricao_estadual: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.nome_fantasia.trim()) {
      toast.error('Nome fantasia é obrigatório');
      return;
    }

    setIsLoading(true);

    try {
      let logo_url = null;

      // Upload logo if provided
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName);
        
        logo_url = publicUrl;
      }

      // Create empresa
      const { data: empresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({
          nome_fantasia: formData.nome_fantasia,
          cnpj: formData.cnpj || null,
          endereco_completo: formData.endereco_completo || null,
          inscricao_estadual: formData.inscricao_estadual || null,
          logo_url,
          usuario_proprietario_id: user.id,
        })
        .select()
        .single();

      if (empresaError) throw empresaError;

      // Update profile with empresa_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ empresa_id: empresa.id })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Add user role as proprietario
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          empresa_id: empresa.id,
          role: 'proprietario',
        });

      if (roleError) throw roleError;

      toast.success('Empresa cadastrada com sucesso!');
      navigate('/admin');
    } catch (error: any) {
      console.error('Error creating empresa:', error);
      toast.error('Erro ao cadastrar empresa. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-fcd-orange-light p-4">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-fcd mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Cadastre sua Empresa</h1>
          <p className="text-muted-foreground mt-2">
            Preencha os dados do seu estabelecimento para começar
          </p>
        </div>

        <Card className="shadow-fcd border-0">
          <CardHeader>
            <CardTitle>Informações da Empresa</CardTitle>
            <CardDescription>
              Estes dados serão exibidos nos comprovantes e notas fiscais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo da Empresa</Label>
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
                    {logoPreview ? (
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG ou SVG. Máximo 2MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Nome Fantasia */}
              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia *</Label>
                <Input
                  id="nome_fantasia"
                  placeholder="Ex: Restaurante Sabor & Arte"
                  value={formData.nome_fantasia}
                  onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                  required
                />
              </div>

              {/* CNPJ */}
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                />
              </div>

              {/* Endereço */}
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço Completo</Label>
                <Textarea
                  id="endereco"
                  placeholder="Rua, número, bairro, cidade - UF"
                  value={formData.endereco_completo}
                  onChange={(e) => setFormData({ ...formData, endereco_completo: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Inscrição Estadual */}
              <div className="space-y-2">
                <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                <Input
                  id="inscricao_estadual"
                  placeholder="Número da IE"
                  value={formData.inscricao_estadual}
                  onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Cadastrar Empresa
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
