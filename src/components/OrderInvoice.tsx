import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface OrderInvoiceProps {
  order: any;
}

export const OrderInvoice = ({ order }: OrderInvoiceProps) => {
  return (
    <div id="invoice-content" className="bg-white text-gray-900 p-8 max-w-4xl mx-auto" dir="rtl">
      {/* Header with border */}
      <div className="border-4 border-teal-600 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Left side - Title */}
          <div>
            <h1 className="text-5xl font-bold text-teal-600 italic mb-2" style={{ fontFamily: 'cursive' }}>
              levonis<span className="text-4xl not-italic">إيصال</span>
            </h1>
            <p className="text-sm text-teal-700 font-medium">إيصال الدفع وضمان المشتري</p>
          </div>

          {/* Right side - Serial and Date */}
          <div className="text-left space-y-2">
            <div className="text-sm">
              <span className="text-teal-700 font-medium">الرقم التسلسلي: </span>
              <span className="font-bold">{order.order_number}</span>
            </div>
            <div className="text-sm">
              <span className="text-teal-700 font-medium">التاريخ: </span>
              <span>{format(new Date(order.created_at), 'd / M / yyyy')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer and Product Info */}
      <div className="border-4 border-teal-600 mb-6">
        <div className="grid grid-cols-2">
          {/* Left - Customer Info */}
          <div className="border-l-2 border-teal-600 p-6 space-y-3">
            <div>
              <span className="text-teal-700 font-bold">الاسم : </span>
              <span className="font-medium">{order.profiles?.full_name || 'غير محدد'}</span>
            </div>
            <div>
              <span className="text-teal-700 font-bold">العنوان : </span>
              <span className="font-medium">{order.shipping_address} / {order.governorate}</span>
            </div>
            <div>
              <span className="text-teal-700 font-bold">رقم الهاتف: </span>
              <span className="font-medium">{order.phone_number}</span>
            </div>
          </div>

          {/* Right - Product and Serial Info */}
          <div className="p-6 space-y-4">
            <div className="text-sm">
              <div className="font-bold mb-1">الموديل: {order.order_items?.[0]?.product_name_ar || 'غير محدد'}</div>
              <div className="font-bold">رقم المنتج: {order.order_number}</div>
            </div>
            
            {/* Serial Number Image */}
            {order.serial_number_image_url && (
              <div className="border-2 border-teal-600 p-2">
                <img 
                  src={order.serial_number_image_url} 
                  alt="Serial Number" 
                  className="w-full h-auto max-h-32 object-contain"
                />
              </div>
            )}

            {/* Company Info */}
            <div className="text-xs border border-gray-300 p-2">
              <div className="font-bold mb-1">اسم الشركة: Levonis IQ</div>
              <div>العنوان: العراق - بغداد</div>
              <div>البريد الإلكتروني: info@levonis.net</div>
              <div>واتساب: 9647838455220</div>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="border-4 border-teal-600 mb-6">
        <table className="w-full">
          <thead>
            <tr className="bg-teal-50">
              <th className="p-3 text-right border-l border-teal-600 font-bold text-teal-700">اسم القطعة</th>
              <th className="p-3 text-center border-l border-teal-600 font-bold text-teal-700">الكمية</th>
              <th className="p-3 text-center border-l border-teal-600 font-bold text-teal-700">السعر للقطعة</th>
              <th className="p-3 text-center font-bold text-teal-700">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((item: any) => (
              <tr key={item.id} className="border-t-2 border-teal-600">
                <td className="p-3 border-l border-teal-600">
                  <div className="font-medium">{item.product_name_ar}</div>
                  {item.selected_color && (
                    <div className="text-sm text-gray-600">اللون: {item.selected_color}</div>
                  )}
                  {item.selected_option && (
                    <div className="text-sm text-gray-600">الخيار: {item.selected_option}</div>
                  )}
                </td>
                <td className="p-3 text-center border-l border-teal-600">{item.quantity}</td>
                <td className="p-3 text-center border-l border-teal-600">
                  {formatPrice(Number(item.unit_price))} {order.currency}
                </td>
                <td className="p-3 text-center font-bold text-teal-700 text-lg">
                  {formatPrice(Number(item.total_price))} {order.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="border-4 border-teal-600 mb-6">
        <table className="w-full">
          <tbody>
            <tr className="border-b-2 border-teal-600">
              <td className="p-4 text-teal-700 font-bold text-center align-top" colSpan={2}>
                <div className="mb-4">توقيع المكتب</div>
                <div className="text-xs mt-4 text-gray-700 leading-relaxed text-right">
                  يحق للمشتري استرداد المبلغ المدفوع مقدماً خلال مدة أقصاها ثلاثة (3) أيام من تاريخ الدفع، 
                  على أن يتحمل 25% من قيمة المبلغ كرسوم إدارية وتعويضية
                </div>
              </td>
              <td className="p-4 border-r-2 border-teal-600" colSpan={2}>
                <table className="w-full text-sm">
                  <tr>
                    <td className="py-2 text-gray-700">المجموع الفرعي مع التأمين والضمان:</td>
                    <td className="py-2 text-left font-bold text-lg">{formatPrice(Number(order.total_amount))} {order.currency}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-700">ما تم دفعه مقدماً:</td>
                    <td className="py-2 text-left italic text-gray-600">0 {order.currency}</td>
                  </tr>
                  <tr className="border-t-2 border-teal-600">
                    <td className="py-3 font-bold text-teal-700">المجموع النهائي المتبقي:</td>
                    <td className="py-3 text-left font-bold text-xl text-teal-700">
                      {formatPrice(Number(order.total_amount))} {order.currency}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Warranty Section */}
      <div className="border-4 border-teal-600 p-6 mb-6">
        <h3 className="text-xl font-bold text-center text-teal-700 mb-4">الضمان والملكية:</h3>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-center">
            نقر نحن بأننا نتحمل كافة التكاليف والنفقات في حال حصول أي خلل في القطعة مستقبلاً،
            وذلك ضمن نطاق الضمان الرسمي المقرر.
          </p>
          <p className="text-center">
            كما نعتبر وصول الاستلام أصلاً أساسياً لإثبات الضمان والملكية. وفي حال ضياع ورقة الاستلام،
            تلغى كافة الضمانات والملكية المترتبة على القطع المشتراة من قبلنا.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center">
        <h2 className="text-4xl font-bold text-teal-600 italic mb-2" style={{ fontFamily: 'cursive' }}>
          levonis iq
        </h2>
        <p className="text-sm text-gray-600">شكراً لتسوقك معنا!</p>
      </div>
    </div>
  );
};
