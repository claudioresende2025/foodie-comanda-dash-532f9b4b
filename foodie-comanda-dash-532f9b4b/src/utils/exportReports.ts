import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type SalesData = {
  date: string;
  total: number;
  pedidos: number;
};

type OrderData = {
  id: string;
  mesa?: string;
  produto?: string;
  quantidade: number;
  subtotal: number;
  status: string;
  created_at: string;
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(';'),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle numbers with comma for Brazilian format
        if (typeof value === 'number') {
          return value.toFixed(2).replace('.', ',');
        }
        return `"${value || ''}"`;
      }).join(';')
    )
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
};

export const exportSalesReport = (salesData: SalesData[], empresaNome: string) => {
  const reportData = salesData.map(item => ({
    'Dia': item.date,
    'Faturamento (R$)': item.total,
    'Quantidade de Pedidos': item.pedidos,
  }));

  const totalFaturamento = salesData.reduce((sum, item) => sum + item.total, 0);
  const totalPedidos = salesData.reduce((sum, item) => sum + item.pedidos, 0);

  reportData.push({
    'Dia': 'TOTAL',
    'Faturamento (R$)': totalFaturamento,
    'Quantidade de Pedidos': totalPedidos,
  });

  const filename = `relatorio_vendas_${empresaNome}_${format(new Date(), 'yyyy-MM-dd')}`;
  exportToCSV(reportData, filename);
};

export const exportOrdersReport = (orders: OrderData[], empresaNome: string) => {
  const reportData = orders.map(order => ({
    'ID Pedido': order.id.slice(0, 8),
    'Mesa': order.mesa || '-',
    'Produto': order.produto || '-',
    'Quantidade': order.quantidade,
    'Subtotal (R$)': order.subtotal,
    'Status': order.status,
    'Data/Hora': format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
  }));

  const filename = `relatorio_pedidos_${empresaNome}_${format(new Date(), 'yyyy-MM-dd')}`;
  exportToCSV(reportData, filename);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// PDF-style HTML export (opens in new tab for printing)
export const exportToPDF = (title: string, content: string, empresaNome: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - ${empresaNome}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 { color: #333; border-bottom: 2px solid #22c55e; padding-bottom: 10px; }
        h2 { color: #666; margin-top: 20px; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th { background-color: #22c55e; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .total-row { font-weight: bold; background-color: #e8f5e9 !important; }
        .header-info { color: #666; margin-bottom: 20px; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="header-info">
        <p><strong>Empresa:</strong> ${empresaNome}</p>
        <p><strong>Data do Relatório:</strong> ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
      </div>
      ${content}
      <script>window.print();</script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

export const exportSalesReportPDF = (salesData: SalesData[], empresaNome: string) => {
  const totalFaturamento = salesData.reduce((sum, item) => sum + item.total, 0);
  const totalPedidos = salesData.reduce((sum, item) => sum + item.pedidos, 0);

  const tableRows = salesData.map(item => `
    <tr>
      <td>${item.date}</td>
      <td>R$ ${item.total.toFixed(2).replace('.', ',')}</td>
      <td>${item.pedidos}</td>
    </tr>
  `).join('');

  const content = `
    <table>
      <thead>
        <tr>
          <th>Dia</th>
          <th>Faturamento</th>
          <th>Pedidos</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        <tr class="total-row">
          <td>TOTAL</td>
          <td>R$ ${totalFaturamento.toFixed(2).replace('.', ',')}</td>
          <td>${totalPedidos}</td>
        </tr>
      </tbody>
    </table>
  `;

  exportToPDF('Relatório de Vendas - Últimos 7 dias', content, empresaNome);
};
