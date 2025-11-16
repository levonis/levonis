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
        direction: config.layout?.direction || "rtl",
        margin: "0",
        fontFamily: config.header?.fontFamily || "Cairo",
        backgroundColor: config.layout?.backgroundColor || "#ffffff",
        borderWidth: config.layout?.borderWidth || "0px",
        borderStyle: config.layout?.borderWidth !== "0px" ? "solid" : "none",
        borderColor: config.layout?.borderColor || "#e5e7eb",
        borderRadius: config.layout?.borderRadius || "8px",
        boxShadow: config.layout?.boxShadow || "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        padding: "30px",
        minHeight: "600px",
      }}
      className="bg-white"
    >
      {/* Header with Logo */}
      {config.header?.show && (
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
          <h1 className="font-bold">{config.header.title}</h1>
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
            margin: "15px 0",
          }}
        >
          {config.companyInfo.companyName && (
            <p className="font-bold">{config.companyInfo.companyName}</p>
          )}
          {config.companyInfo.companyNameEn && (
            <p className="text-sm">{config.companyInfo.companyNameEn}</p>
          )}
          {config.companyInfo.address && (
            <p className="text-sm">{config.companyInfo.address}</p>
          )}
          <div className="flex justify-center gap-4 text-sm mt-2">
            {config.companyInfo.phone && <span>{config.companyInfo.phone}</span>}
            {config.companyInfo.email && <span>{config.companyInfo.email}</span>}
            {config.companyInfo.website && <span>{config.companyInfo.website}</span>}
          </div>
          {config.companyInfo.taxNumber && (
            <p className="text-sm mt-1">الرقم الضريبي: {config.companyInfo.taxNumber}</p>
          )}
        </div>
      )}

      {/* Serial Section */}
      {config.serialSection?.show && (
        <div
          style={{
            backgroundColor: config.serialSection.backgroundColor,
            fontSize: config.serialSection.fontSize,
            padding: config.serialSection.padding,
            borderRadius: config.serialSection.borderRadius,
            borderWidth: config.serialSection.borderWidth || "0px",
            borderStyle: config.serialSection.borderWidth !== "0px" ? "solid" : "none",
            borderColor: config.serialSection.borderColor,
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
      {config.customerInfo?.show && (
        <div
          style={{
            fontSize: config.customerInfo.fontSize,
            padding: config.customerInfo.padding,
            backgroundColor: config.customerInfo.backgroundColor,
            borderRadius: config.customerInfo.borderRadius || "0px",
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

      {/* Custom Fields */}
      {config.customFields?.filter((f: any) => f.show).length > 0 && (
        <div className="grid grid-cols-2 gap-4 my-4">
          {config.customFields
            .filter((f: any) => f.show)
            .map((field: any) => (
              <div key={field.id}>
                <strong>{field.label}</strong>
                {field.labelEn && <span className="text-sm ml-2">({field.labelEn})</span>}
                <p>{field.value || "___________"}</p>
              </div>
            ))}
        </div>
      )}

      {/* Items Table */}
      {config.itemsTable?.show && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: config.itemsTable.fontSize,
            margin: "20px 0",
            borderRadius: config.itemsTable.borderRadius || "0px",
            overflow: "hidden",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: config.itemsTable.headerBackgroundColor,
                color: config.itemsTable.headerTextColor,
                fontWeight: config.itemsTable.headerFontWeight || "bold",
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
      {config.totalsSection?.show && (
        <div
          style={{
            backgroundColor: config.totalsSection.backgroundColor,
            fontSize: config.totalsSection.fontSize,
            fontWeight: config.totalsSection.fontWeight,
            padding: config.totalsSection.padding,
            borderRadius: config.totalsSection.borderRadius || "0px",
            borderWidth: config.totalsSection.borderWidth || "0px",
            borderStyle: config.totalsSection.borderWidth !== "0px" ? "solid" : "none",
            borderColor: config.totalsSection.borderColor,
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

      {/* Warranty */}
      {config.warrantySection?.show && (
        <div
          style={{
            fontSize: config.warrantySection.fontSize,
            color: config.warrantySection.textColor,
            padding: config.warrantySection.padding,
            borderTop: config.warrantySection.borderTop,
            backgroundColor: config.warrantySection.backgroundColor,
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
      {config.footer?.show && (
        <div
          style={{
            backgroundColor: config.footer.backgroundColor,
            color: config.footer.textColor,
            fontSize: config.footer.fontSize,
            padding: config.footer.padding,
            textAlign: "center",
            borderRadius: config.footer.borderRadius || "0px",
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
