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
  receipt += '\n\n\n';
  
  return receipt;
};

const centerText = (text: string, width: number): string => {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
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
