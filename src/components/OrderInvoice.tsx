import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface OrderInvoiceProps {
  order: any;
}

export const OrderInvoice = ({ order }: OrderInvoiceProps) => {
  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'قيد الانتظار',
      confirmed: 'مؤكد',
      processing: 'قيد التجهيز',
      shipped: 'تم الشحن',
      delivered: 'تم التوصيل',
      cancelled: 'ملغي',
    };
    return statusMap[status] || status;
  };

  return (
    <div id="invoice-content" className="bg-white text-gray-900 p-8 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="border-b-4 border-[#8B7355] pb-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-[#8B7355] mb-2">فاتورة</h1>
            <p className="text-lg text-gray-600">رقم الطلب: {order.order_number}</p>
          </div>
          <div className="text-left">
            <div className="text-sm text-gray-600">تاريخ الإصدار</div>
            <div className="font-bold">{format(new Date(order.created_at), 'PPP', { locale: ar })}</div>
          </div>
        </div>
      </div>

      {/* Customer & Order Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-bold text-lg mb-3 text-[#8B7355]">معلومات العميل</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">الاسم: </span>
              <span className="font-medium">{order.profiles?.full_name || 'غير محدد'}</span>
            </div>
            <div>
              <span className="text-gray-600">البريد الإلكتروني: </span>
              <span className="font-medium">{order.profiles?.email || 'غير محدد'}</span>
            </div>
            <div>
              <span className="text-gray-600">رقم الهاتف: </span>
              <span className="font-medium">{order.phone_number}</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="font-bold text-lg mb-3 text-[#8B7355]">معلومات الشحن</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">العنوان: </span>
              <span className="font-medium">{order.shipping_address}</span>
            </div>
            <div>
              <span className="text-gray-600">المحافظة: </span>
              <span className="font-medium">{order.governorate}</span>
            </div>
            <div>
              <span className="text-gray-600">الحالة: </span>
              <span className="font-medium">{getStatusLabel(order.status)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tracking Info */}
      {(order.tracking_number || order.shipping_company) && (
        <div className="bg-gray-50 p-4 rounded-lg mb-8">
          <h3 className="font-bold text-lg mb-3 text-[#8B7355]">معلومات التتبع</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {order.shipping_company && (
              <div>
                <span className="text-gray-600">شركة الشحن: </span>
                <span className="font-medium">{order.shipping_company}</span>
              </div>
            )}
            {order.tracking_number && (
              <div>
                <span className="text-gray-600">رقم التتبع: </span>
                <span className="font-mono font-medium">{order.tracking_number}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="mb-8">
        <h3 className="font-bold text-lg mb-4 text-[#8B7355]">تفاصيل المنتجات</h3>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#8B7355] text-white">
              <th className="p-3 text-right">المنتج</th>
              <th className="p-3 text-center">الكمية</th>
              <th className="p-3 text-center">سعر الوحدة</th>
              <th className="p-3 text-center">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((item: any, index: number) => (
              <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                <td className="p-3 border-b">
                  <div className="font-medium">{item.product_name_ar}</div>
                  {item.selected_option && (
                    <div className="text-sm text-gray-600">الخيار: {item.selected_option}</div>
                  )}
                  {item.selected_color && (
                    <div className="text-sm text-gray-600">اللون: {item.selected_color}</div>
                  )}
                </td>
                <td className="p-3 border-b text-center">{item.quantity}</td>
                <td className="p-3 border-b text-center">
                  {formatPrice(Number(item.unit_price))} {order.currency}
                </td>
                <td className="p-3 border-b text-center font-medium">
                  {formatPrice(Number(item.total_price))} {order.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-80">
          <div className="border-t-2 border-[#8B7355] pt-4">
            <div className="flex justify-between items-center text-2xl font-bold text-[#8B7355]">
              <span>الإجمالي:</span>
              <span>{formatPrice(Number(order.total_amount))} {order.currency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t-2 border-gray-200 text-center text-sm text-gray-600">
        <p>شكراً لتسوقك معنا!</p>
        <p className="mt-2">للاستفسارات: واتساب 9647838455220</p>
      </div>
    </div>
  );
};
