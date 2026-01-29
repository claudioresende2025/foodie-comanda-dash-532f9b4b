// Kitchen Order Print Utility for Thermal Printers (80mm)

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

export const formatKitchenOrder = (order: PrintOrder): string => {
  const { mesaNumero, itens, timestamp } = order;
  
  const divider = '='.repeat(40);
  const thinDivider = '-'.repeat(40);
  
  let receipt = '';
  
  // Header
  receipt += '\n';
  receipt += divider + '\n';
  receipt += centerText('*** NOVO PEDIDO ***', 40) + '\n';
  receipt += divider + '\n';
  receipt += '\n';
  
  // Table info
  if (order.empresaNome) {
    receipt += centerText(order.empresaNome.toUpperCase(), 40) + '\n';
    if (order.empresaEndereco) receipt += centerText(order.empresaEndereco, 40) + '\n';
    receipt += '\n';
  }
  receipt += centerText(`MESA ${mesaNumero}`, 40) + '\n';
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
  receipt += centerText(`Total de itens: ${itens.reduce((sum, i) => sum + i.quantidade, 0)}`, 40) + '\n';
  receipt += divider + '\n';
  receipt += '\n';
  // Totals: taxa de serviço e couver quando aplicáveis
  if (order.incluirTaxaServico && order.taxaServicoPercentual) {
    receipt += `Taxa de Servico: ${order.taxaServicoPercentual}%\n`;
  }
  if (order.couverTotal && order.couverTotal > 0) {
    receipt += `Couver: R$ ${order.couverTotal.toFixed(2)}\n`;
  }
  if (typeof order.total === 'number') {
    receipt += thinDivider + '\n';
    receipt += centerText(`TOTAL: R$ ${order.total.toFixed(2)}`, 40) + '\n';
    receipt += thinDivider + '\n';
  }
  receipt += '\n\n\n';
  
  return receipt;
};

const centerText = (text: string, width: number): string => {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
};

const rightAlign = (left: string, right: string, width: number): string => {
  const spaces = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaces) + right;
};

// Formatar cupom não fiscal para Caixa
export const formatCaixaReceipt = (data: CaixaReceiptData): string => {
  const width = 40;
  const divider = '='.repeat(width);
  const thinDivider = '-'.repeat(width);
  
  let receipt = '';
  
  // Header com dados da empresa
  receipt += '\n';
  receipt += divider + '\n';
  receipt += centerText('CUPOM NAO FISCAL', width) + '\n';
  receipt += divider + '\n';
  receipt += '\n';
  
  // Dados do restaurante
  receipt += centerText(data.empresaNome.toUpperCase(), width) + '\n';
  if (data.empresaEndereco) {
    receipt += centerText(data.empresaEndereco, width) + '\n';
  }
  if (data.empresaCnpj) {
    const cnpjFormatado = data.empresaCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    receipt += centerText(`CNPJ: ${cnpjFormatado}`, width) + '\n';
  }
  receipt += '\n';
  
  // Mesa e data/hora
  receipt += thinDivider + '\n';
  receipt += centerText(`MESA ${data.mesaNumero}`, width) + '\n';
  receipt += centerText(`${data.timestamp.toLocaleDateString('pt-BR')} ${data.timestamp.toLocaleTimeString('pt-BR')}`, width) + '\n';
  receipt += thinDivider + '\n';
  receipt += '\n';
  
  // Itens consumidos
  receipt += 'ITENS CONSUMIDOS:\n';
  receipt += thinDivider + '\n';
  
  data.itens.forEach((item) => {
    const qtdNome = `${item.quantidade}x ${item.nome}`;
    const precoUnit = `R$ ${item.precoUnitario.toFixed(2)}`;
    const subtotal = `R$ ${item.subtotal.toFixed(2)}`;
    
    // Primeira linha: quantidade + nome
    receipt += qtdNome.substring(0, width - 12) + '\n';
    // Segunda linha: preço unitário e subtotal alinhados à direita
    receipt += rightAlign(`   ${precoUnit}`, subtotal, width) + '\n';
  });
  
  receipt += '\n';
  receipt += thinDivider + '\n';
  
  // Subtotal
  receipt += rightAlign('SUBTOTAL:', `R$ ${data.subtotal.toFixed(2)}`, width) + '\n';
  
  // Desconto (se houver)
  if (data.desconto && data.desconto.valor > 0) {
    receipt += rightAlign(`DESCONTO (${data.desconto.percentual}%):`, `- R$ ${data.desconto.valor.toFixed(2)}`, width) + '\n';
  }
  
  // Taxa de serviço (se houver)
  if (data.taxaServico && data.taxaServico.valor > 0) {
    receipt += rightAlign(`TAXA SERVICO (${data.taxaServico.percentual}%):`, `R$ ${data.taxaServico.valor.toFixed(2)}`, width) + '\n';
  }
  
  // Couver (se houver)
  if (data.couver && data.couver.total > 0) {
    receipt += rightAlign(`COUVER (${data.couver.quantidade}x R$ ${data.couver.valorUnitario.toFixed(2)}):`, `R$ ${data.couver.total.toFixed(2)}`, width) + '\n';
  }
  
  receipt += thinDivider + '\n';
  
  // Total
  receipt += rightAlign('TOTAL:', `R$ ${data.total.toFixed(2)}`, width) + '\n';
  
  receipt += divider + '\n';
  
  // Forma de pagamento
  if (data.formaPagamento) {
    const formaPgtoLabels: Record<string, string> = {
      'dinheiro': 'DINHEIRO',
      'pix': 'PIX',
      'cartao_credito': 'CARTAO CREDITO',
      'cartao_debito': 'CARTAO DEBITO',
      'multiplo': 'MULTIPLO',
    };
    receipt += `Forma de Pagamento: ${formaPgtoLabels[data.formaPagamento] || data.formaPagamento}\n`;
  }
  
  // Troco (se houver)
  if (data.troco && data.troco > 0) {
    receipt += `Troco: R$ ${data.troco.toFixed(2)}\n`;
  }
  
  receipt += '\n';
  receipt += centerText('Obrigado pela preferencia!', width) + '\n';
  receipt += '\n\n\n';
  
  return receipt;
};

// Imprimir cupom não fiscal
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
      <title>Cupom Mesa ${data.mesaNumero}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.3;
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

export const printKitchenOrder = (order: PrintOrder): void => {
  const content = formatKitchenOrder(order);
  
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
      <title>Pedido Mesa ${order.mesaNumero}</title>
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
    // Remove iframe after print dialog closes
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
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