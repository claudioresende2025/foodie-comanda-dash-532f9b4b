import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface PixQRCodeProps {
  chavePix: string;
  valor: number;
  nomeRecebedor?: string;
  cidade?: string;
  txid?: string;
}

// Funções para gerar o BR Code (PIX) - Especificação BACEN v3.1
// CRC16-CCITT-FALSE (Polinômio 0x1021, Init 0xFFFF, XorOut 0x0000)
function crc16CCITT(str: string): string {
  let crc = 0xFFFF;
  
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }
  
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatEMV(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${id}${length}${value}`;
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
    .trim();
}

function detectPixKeyType(key: string): 'cpf' | 'cnpj' | 'phone' | 'email' | 'evp' | 'unknown' {
  const cleanKey = key.trim();
  
  // Email: contém @ e .
  if (cleanKey.includes('@') && cleanKey.includes('.')) {
    return 'email';
  }
  
  // Chave aleatória (EVP): formato UUID (32 hex + 4 hífens = 36 chars)
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(cleanKey)) {
    return 'evp';
  }
  
  // Telefone: começa com +55 ou tem formato de telefone
  if (cleanKey.startsWith('+55') || cleanKey.startsWith('+')) {
    return 'phone';
  }
  
  const onlyDigits = cleanKey.replace(/\D/g, '');
  
  // CNPJ: 14 dígitos
  if (onlyDigits.length === 14) {
    return 'cnpj';
  }
  
  // CPF: 11 dígitos (mas verificar se não é telefone)
  // Telefones brasileiros: DDD (2 dígitos) + número (8 ou 9 dígitos) = 10 ou 11 dígitos
  // CPF: 11 dígitos
  // Para diferenciar: se a chave original tem caracteres de telefone (parênteses, hífen, espaços típicos de telefone)
  // ou começa com 55, provavelmente é telefone
  if (onlyDigits.length === 11) {
    // Verifica padrões típicos de telefone
    const phonePatterns = [
      /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/, // (11) 99999-9999 ou (11)999999999
      /^\d{2}\s?\d{4,5}-?\d{4}$/,     // 11 99999-9999
      /^55\d{10,11}$/                  // 5511999999999
    ];
    
    const looksLikePhone = phonePatterns.some(pattern => pattern.test(cleanKey.replace(/\s/g, '')));
    if (looksLikePhone) {
      return 'phone';
    }
    
    // Se começa com 55, provavelmente é telefone com código do país
    if (onlyDigits.startsWith('55')) {
      return 'phone';
    }
    
    return 'cpf';
  }
  
  // Telefone: 10-13 dígitos (sem considerar os 11 que já foram tratados acima)
  if (onlyDigits.length >= 10 && onlyDigits.length <= 13) {
    return 'phone';
  }
  
  return 'unknown';
}

function formatPixKey(key: string): string {
  const cleanKey = key.trim();
  const keyType = detectPixKeyType(cleanKey);
  const onlyDigits = cleanKey.replace(/\D/g, '');
  
  switch (keyType) {
    case 'email':
      return cleanKey.toLowerCase().trim();
    
    case 'evp':
      return cleanKey.toLowerCase();
    
    case 'cpf':
      return onlyDigits;
    
    case 'cnpj':
      return onlyDigits;
    
    case 'phone':
      // Telefone precisa estar no formato +55DDDNNNNNNNNN
      if (cleanKey.startsWith('+55')) {
        // Já está no formato correto, só limpa
        return '+55' + cleanKey.replace(/\D/g, '').replace(/^55/, '');
      }
      if (cleanKey.startsWith('+')) {
        return cleanKey.replace(/[^\d+]/g, '');
      }
      // Remove 55 do início se existir e adiciona +55
      if (onlyDigits.startsWith('55') && onlyDigits.length >= 12) {
        return '+' + onlyDigits;
      }
      // Adiciona +55 ao número
      return '+55' + onlyDigits;
    
    default:
      // Retorna como está (pode ser uma chave válida que não reconhecemos)
      return cleanKey;
  }
}

function generatePixBRCode(
  chavePix: string,
  valor: number,
  nomeRecebedor: string,
  cidade: string,
  txid: string = '***'
): string {
  // Validação da chave
  if (!chavePix || chavePix.trim() === '') {
    throw new Error('Chave PIX é obrigatória');
  }
  
  const chaveFormatada = formatPixKey(chavePix);
  
  if (!chaveFormatada || chaveFormatada.length === 0) {
    throw new Error('Chave PIX inválida');
  }
  
  const nomeNorm = normalizeText(nomeRecebedor).substring(0, 25) || 'LOJA';
  const cidadeNorm = normalizeText(cidade).substring(0, 15) || 'CIDADE';
  const txidNorm = txid.replace(/[^a-zA-Z0-9*]/g, '').substring(0, 25) || '***';
  
  // ========== MONTAGEM DO PAYLOAD EMV ==========
  
  // ID 00 - Payload Format Indicator (obrigatório, fixo "01")
  const id00 = formatEMV('00', '01');
  
  // ID 26 - Merchant Account Information (PIX específico)
  //   Sub-ID 00: GUI = "br.gov.bcb.pix"
  //   Sub-ID 01: Chave PIX
  const subId00 = formatEMV('00', 'br.gov.bcb.pix');
  const subId01 = formatEMV('01', chaveFormatada);
  const id26 = formatEMV('26', subId00 + subId01);
  
  // ID 52 - Merchant Category Code (obrigatório, "0000" para não especificado)
  const id52 = formatEMV('52', '0000');
  
  // ID 53 - Transaction Currency (obrigatório, "986" = BRL)
  const id53 = formatEMV('53', '986');
  
  // ID 54 - Transaction Amount (opcional)
  let id54 = '';
  if (valor > 0) {
    id54 = formatEMV('54', valor.toFixed(2));
  }
  
  // ID 58 - Country Code (obrigatório, "BR")
  const id58 = formatEMV('58', 'BR');
  
  // ID 59 - Merchant Name (obrigatório, máx 25 chars)
  const id59 = formatEMV('59', nomeNorm);
  
  // ID 60 - Merchant City (obrigatório, máx 15 chars)
  const id60 = formatEMV('60', cidadeNorm);
  
  // ID 62 - Additional Data Field Template
  //   Sub-ID 05: Reference Label (TXID)
  const subId05 = formatEMV('05', txidNorm);
  const id62 = formatEMV('62', subId05);
  
  // Monta payload base (sem CRC)
  const payloadBase = id00 + id26 + id52 + id53 + id54 + id58 + id59 + id60 + id62;
  
  // ID 63 - CRC16 (obrigatório, sempre no final)
  // Adiciona "6304" antes de calcular o CRC
  const payloadParaCRC = payloadBase + '6304';
  const crc = crc16CCITT(payloadParaCRC);
  
  // Payload final
  return payloadParaCRC + crc;
}

export function PixQRCode({ chavePix, valor, nomeRecebedor = 'RESTAURANTE', cidade = 'SAO PAULO', txid }: PixQRCodeProps) {
  const [copied, setCopied] = useState(false);

  if (!chavePix) {
    return (
      <div className="text-center p-4 border rounded-lg bg-amber-50 text-amber-700">
        <p className="font-medium">Chave PIX não configurada</p>
        <p className="text-sm mt-1">Configure a chave PIX nas configurações da empresa.</p>
      </div>
    );
  }

  const brCode = generatePixBRCode(chavePix, valor, nomeRecebedor, cidade, txid);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(brCode);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar código');
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* QR Code */}
      <div className="p-4 bg-white rounded-lg border">
        <QRCodeSVG
          value={brCode}
          size={200}
          level="M"
          includeMargin
          fgColor="#000000"
          bgColor="#FFFFFF"
        />
      </div>

      {/* Valor */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Valor a pagar</p>
        <p className="text-2xl font-bold text-primary">R$ {valor.toFixed(2)}</p>
      </div>

      {/* Chave PIX */}
      <div className="w-full space-y-2">
        <Label>PIX Copia e Cola</Label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={brCode}
            className="text-xs font-mono"
          />
          <Button
            variant="secondary"
            size="icon"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Instruções */}
      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>1. Abra o app do seu banco</p>
        <p>2. Escaneie o QR Code ou copie o código</p>
        <p>3. Confirme o pagamento</p>
      </div>
    </div>
  );
}