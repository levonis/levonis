-- Create settings for external store addresses (for embedded store browsing)
INSERT INTO default_settings (setting_key, setting_value)
VALUES ('external_store_addresses', '{
  "amazon": {
    "name_ar": "أمازون",
    "logo_url": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
    "base_url": "https://www.amazon.com",
    "address": {
      "country": "United States",
      "state": "Delaware",
      "city": "Wilmington",
      "zip_code": "19801",
      "street": "123 Market St"
    }
  },
  "newegg": {
    "name_ar": "نيو إيج",
    "logo_url": "https://c1.neweggimages.com/WebResource/Themes/Starter/logo_424x210.png",
    "base_url": "https://www.newegg.com",
    "address": {
      "country": "United States",
      "state": "California",
      "city": "City of Industry",
      "zip_code": "91748",
      "street": "9997 Rose Hills Rd"
    }
  },
  "bestbuy": {
    "name_ar": "بست باي",
    "logo_url": "https://upload.wikimedia.org/wikipedia/commons/f/f5/Best_Buy_Logo.svg",
    "base_url": "https://www.bestbuy.com",
    "address": {
      "country": "United States",
      "state": "Minnesota",
      "city": "Richfield",
      "zip_code": "55423",
      "street": "7601 Penn Ave S"
    }
  }
}'::jsonb)
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;