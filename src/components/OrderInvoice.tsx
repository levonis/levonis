import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OrderInvoiceProps {
  order: any;
}

export const OrderInvoice = ({ order }: OrderInvoiceProps) => {
  const { data: template } = useQuery({
    queryKey: ["default-invoice-template"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_templates")
        .select("*")
        .eq("is_default", true)
        .single();

      if (error) {
        console.error('Error fetching invoice template:', error);
        return null;
      }
      return data;
    },
  });

  const config = (template?.template_config as any) || {
    layout: { direction: "rtl", margin: "20px", backgroundColor: "#ffffff", borderWidth: "0px", borderColor: "#e5e7eb", borderRadius: "0px", boxShadow: "none" },
    header: {
      show: true,
      backgroundColor: "#123f35",
      textColor: "#d4af37",
      fontSize: "24px",
      fontFamily: "Cairo",
      title: "فاتورة مبيعات",
      titleEn: "Sales Invoice",
      logoUrl: "",
      logoWidth: "120px",
      logoPosition: "center",
      padding: "20px",
      borderRadius: "0px",
      boxShadow: "none",
    },
    companyInfo: {
      show: false,
      companyName: "",
      companyNameEn: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      taxNumber: "",
      fontSize: "12px",
      textColor: "#1f2937",
      padding: "15px",
    },
    serialSection: {
      show: true,
      backgroundColor: "#f8f9fa",
      fontSize: "14px",
      fontFamily: "Cairo",
      padding: "15px",
      borderRadius: "8px",
      borderWidth: "0px",
      borderColor: "#e5e7eb",
    },
    customerInfo: {
      show: true,
      fontSize: "14px",
      fontFamily: "Cairo",
      labelColor: "#123f35",
      valueColor: "#1f2937",
      padding: "10px",
      backgroundColor: "transparent",
      borderRadius: "0px",
    },
    itemsTable: {
      show: true,
      headerBackgroundColor: "#123f35",
      headerTextColor: "#d4af37",
      rowBackgroundColor: "#ffffff",
      alternateRowColor: "#f8f9fa",
      borderColor: "#e5e7eb",
      fontSize: "14px",
      fontFamily: "Cairo",
      padding: "12px",
      borderRadius: "0px",
      headerFontWeight: "bold",
    },
    totalsSection: {
      show: true,
      backgroundColor: "#f8f9fa",
      fontSize: "16px",
      fontFamily: "Cairo",
      labelColor: "#123f35",
      valueColor: "#1f2937",
      fontWeight: "bold",
      padding: "15px",
      borderRadius: "8px",
      borderWidth: "2px",
      borderColor: "#123f35",
    },
    warrantySection: {
      show: true,
      fontSize: "12px",
      fontFamily: "Cairo",
      textColor: "#6b7280",
      padding: "15px",
      borderTop: "1px solid #e5e7eb",
      backgroundColor: "transparent",
    },
    footer: {
      show: true,
      backgroundColor: "#123f35",
      textColor: "#d4af37",
      fontSize: "12px",
      fontFamily: "Cairo",
      text: "شكراً لتعاملكم معنا",
      textEn: "Thank you for your business",
      padding: "15px",
      borderRadius: "0px",
    },
    signature: {
      show: false,
      label: "التوقيع",
      labelEn: "Signature",
      imageUrl: "",
      position: "left",
      width: "150px",
      padding: "20px",
    },
    customFields: [],
  };

  return (
    <div 
      id="invoice-content" 
      className="bg-white text-gray-900 p-8 max-w-4xl mx-auto" 
      dir={config.layout.direction}
      style={{ 
        fontFamily: config.header.fontFamily,
        margin: config.layout.margin,
        backgroundColor: config.layout.backgroundColor,
        borderWidth: config.layout.borderWidth,
        borderStyle: config.layout.borderWidth !== "0px" ? "solid" : "none",
        borderColor: config.layout.borderColor,
        borderRadius: config.layout.borderRadius,
        boxShadow: config.layout.boxShadow,
      }}
    >
      {/* Header */}
      {config.header.show && (
        <div
          style={{
            backgroundColor: config.header.backgroundColor,
            color: config.header.textColor,
            fontSize: config.header.fontSize,
            padding: config.header.padding,
            textAlign: "center",
            fontFamily: config.header.fontFamily,
            borderRadius: config.header.borderRadius || "0px",
            boxShadow: config.header.boxShadow || "none",
          }}
          className="rounded-t-lg mb-6"
        >
          {config.header.logoUrl && (
            <div
              style={{
                display: "flex",
                justifyContent: config.header.logoPosition === "left" ? "flex-start" : config.header.logoPosition === "right" ? "flex-end" : "center",
                marginBottom: "15px",
              }}
            >
              <img
                src={config.header.logoUrl}
                alt="Logo"
                style={{
                  width: config.header.logoWidth || "120px",
                  height: "auto",
                }}
              />
            </div>
          )}
          <h1 className="font-bold mb-2">{config.header.title}</h1>
          <p className="text-sm opacity-80">{config.header.titleEn}</p>
        </div>
      )}

      {/* Company Info */}
      {config.companyInfo?.show && (
        <div
          style={{
            fontSize: config.companyInfo.fontSize,
            color: config.companyInfo.textColor,
            padding: config.companyInfo.padding,
            textAlign: "center",
          }}
          className="mb-6"
        >
          {config.companyInfo.companyName && (
            <p className="font-bold">{config.companyInfo.companyName}</p>
          )}
          {config.companyInfo.companyNameEn && (
            <p className="text-sm">{config.companyInfo.companyNameEn}</p>
          )}
          {config.companyInfo.address && (
            <p className="text-sm mt-1">{config.companyInfo.address}</p>
          )}
          <div className="flex justify-center gap-4 text-sm mt-2">
            {config.companyInfo.phone && <span>📞 {config.companyInfo.phone}</span>}
            {config.companyInfo.email && <span>✉️ {config.companyInfo.email}</span>}
            {config.companyInfo.website && <span>🌐 {config.companyInfo.website}</span>}
          </div>
          {config.companyInfo.taxNumber && (
            <p className="text-sm mt-1">الرقم الضريبي: {config.companyInfo.taxNumber}</p>
          )}
        </div>
      )}

      {/* Serial Number and Date */}
      {config.serialSection.show && (
        <div
          style={{
            backgroundColor: config.serialSection.backgroundColor,
            fontSize: config.serialSection.fontSize,
            padding: config.serialSection.padding,
            borderRadius: config.serialSection.borderRadius,
            fontFamily: config.serialSection.fontFamily,
          }}
          className="mb-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="opacity-70 mb-1">رقم الطلب / Order Number</p>
              <p className="font-bold text-lg">{order.order_number}</p>
            </div>
            <div>
              <p className="opacity-70 mb-1">التاريخ / Date</p>
              <p className="font-bold text-lg">{format(new Date(order.created_at), 'd / M / yyyy')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Customer and Product Information */}
      {config.customerInfo.show && (
        <div
          style={{
            fontSize: config.customerInfo.fontSize,
            padding: config.customerInfo.padding,
            fontFamily: config.customerInfo.fontFamily,
          }}
          className="mb-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p
                style={{ color: config.customerInfo.labelColor }}
                className="font-semibold mb-1"
              >
                اسم العميل / Customer Name
              </p>
              <p style={{ color: config.customerInfo.valueColor }}>
                {order.profiles?.full_name || 'غير محدد'}
              </p>
            </div>
            <div>
              <p
                style={{ color: config.customerInfo.labelColor }}
                className="font-semibold mb-1"
              >
                رقم الهاتف / Phone Number
              </p>
              <p style={{ color: config.customerInfo.valueColor }}>
                {order.phone_number}
              </p>
            </div>
            <div>
              <p
                style={{ color: config.customerInfo.labelColor }}
                className="font-semibold mb-1"
              >
                المحافظة / Governorate
              </p>
              <p style={{ color: config.customerInfo.valueColor }}>
                {order.governorate}
              </p>
            </div>
            <div>
              <p
                style={{ color: config.customerInfo.labelColor }}
                className="font-semibold mb-1"
              >
                عنوان التوصيل / Delivery Address
              </p>
              <p style={{ color: config.customerInfo.valueColor }}>
                {order.shipping_address}
              </p>
            </div>
          </div>

          {order.serial_number_image_url && (
            <div className="mt-4">
              <p
                style={{ color: config.customerInfo.labelColor }}
                className="font-semibold mb-2"
              >
                صورة الرقم التسلسلي / Serial Number Image
              </p>
              <img
                src={order.serial_number_image_url}
                alt="Serial Number"
                className="max-w-md rounded-lg border"
              />
            </div>
          )}
        </div>
      )}

      {/* Items Table */}
      {config.itemsTable.show && (
        <div className="mb-6">
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: config.itemsTable.fontSize,
              fontFamily: config.itemsTable.fontFamily,
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: config.itemsTable.headerBackgroundColor,
                  color: config.itemsTable.headerTextColor,
                }}
              >
                <th style={{ padding: config.itemsTable.padding }} className="text-right">
                  المنتج / Product
                </th>
                <th style={{ padding: config.itemsTable.padding }} className="text-right">
                  الكمية / Qty
                </th>
                <th style={{ padding: config.itemsTable.padding }} className="text-right">
                  السعر للوحدة / Unit Price
                </th>
                <th style={{ padding: config.itemsTable.padding }} className="text-right">
                  السعر الإجمالي / Total
                </th>
              </tr>
            </thead>
            <tbody>
              {order.order_items?.map((item: any, index: number) => (
                <tr
                  key={item.id}
                  style={{
                    backgroundColor:
                      index % 2 === 0
                        ? config.itemsTable.rowBackgroundColor
                        : config.itemsTable.alternateRowColor,
                  }}
                >
                  <td
                    style={{
                      padding: config.itemsTable.padding,
                      borderBottom: `1px solid ${config.itemsTable.borderColor}`,
                    }}
                  >
                    <div>
                      <p className="font-medium">{item.product_name_ar}</p>
                      {item.selected_color && (
                        <p className="text-sm opacity-70">
                          اللون: {item.selected_color}
                        </p>
                      )}
                      {item.selected_option && (
                        <p className="text-sm opacity-70">
                          الخيار: {item.selected_option}
                        </p>
                      )}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: config.itemsTable.padding,
                      borderBottom: `1px solid ${config.itemsTable.borderColor}`,
                    }}
                  >
                    {item.quantity}
                  </td>
                  <td
                    style={{
                      padding: config.itemsTable.padding,
                      borderBottom: `1px solid ${config.itemsTable.borderColor}`,
                    }}
                  >
                    {formatPrice(Number(item.unit_price))} {order.currency}
                  </td>
                  <td
                    style={{
                      padding: config.itemsTable.padding,
                      borderBottom: `1px solid ${config.itemsTable.borderColor}`,
                    }}
                    className="font-semibold"
                  >
                    {formatPrice(Number(item.total_price))} {order.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      {config.totalsSection.show && (
        <div
          style={{
            backgroundColor: config.totalsSection.backgroundColor,
            fontSize: config.totalsSection.fontSize,
            fontWeight: config.totalsSection.fontWeight,
            padding: config.totalsSection.padding,
            fontFamily: config.totalsSection.fontFamily,
            borderRadius: config.totalsSection.borderRadius || "8px",
            borderWidth: config.totalsSection.borderWidth || "0px",
            borderStyle: config.totalsSection.borderWidth !== "0px" ? "solid" : "none",
            borderColor: config.totalsSection.borderColor,
          }}
          className="rounded-lg mb-6"
        >
          <div className="flex justify-between items-center">
            <span style={{ color: config.totalsSection.labelColor }}>
              الإجمالي / Total Amount
            </span>
            <span
              style={{ color: config.totalsSection.valueColor }}
              className="text-2xl"
            >
              {formatPrice(Number(order.total_amount))} {order.currency}
            </span>
          </div>
        </div>
      )}

      {/* Custom Fields */}
      {config.customFields?.filter((f: any) => f.show).length > 0 && (
        <div className="grid grid-cols-2 gap-4 my-6">
          {config.customFields
            .filter((f: any) => f.show)
            .map((field: any) => (
              <div key={field.id} className="border-b pb-2">
                <span className="font-semibold">{field.label}</span>
                {field.labelEn && (
                  <span className="text-sm opacity-70 ml-2">({field.labelEn})</span>
                )}
                <p className="mt-1">{field.value || "___________"}</p>
              </div>
            ))}
        </div>
      )}

      {/* Signature */}
      {config.signature?.show && config.signature?.imageUrl && (
        <div
          style={{
            padding: config.signature.padding,
            margin: "30px 0",
            display: "flex",
            justifyContent: config.signature.position === "left" ? "flex-start" : config.signature.position === "right" ? "flex-end" : "center",
          }}
        >
          <div className="text-center">
            <img
              src={config.signature.imageUrl}
              alt="Signature"
              style={{
                width: config.signature.width || "150px",
                height: "auto",
              }}
            />
            <p className="mt-2 font-bold">{config.signature.label}</p>
            {config.signature.labelEn && (
              <p className="text-sm opacity-70">{config.signature.labelEn}</p>
            )}
          </div>
        </div>
      )}

      {/* Warranty and Ownership Terms */}
      {config.warrantySection.show && (
        <div
          style={{
            fontSize: config.warrantySection.fontSize,
            color: config.warrantySection.textColor,
            padding: config.warrantySection.padding,
            borderTop: config.warrantySection.borderTop,
            fontFamily: config.warrantySection.fontFamily,
          }}
          className="space-y-3"
        >
          <div>
            <h3 className="font-bold mb-2">شروط الضمان / Warranty Terms</h3>
            <ul className="list-disc pr-5 space-y-1">
              <li>جميع المنتجات مضمونة ضد عيوب الصناعة</li>
              <li>مدة الضمان حسب نوع المنتج</li>
              <li>يجب الاحتفاظ بالفاتورة الأصلية لتفعيل الضمان</li>
              <li>الضمان لا يشمل سوء الاستخدام أو الأضرار الخارجية</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-2">شروط الملكية / Ownership Terms</h3>
            <ul className="list-disc pr-5 space-y-1">
              <li>تنتقل ملكية المنتج بعد الدفع الكامل</li>
              <li>العميل مسؤول عن المنتج بعد استلامه</li>
              <li>يحق للعميل إرجاع المنتج خلال 7 أيام من الاستلام في حالة وجود عيب مصنعي</li>
              <li>المنتج يجب أن يكون بحالته الأصلية للإرجاع</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-2">ملاحظات / Notes</h3>
            <ul className="list-disc pr-5 space-y-1">
              <li>هذه الفاتورة صالحة كإثبات للشراء</li>
              <li>للاستفسارات، يرجى الاتصال بخدمة العملاء</li>
              <li>نشكركم على ثقتكم بنا</li>
            </ul>
          </div>
        </div>
      )}

      {/* Footer */}
      {config.footer.show && (
        <div
          style={{
            backgroundColor: config.footer.backgroundColor,
            color: config.footer.textColor,
            fontSize: config.footer.fontSize,
            padding: config.footer.padding,
            textAlign: "center",
            fontFamily: config.footer.fontFamily,
          }}
          className="mt-8 rounded-b-lg"
        >
          <p>{config.footer.text}</p>
          <p className="opacity-80 mt-1">{config.footer.textEn}</p>
        </div>
      )}
    </div>
  );
};