interface InvoiceTemplatePreviewProps {
  template: any;
}

export const InvoiceTemplatePreview = ({
  template,
}: InvoiceTemplatePreviewProps) => {
  const config = template.template_config;

  const sampleOrder = {
    order_number: "ORD-2024-001",
    created_at: new Date().toISOString(),
    profiles: {
      full_name: "محمد أحمد",
      phone_number: "07801234567",
      governorate: "بغداد",
    },
    shipping_address: "شارع الكرادة، بناية 10، الطابق 3",
    serial_number_image_url: null,
    order_items: [
      {
        product_name_ar: "منتج تجريبي 1",
        quantity: 2,
        unit_price: 50000,
        total_price: 100000,
        selected_color: "أسود",
        selected_option: "حجم كبير",
      },
      {
        product_name_ar: "منتج تجريبي 2",
        quantity: 1,
        unit_price: 75000,
        total_price: 75000,
      },
    ],
    total_amount: 175000,
    currency: "دينار عراقي",
  };

  return (
    <div
      style={{
        direction: config.layout.direction,
        margin: config.layout.margin,
        fontFamily: config.header.fontFamily,
      }}
      className="bg-white"
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
          }}
        >
          <h1 className="font-bold">{config.header.title}</h1>
          <p className="text-sm opacity-80">{config.header.titleEn}</p>
        </div>
      )}

      {/* Serial Section */}
      {config.serialSection.show && (
        <div
          style={{
            backgroundColor: config.serialSection.backgroundColor,
            fontSize: config.serialSection.fontSize,
            padding: config.serialSection.padding,
            borderRadius: config.serialSection.borderRadius,
            margin: "20px 0",
          }}
        >
          <div className="flex justify-between">
            <div>
              <strong>رقم الطلب:</strong> {sampleOrder.order_number}
            </div>
            <div>
              <strong>التاريخ:</strong>{" "}
              {new Date(sampleOrder.created_at).toLocaleDateString("ar-IQ")}
            </div>
          </div>
        </div>
      )}

      {/* Customer Info */}
      {config.customerInfo.show && (
        <div
          style={{
            fontSize: config.customerInfo.fontSize,
            padding: config.customerInfo.padding,
            margin: "20px 0",
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span style={{ color: config.customerInfo.labelColor }}>
                <strong>اسم العميل:</strong>
              </span>{" "}
              <span style={{ color: config.customerInfo.valueColor }}>
                {sampleOrder.profiles.full_name}
              </span>
            </div>
            <div>
              <span style={{ color: config.customerInfo.labelColor }}>
                <strong>رقم الهاتف:</strong>
              </span>{" "}
              <span style={{ color: config.customerInfo.valueColor }}>
                {sampleOrder.profiles.phone_number}
              </span>
            </div>
            <div>
              <span style={{ color: config.customerInfo.labelColor }}>
                <strong>المحافظة:</strong>
              </span>{" "}
              <span style={{ color: config.customerInfo.valueColor }}>
                {sampleOrder.profiles.governorate}
              </span>
            </div>
            <div className="col-span-2">
              <span style={{ color: config.customerInfo.labelColor }}>
                <strong>عنوان التوصيل:</strong>
              </span>{" "}
              <span style={{ color: config.customerInfo.valueColor }}>
                {sampleOrder.shipping_address}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Items Table */}
      {config.itemsTable.show && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: config.itemsTable.fontSize,
            margin: "20px 0",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: config.itemsTable.headerBackgroundColor,
                color: config.itemsTable.headerTextColor,
              }}
            >
              <th style={{ padding: config.itemsTable.padding }}>المنتج</th>
              <th style={{ padding: config.itemsTable.padding }}>الكمية</th>
              <th style={{ padding: config.itemsTable.padding }}>
                السعر للوحدة
              </th>
              <th style={{ padding: config.itemsTable.padding }}>
                السعر الإجمالي
              </th>
            </tr>
          </thead>
          <tbody>
            {sampleOrder.order_items.map((item, index) => (
              <tr
                key={index}
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
                  {item.product_name_ar}
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
                  {item.unit_price.toLocaleString()} {sampleOrder.currency}
                </td>
                <td
                  style={{
                    padding: config.itemsTable.padding,
                    borderBottom: `1px solid ${config.itemsTable.borderColor}`,
                  }}
                >
                  {item.total_price.toLocaleString()} {sampleOrder.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Totals */}
      {config.totalsSection.show && (
        <div
          style={{
            backgroundColor: config.totalsSection.backgroundColor,
            fontSize: config.totalsSection.fontSize,
            fontWeight: config.totalsSection.fontWeight,
            padding: config.totalsSection.padding,
            margin: "20px 0",
          }}
        >
          <div className="flex justify-between">
            <span style={{ color: config.totalsSection.labelColor }}>
              الإجمالي:
            </span>
            <span style={{ color: config.totalsSection.valueColor }}>
              {sampleOrder.total_amount.toLocaleString()} {sampleOrder.currency}
            </span>
          </div>
        </div>
      )}

      {/* Warranty */}
      {config.warrantySection.show && (
        <div
          style={{
            fontSize: config.warrantySection.fontSize,
            color: config.warrantySection.textColor,
            padding: config.warrantySection.padding,
            borderTop: config.warrantySection.borderTop,
            margin: "20px 0",
          }}
        >
          <h3 className="font-bold mb-2">شروط الضمان:</h3>
          <ul className="list-disc pr-5 space-y-1">
            <li>جميع المنتجات مضمونة ضد عيوب الصناعة</li>
            <li>يجب الاحتفاظ بالفاتورة الأصلية</li>
          </ul>
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
            marginTop: "40px",
          }}
        >
          <p>{config.footer.text}</p>
          <p className="opacity-80">{config.footer.textEn}</p>
        </div>
      )}
    </div>
  );
};