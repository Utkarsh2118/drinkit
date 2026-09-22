import { Order, Store } from '../types.ts';
import { db } from '../db/database.ts';

export interface InvoiceLineItem {
  slNo: number;
  productId: string;
  productName: string;
  name: string;
  volume: string;
  quantity: number;
  price: number;
  unitPrice: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  taxRate: number;
  taxAmount: number;
  hsnCode: string;
  subtotal: number;
  total: number;
}

export interface OrderInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  orderId: string;
  orderDate: string;
  orderStatus: string;
  company: {
    name: string;
    tradeName: string;
    tagline: string;
    cin: string;
    gstin: string;
    fssaiLicense: string;
    stateExciseLicense: string;
    registeredOffice: string;
    supportEmail: string;
    supportPhone: string;
  };
  store: {
    id: string;
    name: string;
    code: string;
    address: string;
    city: string;
    state: string;
    gstin: string;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    deliveryAddress: {
      label: string;
      fullName: string;
      phone: string;
      addressLine1: string;
      addressLine2?: string;
      landmark?: string;
      city: string;
      state: string;
      postalCode: string;
    };
  };
  payment: {
    method: string;
    state: string;
    paymentId?: string;
    gatewayOrderId?: string;
    transactionReference?: string;
    isPaid: boolean;
  };
  items: InvoiceLineItem[];
  pricing: {
    itemsSubtotal: number;
    couponDiscount: number;
    couponCode?: string;
    deliveryFee: number;
    handlingFee: number;
    totalTax: number;
    totalAmount: number;
  };
  verification: {
    deliveryOtp: string;
    recipientAgeVerified: boolean;
    qrVerificationData: string;
  };
  seller?: {
    storeId: string;
    storeName: string;
    addressLine: string;
    city: string;
    state: string;
    postalCode: string;
    gstin: string;
    exciseLicense: string;
    fssaiLicense: string;
  };
  totals?: {
    subtotal: number;
    discount: number;
    deliveryFee: number;
    handlingFee: number;
    taxes: number;
    totalAmount: number;
    couponCode?: string;
  };
  paymentMethod?: string;
  paymentState?: string;
  qrVerificationPayload?: string;
}

export class InvoiceService {
  /**
   * Builds structured invoice metadata for an order
   */
  public static buildInvoiceData(order: Order): OrderInvoiceData {
    const store = db.getStores().find(s => s.id === order.storeId) || {
      id: order.storeId || 'store_indiranagar',
      name: order.storeName || 'DrinkIt Micro-Warehouse',
      code: 'HUB-01',
      address: '100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCodes: ['560038'],
      latitude: 12.9716,
      longitude: 77.6412,
      serviceRadiusKm: 5,
      operatingHours: { open: '10:00', close: '23:00' },
      isActive: true,
      deliveryEnabled: true,
    };

    const items: InvoiceLineItem[] = order.items.map((item, idx) => {
      // 5% standard GST breakdown for itemized tax invoice
      const baseTaxable = Math.round((item.subtotal / 1.05) * 100) / 100;
      const cgst = Math.round(((item.subtotal - baseTaxable) / 2) * 100) / 100;
      const sgst = Math.round((item.subtotal - baseTaxable - cgst) * 100) / 100;

      return {
        slNo: idx + 1,
        productId: item.productId,
        productName: item.productName,
        name: item.productName,
        volume: item.volume,
        quantity: item.quantity,
        price: item.price,
        unitPrice: item.price,
        discount: 0,
        taxableAmount: baseTaxable,
        cgst,
        sgst,
        taxRate: 5,
        taxAmount: Math.round((cgst + sgst) * 100) / 100,
        hsnCode: '22030000',
        subtotal: item.subtotal,
        total: item.subtotal,
      };
    });

    const isPaid = order.paymentState === 'PAID' || order.paymentStatus === 'completed';

    return {
      invoiceNumber: order.invoiceNumber || `DRK-2026-000001`,
      invoiceDate: order.invoiceDate || order.createdAt,
      orderNumber: order.orderNumber,
      orderId: order.id,
      orderDate: order.createdAt,
      orderStatus: order.status,
      seller: {
        storeId: store.id,
        storeName: store.name,
        addressLine: store.address,
        city: store.city,
        state: store.state,
        postalCode: '560038',
        gstin: '29AAACD1234F1Z5',
        exciseLicense: 'KA-EXC-2026-BLR-0042',
        fssaiLicense: '10022043000452',
      },
      paymentMethod: order.paymentMethod,
      paymentState: order.paymentState || (isPaid ? 'PAID' : 'PENDING'),
      totals: {
        subtotal: order.subtotal,
        discount: order.discount,
        couponCode: order.couponCode,
        deliveryFee: order.deliveryFee,
        handlingFee: order.handlingFee,
        taxes: order.taxes,
        totalAmount: order.totalAmount,
      },
      company: {
        name: 'DrinkIt Quick-Commerce Technologies Private Limited',
        tradeName: 'DrinkIt — 10-Minute Chilled Beverages',
        tagline: 'Instant Delivery • 100% Genuine Bottled Quality • Verified 21+',
        cin: 'U74999KA2026PTC184920',
        gstin: '29AAACD1234F1Z5',
        fssaiLicense: '10022043000452',
        stateExciseLicense: 'KA-EXC-2026-BLR-0042',
        registeredOffice: 'No. 42, 80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034',
        supportEmail: 'orders@drinkit.app',
        supportPhone: '+91 80 4567 8900',
      },
      store: {
        id: store.id,
        name: store.name,
        code: store.code || 'HUB-BLR-01',
        address: store.address,
        city: store.city,
        state: store.state,
        gstin: '29AAACD1234F1Z5',
      },
      customer: {
        id: order.userId,
        name: order.userName,
        email: order.userEmail,
        phone: order.userPhone,
        deliveryAddress: {
          label: order.deliveryAddress?.label || 'Delivery Address',
          fullName: order.deliveryAddress?.fullName || order.userName,
          phone: order.deliveryAddress?.phone || order.userPhone,
          addressLine1: order.deliveryAddress?.addressLine1 || 'Doorstep Delivery',
          addressLine2: order.deliveryAddress?.addressLine2,
          landmark: order.deliveryAddress?.landmark,
          city: order.deliveryAddress?.city || 'Bengaluru',
          state: order.deliveryAddress?.state || 'Karnataka',
          postalCode: order.deliveryAddress?.postalCode || '560038',
        },
      },
      payment: {
        method: order.paymentMethod.toUpperCase(),
        state: order.paymentState || (isPaid ? 'PAID' : 'PENDING'),
        paymentId: order.paymentId || order.gatewayPaymentId,
        gatewayOrderId: order.gatewayOrderId,
        transactionReference: order.gatewayPaymentId || order.paymentId || 'TXN-DIRECT',
        isPaid,
      },
      items,
      pricing: {
        itemsSubtotal: order.subtotal,
        couponDiscount: order.discount,
        couponCode: order.couponCode,
        deliveryFee: order.deliveryFee,
        handlingFee: order.handlingFee,
        totalTax: order.taxes,
        totalAmount: order.totalAmount,
      },
      verification: {
        deliveryOtp: order.deliveryOtp,
        recipientAgeVerified: order.ageVerifiedAtDelivery,
        qrVerificationData: `DRINKIT|INV:${order.invoiceNumber}|ORD:${order.orderNumber}|AMT:${order.totalAmount}|OTP:${order.deliveryOtp}`,
      },
    };
  }

  /**
   * Generates a clean, modern, printable tax invoice HTML
   */
  public static generateInvoiceHtml(order: Order): string {
    const data = this.buildInvoiceData(order);
    const formattedDate = new Date(data.invoiceDate).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isPaid = data.payment.isPaid;
    const isCancelled = order.status === 'CANCELLED';
    const isRefunded = order.paymentState === 'REFUNDED' || order.paymentStatus === 'refunded';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tax Invoice — ${data.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      padding: 24px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .invoice-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }
    .invoice-header {
      padding: 28px 32px;
      border-bottom: 2px solid #059669;
      background: #fafaf9;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #064e3b;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-tagline {
      font-size: 11px;
      color: #059669;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .company-meta {
      font-size: 11px;
      color: #64748b;
      margin-top: 6px;
      line-height: 1.4;
    }
    .invoice-badge-box {
      text-align: right;
    }
    .doc-type {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .invoice-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 14px;
      font-weight: 800;
      color: #047857;
      margin-top: 4px;
    }
    .status-stamp {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      border: 1px solid;
    }
    .stamp-paid {
      background: #ecfdf5;
      color: #047857;
      border-color: #a7f3d0;
    }
    .stamp-refunded {
      background: #eff6ff;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }
    .stamp-cancelled {
      background: #fef2f2;
      color: #b91c1c;
      border-color: #fecaca;
    }
    .stamp-pending {
      background: #fffbeb;
      color: #b45309;
      border-color: #fde68a;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 24px 32px;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;
    }
    .meta-col h4 {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .meta-col p {
      font-size: 12px;
      color: #1e293b;
      line-height: 1.5;
    }
    .meta-col strong {
      font-weight: 700;
      color: #0f172a;
    }

    .table-container {
      padding: 0 32px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      font-size: 12px;
    }
    th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 2px solid #e2e8f0;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: middle;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

    .summary-section {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 24px;
      padding: 24px 32px;
      border-top: 1px solid #e2e8f0;
      background: #fafaf9;
    }
    .compliance-box {
      border: 1px dashed #cbd5e1;
      border-radius: 12px;
      padding: 14px;
      background: #ffffff;
      font-size: 11px;
      color: #475569;
      line-height: 1.5;
    }
    .compliance-box strong { color: #065f46; }

    .totals-table {
      width: 100%;
      font-size: 12px;
    }
    .totals-table td {
      padding: 6px 0;
      border-bottom: none;
    }
    .total-row td {
      border-top: 2px solid #0f172a;
      padding-top: 10px;
      font-size: 15px;
      font-weight: 900;
      color: #064e3b;
    }

    .invoice-footer {
      padding: 20px 32px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      font-size: 10px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-bar {
      margin-bottom: 16px;
      text-align: right;
    }
    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #059669;
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      padding: 8px 18px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
    }
    .btn-print:hover { background: #047857; }

    @media print {
      body { background: #ffffff; padding: 0; }
      .invoice-container { border: none; box-shadow: none; max-width: 100%; }
      .print-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div style="padding: 16px 32px 0 32px;" class="print-bar">
      <button class="btn-print" onclick="window.print()">
        🖨️ Print / Download PDF
      </button>
    </div>

    <!-- Header -->
    <div class="invoice-header">
      <div>
        <div class="brand-title">DRINKIT ⚡</div>
        <div class="brand-tagline">10-Minute Chilled Beverages Quick-Commerce</div>
        <div class="company-meta">
          <strong>${data.company.name}</strong><br />
          ${data.company.registeredOffice}<br />
          <strong>GSTIN:</strong> ${data.company.gstin} | <strong>FSSAI:</strong> ${data.company.fssaiLicense}<br />
          <strong>Excise Lic:</strong> ${data.company.stateExciseLicense}
        </div>
      </div>
      <div class="invoice-badge-box">
        <div class="doc-type">Tax Invoice / Cash Memo</div>
        <div class="invoice-id">${data.invoiceNumber}</div>
        <div class="company-meta" style="margin-top: 4px;">
          <strong>Date:</strong> ${formattedDate}<br />
          <strong>Order Ref:</strong> #${data.orderNumber}
        </div>
        <div class="status-stamp ${
          isRefunded
            ? 'stamp-refunded'
            : isCancelled
            ? 'stamp-cancelled'
            : isPaid
            ? 'stamp-paid'
            : 'stamp-pending'
        }">
          ${
            isRefunded
              ? 'REFUNDED'
              : isCancelled
              ? 'CANCELLED'
              : isPaid
              ? 'PAID ONLINE'
              : 'PAYMENT PENDING'
          }
        </div>
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="meta-grid">
      <div class="meta-col">
        <h4>Billed & Delivered To</h4>
        <p>
          <strong>${data.customer.deliveryAddress.fullName}</strong><br />
          ${data.customer.deliveryAddress.addressLine1}${
      data.customer.deliveryAddress.addressLine2
        ? ', ' + data.customer.deliveryAddress.addressLine2
        : ''
    }<br />
          ${data.customer.deliveryAddress.city}, ${data.customer.deliveryAddress.state} — ${
      data.customer.deliveryAddress.postalCode
    }<br />
          <strong>Phone:</strong> ${data.customer.phone} | <strong>Email:</strong> ${data.customer.email}
        </p>
      </div>
      <div class="meta-col">
        <h4>Fulfillment Dark Store Hub</h4>
        <p>
          <strong>${data.store.name}</strong> (${data.store.code})<br />
          ${data.store.address}, ${data.store.city}, ${data.store.state}<br />
          <strong>Payment Method:</strong> ${data.payment.method}<br />
          <strong>Transaction Ref:</strong> <span class="font-mono">${data.payment.transactionReference}</span>
        </p>
      </div>
    </div>

    <!-- Line Items Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 32px;" class="text-center">#</th>
            <th>Item Description</th>
            <th class="text-center">Variant</th>
            <th class="text-center">Qty</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Taxable</th>
            <th class="text-right">GST (5%)</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items
            .map(
              i => `<tr>
            <td class="text-center font-mono" style="color: #64748b;">${i.slNo}</td>
            <td>
              <strong>${i.name}</strong>
            </td>
            <td class="text-center font-mono" style="font-size: 11px;">${i.volume}</td>
            <td class="text-center font-mono"><strong>${i.quantity}</strong></td>
            <td class="text-right font-mono">₹${i.unitPrice.toLocaleString('en-IN')}</td>
            <td class="text-right font-mono">₹${i.taxableAmount.toLocaleString('en-IN')}</td>
            <td class="text-right font-mono">₹${(i.cgst + i.sgst).toFixed(2)}</td>
            <td class="text-right font-mono"><strong>₹${i.total.toLocaleString('en-IN')}</strong></td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <!-- Summary & Compliance Breakdown -->
    <div class="summary-section">
      <div class="compliance-box">
        <strong>Mandatory Regulatory & Excise Declaration:</strong><br />
        • All packaged alcoholic beverages and beverage mixers delivered under this invoice have been dispatched from licensed micro-warehouses.<br />
        • Verified 21+ recipient check mandatory at delivery doorstep.<br />
        • <strong>Doorstep OTP PIN:</strong> <span class="font-mono" style="font-size: 13px; font-weight: 800; color: #0f172a;">${
          data.verification.deliveryOtp
        }</span><br />
        • Support: <em>${data.company.supportEmail}</em> | <em>${data.company.supportPhone}</em>
      </div>

      <div>
        <table class="totals-table">
          <tr>
            <td style="color: #475569;">Items Subtotal:</td>
            <td class="text-right font-mono">₹${data.pricing.itemsSubtotal.toLocaleString('en-IN')}</td>
          </tr>
          ${
            data.pricing.couponDiscount > 0
              ? `<tr>
            <td style="color: #059669; font-weight: 600;">Coupon Discount (${
              data.pricing.couponCode || 'PROMO'
            }):</td>
            <td class="text-right font-mono" style="color: #059669; font-weight: 700;">-₹${data.pricing.couponDiscount.toLocaleString(
              'en-IN'
            )}</td>
          </tr>`
              : ''
          }
          <tr>
            <td style="color: #475569;">Delivery Fee (10-min priority):</td>
            <td class="text-right font-mono">${
              data.pricing.deliveryFee === 0 ? 'FREE' : '₹' + data.pricing.deliveryFee
            }</td>
          </tr>
          <tr>
            <td style="color: #475569;">Chilled Packaging & Handling:</td>
            <td class="text-right font-mono">₹${data.pricing.handlingFee}</td>
          </tr>
          <tr>
            <td style="color: #475569;">Applicable State Tax & GST (5%):</td>
            <td class="text-right font-mono">₹${data.pricing.totalTax}</td>
          </tr>
          <tr class="total-row">
            <td>Final Invoice Total:</td>
            <td class="text-right font-mono">₹${data.pricing.totalAmount.toLocaleString('en-IN')}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <div>
        This is a computer-generated invoice issued in accordance with Rule 46 of the CGST Rules, 2017.<br />
        No physical signature required. DrinkIt Quick-Commerce Technologies Pvt. Ltd.
      </div>
      <div class="font-mono" style="font-size: 10px;">
        AUTH_TOKEN: ${Buffer.from(data.verification.qrVerificationData)
          .toString('base64')
          .slice(0, 24)}...
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}
