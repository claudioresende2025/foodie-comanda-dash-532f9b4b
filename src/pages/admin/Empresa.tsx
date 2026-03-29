import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/db';
import { connectionManager } from '@/lib/connectionManager';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Upload, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { maskCNPJ } from '@/utils/masks';
import { ConfigFiscalSection } from '@/components/admin/ConfigFiscalSection';

// Funções para validar e formatar chave PIX
type PixKeyType = 'cpf' | 'cnpj' | 'phone' | 'email' | 'evp' | 'unknown';

function detectPixKeyType(key: string): PixKeyType {
  const cleanKey = key.trim();
  
  if (!cleanKey) return 'unknown';
  
  // E-mail - prioridade alta
  if (cleanKey.includes('@') && cleanKey.includes('.')) {
    return 'email';
  }
  
  // Chave aleatória (UUID/EVP)
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(cleanKey)) {
    return 'evp';
  }
  
  // Telefone - DEVE começar com + para ser identificado como telefone
  if (cleanKey.startsWith('+')) {
    return 'phone';
  }
  
  const onlyDigits = cleanKey.replace(/\D/g, '');
  
  // CNPJ (exatamente 14 dígitos)
  if (onlyDigits.length === 14) {
    return 'cnpj';
  }
  
  // CPF (exatamente 11 dígitos)
  // CPF NÃO deve ser confundido com telefone - telefone deve começar com +
  if (onlyDigits.length === 11) {
    // Apenas considera telefone se tiver formato visual de telefone
    const phonePatterns = [
      /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/,  // (DD) NNNNN-NNNN
      /^\d{2}\s?\d{4,5}-?\d{4}$/       // DD NNNNN-NNNN
    ];
    
    if (phonePatterns.some(pattern => pattern.test(cleanKey.replace(/\s/g, '')))) {
      return 'phone';
    }
    
    // 11 dígitos sem formatação de telefone = CPF
    return 'cpf';
  }
  
  // Telefone (10 ou 12-13 dígitos) - nunca 11 sem + (seria CPF)
  if (onlyDigits.length === 10 || (onlyDigits.length >= 12 && onlyDigits.length <= 13)) {
    return 'phone';
  }
  
  return 'unknown';
}

function formatPixKeyForStorage(key: string): { formatted: string; type: PixKeyType; isValid: boolean; message: string } {
  const cleanKey = key.trim();
  const keyType = detectPixKeyType(cleanKey);
  const onlyDigits = cleanKey.replace(/\D/g, '');
  
  switch (keyType) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(cleanKey.toLowerCase())) {
        return { formatted: cleanKey.toLowerCase(), type: 'email', isValid: true, message: 'E-mail válido' };
      }
      return { formatted: cleanKey, type: 'email', isValid: false, message: 'E-mail inválido' };
    
    case 'evp':
      return { formatted: cleanKey, type: 'evp', isValid: false, message: 'Chave aleatória não aceita. Use CNPJ ou E-mail.' };
    
    case 'cpf':
      return { formatted: onlyDigits, type: 'cpf', isValid: false, message: 'CPF não aceito. Use CNPJ ou E-mail.' };
    
    case 'cnpj':
      if (onlyDigits.length === 14) {
        return { formatted: onlyDigits, type: 'cnpj', isValid: true, message: 'CNPJ válido' };
      }
      return { formatted: onlyDigits, type: 'cnpj', isValid: false, message: 'CNPJ deve ter 14 dígitos' };
    
    case 'phone':
      return { formatted: cleanKey, type: 'phone', isValid: false, message: 'Telefone não aceito. Use CNPJ ou E-mail.' };
    
    default:
      return { formatted: cleanKey, type: 'unknown', isValid: false, message: 'Tipo de chave não reconhecido' };
  }
}

function getPixKeyTypeLabel(type: PixKeyType): string {
  const labels: Record<PixKeyType, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    phone: 'Telefone',
    email: 'E-mail',
    evp: 'Chave Aleatória',
    unknown: 'Desconhecido'
  };
  return labels[type];
}

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
      
      // 1. Buscar dados locais primeiro
      const empresaLocal = await db.empresa.get(profile.empresa_id);
      
      // 2. Se offline, retornar dados locais
      if (!connectionManager.isOnline()) {
        console.log('📱 Empresa: Usando dados offline');
        return empresaLocal || null;
      }
      
      // 3. Buscar do Supabase
      try {
        const { data, error } = await supabase
          .from('empresas')
          .select('*')
          .eq('id', profile.empresa_id)
          .single();
        if (error) throw error;
        
        // 4. Salvar no IndexedDB
        if (data) {
          await db.empresa.put({ ...data, sincronizado: true });
        }
        return data;
      } catch (err) {
        console.warn('⚠️ Empresa: Erro ao buscar online, usando cache local', err);
        return empresaLocal || null;
      }
    },
    enabled: !!profile?.empresa_id,
    networkMode: 'offlineFirst',
    staleTime: 1000 * 60,
  });

  const [formData, setFormData] = useState<any>({
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    endereco_completo: '',
    chave_pix: '',
  });

  // Couver / Música ao vivo local state
  const [couverAtivoLocal, setCouverAtivoLocal] = useState<boolean>(false);
  const [couverValorLocal, setCouverValorLocal] = useState<string>('0.00');
  const [weekdays, setWeekdays] = useState<Record<string, boolean>>({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
  });
  const [specificDates, setSpecificDates] = useState<string>('');
  
  // Validação da chave PIX em tempo real
  const pixKeyValidation = useMemo(() => {
    if (!formData.chave_pix) return null;
    return formatPixKeyForStorage(formData.chave_pix);
  }, [formData.chave_pix]);
  
  // Mapeamento de dias da semana para português
  const diasSemana = [
    { key: 'monday', label: 'Seg' },
    { key: 'tuesday', label: 'Ter' },
    { key: 'wednesday', label: 'Qua' },
    { key: 'thursday', label: 'Qui' },
    { key: 'friday', label: 'Sex' },
    { key: 'saturday', label: 'Sáb' },
    { key: 'sunday', label: 'Dom' },
  ];

  // Sincronizar formData quando empresa é carregada
  useEffect(() => {
    if (empresa) {
      setFormData({
        nome_fantasia: empresa.nome_fantasia || '',
        cnpj: empresa.cnpj ? maskCNPJ(empresa.cnpj) : '',
        inscricao_estadual: empresa.inscricao_estadual || '',
        endereco_completo: empresa.endereco_completo || '',
        chave_pix: empresa.chave_pix || '',
      });

      // Carregar configurações de couver do localStorage
      const key = `fcd-live-music-${empresa.id || 'local'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setCouverAtivoLocal(parsed.ativo || false);
          setCouverValorLocal(parsed.valor || '0.00');
          setWeekdays(parsed.weekdays || {
            monday: false, tuesday: false, wednesday: false,
            thursday: false, friday: false, saturday: false, sunday: false
          });
          setSpecificDates((parsed.specificDates || []).join(', '));
        } catch (e) {
          console.warn('Erro ao carregar configurações de couver:', e);
        }
      }
    }
  }, [empresa]);

  const handleSaveCouver = () => {
    try {
      const payload = {
        ativo: couverAtivoLocal,
        valor: couverValorLocal,
        weekdays,
        specificDates: specificDates.split(',').map(s => s.trim()).filter(Boolean),
      };
      const key = `fcd-live-music-${empresa?.id || 'local'}`;
      localStorage.setItem(key, JSON.stringify(payload));
      toast.success('Configurações de couver salvas localmente');
    } catch (err) {
      console.error('Erro salvando couver:', err);
      toast.error('Erro ao salvar configurações de couver');
    }
  };

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

      // Formata e valida chave PIX antes de salvar
      let chavePix: string | null = null;
      if (formData.chave_pix && formData.chave_pix.trim()) {
        const pixValidation = formatPixKeyForStorage(formData.chave_pix);
        if (!pixValidation.isValid) {
          throw new Error(`Chave PIX inválida: ${pixValidation.message}`);
        }
        chavePix = pixValidation.formatted;
      }

      const { error } = await supabase
        .from('empresas')
        .update({
          nome_fantasia: formData.nome_fantasia,
          cnpj: cnpjClean || null,
          endereco_completo: formData.endereco_completo || null,
          inscricao_estadual: formData.inscricao_estadual || null,
          chave_pix: chavePix,
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

      {/* Grid: Logo + Couver lado a lado */}
      <div className="grid gap-6 lg:grid-cols-2">
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

        {/* Couver / Música ao vivo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Couver / Música ao Vivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Ativar Couver Musical</p>
                <p className="text-sm text-muted-foreground">Cobrança por pessoa em dias selecionados</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={couverAtivoLocal}
                  onChange={(e) => setCouverAtivoLocal(e.target.checked)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor por pessoa (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={couverValorLocal}
                  onChange={(e) => setCouverValorLocal(e.target.value)}
                  placeholder="Ex: 25,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Dias da semana com Couver</Label>
                <div className="flex gap-2 flex-wrap">
                  {diasSemana.map(({ key, label }) => (
                    <button
                      key={key}
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${weekdays[key] ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80'}`}
                      onClick={() => setWeekdays({ ...weekdays, [key]: !weekdays[key] })}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Datas específicas com Couver (DD/MM/AAAA, separadas por vírgula)</Label>
              <Textarea
                placeholder="10/01/2025, 14/02/2025, 25/12/2025"
                value={specificDates}
                onChange={(e) => setSpecificDates(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Adicione datas específicas para cobrar couver, além dos dias da semana selecionados.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveCouver} className="bg-primary">Salvar Couver</Button>
              <Button variant="outline" onClick={() => {
                // reset local
                setCouverAtivoLocal(false);
                setCouverValorLocal('0.00');
                setWeekdays({ monday:false,tuesday:false,wednesday:false,thursday:false,friday:false,saturday:false,sunday:false });
                setSpecificDates('');
                toast.success('Configurações de couver resetadas localmente');
              }}>Resetar</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informações Fiscais - Full Width */}
      <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações Fiscais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Input
                  id="nome_fantasia"
                  value={formData.nome_fantasia}
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
                  value={formData.inscricao_estadual}
                  onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                  placeholder="Inscrição estadual"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco_completo">Endereço Completo</Label>
                <Input
                  id="endereco_completo"
                  value={formData.endereco_completo}
                  onChange={(e) => setFormData({ ...formData, endereco_completo: e.target.value })}
                  placeholder="Rua, número, bairro, cidade - UF"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="chave_pix">Chave PIX</Label>
                <div className="relative">
                  <Input
                    id="chave_pix"
                    type="text"
                    value={formData.chave_pix}
                    onChange={(e) => setFormData({ ...formData, chave_pix: e.target.value })}
                    placeholder="Ex: 00.000.000/0001-00 ou email@exemplo.com"
                    disabled={!canEditPixKey}
                    autoComplete="off"
                    className={pixKeyValidation ? (pixKeyValidation.isValid ? 'border-green-500 pr-10' : 'border-red-500 pr-10') : ''}
                  />
                  {pixKeyValidation && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {pixKeyValidation.isValid ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {pixKeyValidation && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={pixKeyValidation.isValid ? 'default' : 'destructive'} className="text-xs">
                      {getPixKeyTypeLabel(pixKeyValidation.type)}
                    </Badge>
                    <span className={`text-xs ${pixKeyValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                      {pixKeyValidation.message}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {canEditPixKey 
                    ? 'Formatos aceitos: CNPJ (apenas números) ou E-mail'
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

      {/* Configurações Fiscais / NFC-e */}
      <ConfigFiscalSection />
    </div>
  );
}
