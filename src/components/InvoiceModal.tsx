import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, Download, FileText, CheckCircle2, ShieldCheck, Building2, Calendar, Hash } from 'lucide-react';
import { api } from '../services/api.ts';
import { InvoiceData, InvoiceItem } from '../types.ts';

interface InvoiceModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ orderId, isOpen, onClose }) => {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!isOpen || !orderId) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    api
      .get<InvoiceData>(`/orders/${orderId}/invoice`)
      .then(data => {
        if (isMounted) {
          setInvoice(data);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to fetch invoice details');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (orderId) {
      // Print via hidden iframe
      const printUrl = `/api/orders/${orderId}/invoice/html`;
      if (printIframeRef.current) {
        printIframeRef.current.src = printUrl;
        printIframeRef.current.onload = () => {
          try {
            printIframeRef.current?.contentWindow?.focus();
            printIframeRef.current?.contentWindow?.print();
          } catch (e) {
            console.warn('Iframe print error', e);
          }
        };
      } else {
        window.open(printUrl, '_blank');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                Tax Invoice & Regulatory Receipt
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {invoice ? invoice.invoiceNumber : 'Loading invoice...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={!invoice}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-700 bg-slate-50/50">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 font-medium">Generating digital tax invoice...</div>
          ) : errorMessage ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium text-center">
              {errorMessage}
            </div>
          ) : invoice ? (
            <div className="space-y-4">
              {/* Header Box */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Official Tax Invoice
                  </span>
                  <div className="text-base font-black text-slate-950 font-mono mt-1">{invoice.invoiceNumber}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Issued on {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[11px] text-slate-500">Order Reference</div>
                  <div className="font-mono font-bold text-slate-900">{invoice.orderNumber}</div>
                  <div className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider mt-0.5 flex items-center sm:justify-end gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    <span>Payment: {invoice.paymentState} ({invoice.paymentMethod.toUpperCase()})</span>
                  </div>
                </div>
              </div>

              {/* Seller & Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    <span>Licensed Seller</span>
                  </div>
                  <div className="font-extrabold text-slate-900 text-xs">{invoice.seller.storeName}</div>
                  <div className="text-[11px] text-slate-500">{invoice.seller.addressLine}, {invoice.seller.city}</div>
                  <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 space-y-0.5 font-mono">
                    <div>GSTIN: <span className="font-semibold text-slate-700">{invoice.seller.gstin}</span></div>
                    <div>Excise Lic: <span className="font-semibold text-slate-700">{invoice.seller.exciseLicense}</span></div>
                    <div>FSSAI: <span className="font-semibold text-slate-700">{invoice.seller.fssaiLicense}</span></div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Billed & Delivered To</span>
                  </div>
                  <div className="font-extrabold text-slate-900 text-xs">{invoice.customer.name}</div>
                  <div className="text-[11px] text-slate-500">{invoice.customer.phone}</div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    {invoice.customer.deliveryAddress.addressLine1}, {invoice.customer.deliveryAddress.city} - {invoice.customer.deliveryAddress.postalCode}
                  </div>
                  <div className="pt-1.5 border-t border-slate-100 text-[10px] text-emerald-800 font-semibold">
                    ✓ 21+ Age Compliance Verified
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Item</th>
                      <th className="p-3 text-center">HSN</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {invoice.items.map((item: InvoiceItem, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          <div className="text-[10px] text-slate-400">{item.volume}</div>
                        </td>
                        <td className="p-3 text-center font-mono text-[10px] text-slate-500">{item.hsnCode}</td>
                        <td className="p-3 text-center font-bold text-slate-800">{item.quantity}</td>
                        <td className="p-3 text-right text-slate-600">₹{item.price}</td>
                        <td className="p-3 text-right font-bold text-slate-900">₹{item.subtotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tax & Total Breakdown */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">₹{invoice.totals.subtotal}</span>
                </div>
                {invoice.totals.discount > 0 && (
                  <div className="flex justify-between text-emerald-800 font-medium">
                    <span>Discount {invoice.totals.couponCode ? `(${invoice.totals.couponCode})` : ''}</span>
                    <span className="font-bold">-₹{invoice.totals.discount}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Charge</span>
                  <span className="font-semibold text-slate-900">₹{invoice.totals.deliveryFee}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Handling & Tamper-Proof Packaging</span>
                  <span className="font-semibold text-slate-900">₹{invoice.totals.handlingFee}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Taxes (CGST 2.5% + SGST 2.5%)</span>
                  <span className="font-semibold text-slate-900">₹{invoice.totals.taxes}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-black text-slate-950 text-sm sm:text-base">
                  <span>Total Amount Paid</span>
                  <span className="font-mono text-emerald-900 text-lg">₹{invoice.totals.totalAmount}</span>
                </div>
              </div>

              {/* Regulatory Notice */}
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[10px] text-slate-500 leading-relaxed text-center">
                This is an electronically generated valid tax invoice under Rule 48 of CGST Rules 2017. All alcoholic beverages are procured from licensed excise vends and delivered in sealed, tamper-evident thermal bags.
              </div>
            </div>
          ) : null}
        </div>

        {/* Hidden Iframe for printing */}
        <iframe ref={printIframeRef} className="hidden w-0 h-0 border-0" title="Print Invoice" />
      </div>
    </div>
  );
};
