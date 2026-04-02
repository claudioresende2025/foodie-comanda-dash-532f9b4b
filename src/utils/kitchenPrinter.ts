// Kitchen Order Print Utility for Thermal Printers (58mm / 80mm)
// Detecta largura da bobina via localStorage('fcd-printer-width') → '58' | '80' (default: '80')

type PrintItem = {
  nome: string;
  quantidade: number;
  notas?: string | null;
};

type PrintOrder = {
  mesaNumero: number;
  itens: PrintItem[];
  timestamp: Date;
  empresaNome?: string;
  empresaEndereco?: string;
  incluirTaxaServico?: boolean;
  taxaServicoPercentual?: number;
  couverTotal?: number;
  total?: number;
};

// Tipo para impressão de cupom não fiscal (Caixa)
type CaixaReceiptItem = {
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
};

type CaixaReceiptData = {
  empresaNome: string;
  empresaEndereco?: string;
  empresaCnpj?: string;
  mesaNumero: number;
  nomeCliente?: string;
  itens: CaixaReceiptItem[];
  subtotal: number;
  desconto?: { percentual: number; valor: number };
  taxaServico?: { percentual: number; valor: number };
  couver?: { quantidade: number; valorUnitario: number; total: number };
  total: number;
  formaPagamento?: string;
  troco?: number;
  timestamp: Date;
};

/** Largura em colunas: 58mm ≈ 32 cols, 80mm ≈ 40 cols */
const getColWidth = (): number => {
  const w = localStorage.getItem('fcd-printer-width');
  return w === '58' ? 32 : 40;
};

const getPaperMm = (): number => {
  const w = localStorage.getItem('fcd-printer-width');
  return w === '58' ? 58 : 80;
};

const centerText = (text: string, width: number): string => {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
};

export const formatKitchenOrder = (order: PrintOrder): string => {
  const { mesaNumero, itens, timestamp } = order;
  const cols = getColWidth();

  const divider = '='.repeat(cols);
  const thinDivider = '-'.repeat(cols);
  
  let receipt = '';
  
  // Header
  receipt += '\n';
  receipt += divider + '\n';
  receipt += centerText('*** NOVO PEDIDO ***', cols) + '\n';
  receipt += divider + '\n';
  receipt += '\n';
  
  // Restaurant info
  if (order.empresaNome) {
    receipt += centerText(order.empresaNome.toUpperCase(), cols) + '\n';
    if (order.empresaEndereco) receipt += centerText(order.empresaEndereco, cols) + '\n';
    receipt += '\n';
  }
  receipt += centerText(`MESA ${mesaNumero}`, cols) + '\n';
  receipt += '\n';
  
  // Date/Time
  receipt += `Data: ${timestamp.toLocaleDateString('pt-BR')}\n`;
  receipt += `Hora: ${timestamp.toLocaleTimeString('pt-BR')}\n`;
  receipt += '\n';
  
  receipt += thinDivider + '\n';
  receipt += 'ITENS DO PEDIDO:\n';
  receipt += thinDivider + '\n';
  
  // Items
  itens.forEach((item, index) => {
    receipt += '\n';
    receipt += `${index + 1}. ${item.nome.toUpperCase()}\n`;
    receipt += `   Quantidade: ${item.quantidade}x\n`;
    if (item.notas) {
      receipt += `   OBS: ${item.notas}\n`;
    }
  });
  
  receipt += '\n';
  receipt += divider + '\n';
  receipt += centerText(`Total de itens: ${itens.reduce((sum, i) => sum + i.quantidade, 0)}`, cols) + '\n';
  receipt += divider + '\n';
  receipt += '\n';
  // Totals
  if (order.incluirTaxaServico && order.taxaServicoPercentual) {
    receipt += `Taxa de Servico: ${order.taxaServicoPercentual}%\n`;
  }
  if (order.couverTotal && order.couverTotal > 0) {
    receipt += `Couver: R$ ${order.couverTotal.toFixed(2)}\n`;
  }
  if (typeof order.total === 'number') {
    receipt += thinDivider + '\n';
    receipt += centerText(`TOTAL: R$ ${order.total.toFixed(2)}`, cols) + '\n';
    receipt += thinDivider + '\n';
  }
  receipt += '\n\n\n';
  
  return receipt;
};

export const printKitchenOrder = (order: PrintOrder): void => {
  const content = formatKitchenOrder(order);
  const paperMm = getPaperMm();
  const bodyWidth = paperMm - 10; // margem útil
  
  // Create a hidden iframe for silent printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    console.error('[KDS Print] Could not access iframe document');
    document.body.removeChild(iframe);
    return;
  }
  
  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
<title>Pedido Mesa ${order.mesaNumero}</title>
<style>
/* ===== SILENT PRINT: Remove browser headers/footers ===== */
@page {
  size: ${paperMm}mm auto;
  margin: 0 !important;
}
@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: ${bodyWidth}mm !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Hide any browser-injected elements */
  header, footer, nav, aside { display: none !important; }
}
/* ===== Base styles ===== */
html, body {
  margin: 0;
  padding: 2mm;
  width: ${bodyWidth}mm;
  font-family: 'Courier New', 'Lucida Console', monospace;
  font-size: ${paperMm === 58 ? '10px' : '12px'};
  line-height: 1.3;
  color: #000;
  background: #fff;
}
pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
</style>
</head>
<body><pre>${content}</pre></body>
</html>`);
  doc.close();
  
  // Wait for content to render then trigger print
  const triggerPrint = () => {
    try {
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('[KDS Print] print() blocked:', e);
    }
    // Cleanup after print dialog closes (or immediately on silent printers)
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch {}
    }, 2000);
  };

  if (iframe.contentDocument?.readyState === 'complete') {
    triggerPrint();
  } else {
    iframe.onload = triggerPrint;
  }
};

// Auto-print trigger function
export const triggerKitchenPrint = (
  mesaNumero: number,
  cartItems: { produto: { nome: string }; quantidade: number; notas: string }[]
): void => {
  const order: PrintOrder = {
    mesaNumero,
    itens: cartItems.map(item => ({
      nome: item.produto.nome,
      quantidade: item.quantidade,
      notas: item.notas || null,
    })),
    timestamp: new Date(),
  };
  
  printKitchenOrder(order);
};

// Delivery order print format
export const formatDeliveryOrder = (pedido: {
  id: string;
  endereco: { nome_cliente: string; rua: string; numero: string; bairro: string; complemento?: string; referencia?: string; telefone: string };
  itens: { nome_produto: string; quantidade: number; notas?: string }[];
  notas?: string;
}): string => {
  const divider = '='.repeat(40);
  const thinDivider = '-'.repeat(40);
  
  let receipt = '';
  
  // Header
  receipt += '\n';
  receipt += divider + '\n';
  receipt += centerText('*** PEDIDO DELIVERY ***', 40) + '\n';
  receipt += divider + '\n';
  receipt += '\n';
  
  // Order ID
  receipt += centerText(`#${pedido.id.slice(0, 8).toUpperCase()}`, 40) + '\n';
  receipt += '\n';
  
  // Date/Time
  const now = new Date();
  receipt += `Data: ${now.toLocaleDateString('pt-BR')}\n`;
  receipt += `Hora: ${now.toLocaleTimeString('pt-BR')}\n`;
  receipt += '\n';
  
  // Customer
  receipt += thinDivider + '\n';
  receipt += 'CLIENTE:\n';
  receipt += thinDivider + '\n';
  receipt += `Nome: ${pedido.endereco.nome_cliente}\n`;
  receipt += `Tel: ${pedido.endereco.telefone}\n`;
  receipt += '\n';
  
  // Address
  receipt += thinDivider + '\n';
  receipt += 'ENDERECO:\n';
  receipt += thinDivider + '\n';
  receipt += `${pedido.endereco.rua}, ${pedido.endereco.numero}\n`;
  if (pedido.endereco.complemento) {
    receipt += `Compl: ${pedido.endereco.complemento}\n`;
  }
  receipt += `Bairro: ${pedido.endereco.bairro}\n`;
  if (pedido.endereco.referencia) {
    receipt += `Ref: ${pedido.endereco.referencia}\n`;
  }
  receipt += '\n';
  
  // Items
  receipt += thinDivider + '\n';
  receipt += 'ITENS DO PEDIDO:\n';
  receipt += thinDivider + '\n';
  
  pedido.itens.forEach((item, index) => {
    receipt += '\n';
    receipt += `${index + 1}. ${item.nome_produto.toUpperCase()}\n`;
    receipt += `   Quantidade: ${item.quantidade}x\n`;
    if (item.notas) {
      receipt += `   OBS: ${item.notas}\n`;
    }
  });
  
  // Notes
  if (pedido.notas) {
    receipt += '\n';
    receipt += thinDivider + '\n';
    receipt += 'OBSERVACOES:\n';
    receipt += thinDivider + '\n';
    receipt += `${pedido.notas}\n`;
  }
  
  receipt += '\n';
  receipt += divider + '\n';
  receipt += '\n\n\n';
  
  return receipt;
};

// Print delivery order
export const printDeliveryOrder = (pedido: {
  id: string;
  endereco: { nome_cliente: string; rua: string; numero: string; bairro: string; complemento?: string; referencia?: string; telefone: string };
  itens: { nome_produto: string; quantidade: number; notas?: string }[];
  notas?: string;
}): void => {
  const content = formatDeliveryOrder(pedido);
  
  // Create a hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    console.error('Could not access iframe document');
    document.body.removeChild(iframe);
    return;
  }
  
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pedido Delivery ${pedido.id.slice(0, 8)}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          margin: 0;
          padding: 5mm;
          width: 70mm;
        }
        pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
      </style>
    </head>
    <body>
      <pre>${content}</pre>
    </body>
    </html>
  `);
  doc.close();
  
  // Wait for content to load then print
  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
};

// Trigger delivery kitchen print
export const triggerDeliveryKitchenPrint = (pedido: {
  id: string;
  endereco: { nome_cliente: string; rua: string; numero: string; bairro: string; complemento?: string; referencia?: string; telefone: string };
  itens: { nome_produto: string; quantidade: number; notas?: string }[];
  notas?: string;
}): void => {
  printDeliveryOrder(pedido);
};

// =====================================================
// IMPRESSÃO CUPOM NÃO FISCAL - CAIXA (80mm)
// =====================================================

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const rightAlignText = (left: string, right: string, width: number): string => {
  const spaces = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaces) + right;
};

export const formatCaixaReceipt = (data: CaixaReceiptData): string => {
  const divider = '='.repeat(40);
  const thinDivider = '-'.repeat(40);
  
  let receipt = '';
  
  // Header - Dados do restaurante
  receipt += '\n';
  receipt += divider + '\n';
  receipt += centerText(data.empresaNome.toUpperCase(), 40) + '\n';
  if (data.empresaCnpj) {
    receipt += centerText(`CNPJ: ${data.empresaCnpj}`, 40) + '\n';
  }
  if (data.empresaEndereco) {
    receipt += centerText(data.empresaEndereco, 40) + '\n';
  }
  receipt += divider + '\n';
  receipt += '\n';
  
  // Informações da mesa/cliente
  receipt += centerText(`MESA ${data.mesaNumero}`, 40) + '\n';
  if (data.nomeCliente) {
    receipt += centerText(`Cliente: ${data.nomeCliente}`, 40) + '\n';
  }
  receipt += '\n';
  
  // Data/Hora
  receipt += `Data: ${data.timestamp.toLocaleDateString('pt-BR')}\n`;
  receipt += `Hora: ${data.timestamp.toLocaleTimeString('pt-BR')}\n`;
  receipt += '\n';
  
  // Itens consumidos
  receipt += thinDivider + '\n';
  receipt += 'ITENS CONSUMIDOS\n';
  receipt += thinDivider + '\n';
  receipt += '\n';
  
  data.itens.forEach((item) => {
    const qtdPreco = `${item.quantidade}x R$ ${formatCurrency(item.precoUnitario)}`;
    const subtotal = `R$ ${formatCurrency(item.subtotal)}`;
    receipt += item.nome.substring(0, 22) + '\n';
    receipt += rightAlignText(`  ${qtdPreco}`, subtotal, 40) + '\n';
  });
  
  receipt += '\n';
  receipt += thinDivider + '\n';
  
  // Subtotal
  receipt += rightAlignText('SUBTOTAL:', `R$ ${formatCurrency(data.subtotal)}`, 40) + '\n';
  
  // Desconto (se houver)
  if (data.desconto && data.desconto.valor > 0) {
    receipt += rightAlignText(`DESCONTO (${data.desconto.percentual}%):`, `-R$ ${formatCurrency(data.desconto.valor)}`, 40) + '\n';
  }
  
  // Taxa de serviço (se houver)
  if (data.taxaServico && data.taxaServico.valor > 0) {
    receipt += rightAlignText(`TAXA SERVIÇO (${data.taxaServico.percentual}%):`, `R$ ${formatCurrency(data.taxaServico.valor)}`, 40) + '\n';
  }
  
  // Couver (se houver)
  if (data.couver && data.couver.total > 0) {
    receipt += rightAlignText(`COUVER (${data.couver.quantidade}x R$ ${formatCurrency(data.couver.valorUnitario)}):`, `R$ ${formatCurrency(data.couver.total)}`, 40) + '\n';
  }
  
  receipt += thinDivider + '\n';
  
  // Total
  receipt += rightAlignText('TOTAL:', `R$ ${formatCurrency(data.total)}`, 40) + '\n';
  
  receipt += divider + '\n';
  
  // Forma de pagamento
  if (data.formaPagamento) {
    const formaLabel = {
      'dinheiro': 'DINHEIRO',
      'pix': 'PIX',
      'cartao_credito': 'CARTÃO DE CRÉDITO',
      'cartao_debito': 'CARTÃO DE DÉBITO',
    }[data.formaPagamento] || data.formaPagamento.toUpperCase();
    
    receipt += `Forma de Pagamento: ${formaLabel}\n`;
    
    if (data.formaPagamento === 'dinheiro' && data.troco && data.troco > data.total) {
      receipt += `Valor Recebido: R$ ${formatCurrency(data.troco)}\n`;
      receipt += `Troco: R$ ${formatCurrency(data.troco - data.total)}\n`;
    }
  }
  
  receipt += '\n';
  receipt += centerText('*** CUPOM NÃO FISCAL ***', 40) + '\n';
  receipt += centerText('Obrigado pela preferência!', 40) + '\n';
  receipt += '\n\n\n';
  
  return receipt;
};

export const printCaixaReceipt = (data: CaixaReceiptData): void => {
  const content = formatCaixaReceipt(data);
  
  // Create a hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    console.error('Could not access iframe document');
    document.body.removeChild(iframe);
    return;
  }
  
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cupom - Mesa ${data.mesaNumero}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          margin: 0;
          padding: 5mm;
          width: 70mm;
        }
        pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
      </style>
    </head>
    <body>
      <pre>${content}</pre>
    </body>
    </html>
  `);
  doc.close();
  
  // Wait for content to load then print
  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
};
