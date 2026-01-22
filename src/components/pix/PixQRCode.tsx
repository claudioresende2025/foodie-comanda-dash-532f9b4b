import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface PixQRCodeProps {
  chavePix: string;
  valor: number;
  nomeRecebedor?: string;
  cidade?: string;
  txid?: string;
  expiracaoMinutos?: number;
  onExpired?: () => void;
  onRefresh?: () => void;
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
  
  if (cleanKey.includes('@') && cleanKey.includes('.')) {
    return 'email';
  }
  
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(cleanKey)) {
    return 'evp';
  }
  
  if (cleanKey.startsWith('+55') || cleanKey.startsWith('+')) {
    return 'phone';
  }
  
  const onlyDigits = cleanKey.replace(/\D/g, '');
  
  if (onlyDigits.length === 14) {
    return 'cnpj';
  }
  
  if (onlyDigits.length === 11) {
    const phonePatterns = [
      /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/,
      /^\d{2}\s?\d{4,5}-?\d{4}$/,
      /^55\d{10,11}$/
    ];
    
    const looksLikePhone = phonePatterns.some(pattern => pattern.test(cleanKey.replace(/\s/g, '')));
    if (looksLikePhone) {
      return 'phone';
    }
    
    if (onlyDigits.startsWith('55')) {
      return 'phone';
    }
    
    return 'cpf';
  }
  
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
      if (cleanKey.startsWith('+55')) {
        return '+55' + cleanKey.replace(/\D/g, '').replace(/^55/, '');
      }
      if (cleanKey.startsWith('+')) {
        return cleanKey.replace(/[^\d+]/g, '');
      }
      if (onlyDigits.startsWith('55') && onlyDigits.length >= 12) {
        return '+' + onlyDigits;
      }
      return '+55' + onlyDigits;
    
    default:
      return cleanKey;
  }
}

function generateTxid(): string {
  return 'PIX' + Date.now().toString(36).toUpperCase();
}

function generatePixBRCode(
  chavePix: string,
  valor: number,
  nomeRecebedor: string,
  cidade: string,
  txid: string = '***'
): string {
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
  
  const id00 = formatEMV('00', '01');
  
  const subId00 = formatEMV('00', 'br.gov.bcb.pix');
  const subId01 = formatEMV('01', chaveFormatada);
  const id26 = formatEMV('26', subId00 + subId01);
  
  const id52 = formatEMV('52', '0000');
  const id53 = formatEMV('53', '986');
  
  let id54 = '';
  if (valor > 0) {
    id54 = formatEMV('54', valor.toFixed(2));
  }
  
  const id58 = formatEMV('58', 'BR');
  const id59 = formatEMV('59', nomeNorm);
  const id60 = formatEMV('60', cidadeNorm);
  
  const subId05 = formatEMV('05', txidNorm);
  const id62 = formatEMV('62', subId05);
  
  const payloadBase = id00 + id26 + id52 + id53 + id54 + id58 + id59 + id60 + id62;
  
  const payloadParaCRC = payloadBase + '6304';
  const crc = crc16CCITT(payloadParaCRC);
  
  return payloadParaCRC + crc;
}

export function PixQRCode({ 
  chavePix, 
  valor, 
  nomeRecebedor = 'RESTAURANTE', 
  cidade = 'SAO PAULO', 
  txid,
  expiracaoMinutos = 5,
  onExpired,
  onRefresh
}: PixQRCodeProps) {
  const [copied, setCopied] = useState(false);
  const [txidAtual, setTxidAtual] = useState(txid || generateTxid());
  const [tempoRestante, setTempoRestante] = useState(expiracaoMinutos * 60);
  const [expirado, setExpirado] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (expirado || tempoRestante <= 0) {
      if (!expirado) {
        setExpirado(true);
        onExpired?.();
      }
      return;
    }
    
    const timer = setInterval(() => {
      setTempoRestante(prev => {
        if (prev <= 1) {
          setExpirado(true);
          onExpired?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [tempoRestante, expirado, onExpired]);

  const formatarTempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min}:${seg.toString().padStart(2, '0')}`;
  };

  const handleRefresh = useCallback(() => {
    const novoTxid = generateTxid();
    setTxidAtual(novoTxid);
    setTempoRestante(expiracaoMinutos * 60);
    setExpirado(false);
    onRefresh?.();
    toast.success('Novo código PIX gerado!');
  }, [expiracaoMinutos, onRefresh]);

  if (!chavePix) {
    return (
      <div className="text-center p-4 border rounded-lg bg-amber-50 text-amber-700">
        <p className="font-medium">Chave PIX não configurada</p>
        <p className="text-sm mt-1">Configure a chave PIX nas configurações da empresa.</p>
      </div>
    );
  }

  const brCode = generatePixBRCode(chavePix, valor, nomeRecebedor, cidade, txidAtual);

  const handleCopy = async () => {
    if (expirado) {
      toast.error('Código expirado. Gere um novo código.');
      return;
    }
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
      {/* Timer de expiração */}
      <div className={`w-full text-center py-2 px-4 rounded-lg ${
        expirado 
          ? 'bg-destructive/10 text-destructive' 
          : tempoRestante < 60 
            ? 'bg-amber-100 text-amber-700' 
            : 'bg-blue-100 text-blue-700'
      }`}>
        {expirado ? (
          <div className="flex flex-col items-center gap-2">
            <p className="font-medium">QR Code expirado</p>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Gerar novo código
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Expira em: <strong>{formatarTempo(tempoRestante)}</strong></span>
          </div>
        )}
      </div>

      {/* QR Code */}
      <div className={`p-4 bg-white rounded-lg border ${expirado ? 'opacity-40' : ''}`}>
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
            value={expirado ? 'Código expirado' : brCode}
            className="text-xs font-mono"
            disabled={expirado}
          />
          <Button
            variant="secondary"
            size="icon"
            onClick={handleCopy}
            disabled={expirado}
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
