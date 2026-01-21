// Levonis Store Helper - Content Script
// Extracts product data from Amazon/Newegg/BestBuy and sends to Levonis

(function() {
  'use strict';

  const LEVONIS_URL = 'https://levonis.lovable.app';
  const BUTTON_ID = 'levonis-send-button';

  // Detect which store we're on
  function detectStore() {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('amazon.')) return 'amazon';
    if (hostname.includes('newegg.')) return 'newegg';
    if (hostname.includes('bestbuy.')) return 'bestbuy';
    return null;
  }

  // Check if we're on a product page
  function isProductPage() {
    const store = detectStore();
    const url = window.location.href;
    
    switch (store) {
      case 'amazon':
        return url.includes('/dp/') || url.includes('/gp/product/');
      case 'newegg':
        return url.includes('/p/') || url.includes('/Product/');
      case 'bestbuy':
        return url.includes('/site/') && url.includes('.p?');
      default:
        return false;
    }
  }

  // Extract Amazon product data
  function extractAmazonData() {
    const data = {
      store: 'amazon',
      url: window.location.href,
      productId: null,
      productName: null,
      price: null,
      currency: 'USD',
      internalShipping: null,
      tax: null,
      variant: null,
      imageUrl: null,
      weight: null
    };

    // Extract ASIN
    const asinMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/i) ||
                      window.location.href.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    if (asinMatch) data.productId = asinMatch[1];

    // Product name
    const titleEl = document.querySelector('#productTitle');
    if (titleEl) data.productName = titleEl.textContent.trim();

    // Price - try multiple selectors
    const priceSelectors = [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole',
      '[data-a-color="price"] .a-offscreen'
    ];
    
    for (const selector of priceSelectors) {
      const priceEl = document.querySelector(selector);
      if (priceEl) {
        const priceText = priceEl.textContent.trim();
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          data.price = parseFloat(priceMatch[0].replace(/,/g, ''));
          // Detect currency
          if (priceText.includes('AED')) data.currency = 'AED';
          else if (priceText.includes('£')) data.currency = 'GBP';
          else if (priceText.includes('€')) data.currency = 'EUR';
          break;
        }
      }
    }

    // Shipping cost
    const shippingEl = document.querySelector('#deliveryBlockMessage .a-color-secondary') ||
                       document.querySelector('[data-csa-c-delivery-price]');
    if (shippingEl) {
      const shippingText = shippingEl.textContent;
      if (shippingText.toLowerCase().includes('free')) {
        data.internalShipping = 0;
      } else {
        const shippingMatch = shippingText.match(/[\d,]+\.?\d*/);
        if (shippingMatch) {
          data.internalShipping = parseFloat(shippingMatch[0].replace(/,/g, ''));
        }
      }
    }

    // Selected variant
    const variantEl = document.querySelector('#variation_selected_text') ||
                      document.querySelector('.selection');
    if (variantEl) data.variant = variantEl.textContent.trim();

    // Product image
    const imageEl = document.querySelector('#landingImage') ||
                    document.querySelector('#imgBlkFront');
    if (imageEl) data.imageUrl = imageEl.src;

    // Weight from product details
    const detailRows = document.querySelectorAll('#productDetails_detailBullets_sections1 tr, #detailBullets_feature_div li');
    detailRows.forEach(row => {
      const text = row.textContent.toLowerCase();
      if (text.includes('weight') || text.includes('الوزن')) {
        const weightMatch = text.match(/([\d.]+)\s*(kg|lb|pound|ounce|oz|كيلو)/i);
        if (weightMatch) {
          let weight = parseFloat(weightMatch[1]);
          const unit = weightMatch[2].toLowerCase();
          // Convert to kg
          if (unit === 'lb' || unit === 'pound') weight *= 0.453592;
          else if (unit === 'oz' || unit === 'ounce') weight *= 0.0283495;
          data.weight = weight;
        }
      }
    });

    return data;
  }

  // Extract Newegg product data
  function extractNeweggData() {
    const data = {
      store: 'newegg',
      url: window.location.href,
      productId: null,
      productName: null,
      price: null,
      currency: 'USD',
      internalShipping: null,
      tax: null,
      variant: null,
      imageUrl: null,
      weight: null
    };

    // Extract item number
    const itemMatch = window.location.href.match(/\/p\/([A-Z0-9-]+)/i);
    if (itemMatch) data.productId = itemMatch[1];

    // Product name
    const titleEl = document.querySelector('.product-title, h1.product-title');
    if (titleEl) data.productName = titleEl.textContent.trim();

    // Price
    const priceEl = document.querySelector('.price-current strong, .product-price .price-current');
    if (priceEl) {
      const priceText = priceEl.textContent.trim();
      const priceMatch = priceText.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        data.price = parseFloat(priceMatch[0].replace(/,/g, ''));
      }
    }

    // Shipping
    const shippingEl = document.querySelector('.product-shipping');
    if (shippingEl) {
      const shippingText = shippingEl.textContent;
      if (shippingText.toLowerCase().includes('free')) {
        data.internalShipping = 0;
      } else {
        const shippingMatch = shippingText.match(/\$[\d,]+\.?\d*/);
        if (shippingMatch) {
          data.internalShipping = parseFloat(shippingMatch[0].replace(/[$,]/g, ''));
        }
      }
    }

    // Product image
    const imageEl = document.querySelector('.product-view-img-original, .swiper-slide img');
    if (imageEl) data.imageUrl = imageEl.src;

    return data;
  }

  // Extract BestBuy product data
  function extractBestBuyData() {
    const data = {
      store: 'bestbuy',
      url: window.location.href,
      productId: null,
      productName: null,
      price: null,
      currency: 'USD',
      internalShipping: null,
      tax: null,
      variant: null,
      imageUrl: null,
      weight: null
    };

    // Extract SKU
    const skuMatch = window.location.href.match(/skuId=(\d+)/);
    if (skuMatch) data.productId = skuMatch[1];

    // Product name
    const titleEl = document.querySelector('.sku-title h1, [data-testid="heading-brand-product"]');
    if (titleEl) data.productName = titleEl.textContent.trim();

    // Price
    const priceEl = document.querySelector('.priceView-customer-price span, [data-testid="customer-price"] span');
    if (priceEl) {
      const priceText = priceEl.textContent.trim();
      const priceMatch = priceText.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        data.price = parseFloat(priceMatch[0].replace(/,/g, ''));
      }
    }

    // Product image
    const imageEl = document.querySelector('.primary-image img, [data-testid="image-gallery-image"]');
    if (imageEl) data.imageUrl = imageEl.src;

    return data;
  }

  // Extract product data based on store
  function extractProductData() {
    const store = detectStore();
    switch (store) {
      case 'amazon': return extractAmazonData();
      case 'newegg': return extractNeweggData();
      case 'bestbuy': return extractBestBuyData();
      default: return null;
    }
  }

  // Create and inject the send button
  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;
    if (!isProductPage()) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"/>
      </svg>
      <span>إرسال إلى Levonis</span>
    `;
    
    button.addEventListener('click', sendToLevonis);
    document.body.appendChild(button);
  }

  // Send product data to Levonis
  async function sendToLevonis() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;

    button.classList.add('loading');
    button.innerHTML = `
      <svg class="spinner" width="20" height="20" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="32" stroke-linecap="round"/>
      </svg>
      <span>جاري الإرسال...</span>
    `;

    try {
      const productData = extractProductData();
      
      if (!productData || !productData.productId) {
        throw new Error('لم يتم العثور على بيانات المنتج');
      }

      // Open Levonis with product data
      const params = new URLSearchParams({
        source: 'extension',
        store: productData.store,
        url: productData.url,
        productId: productData.productId || '',
        name: productData.productName || '',
        price: productData.price?.toString() || '',
        currency: productData.currency || 'USD',
        shipping: productData.internalShipping?.toString() || '',
        weight: productData.weight?.toString() || '',
        image: productData.imageUrl || ''
      });

      const targetUrl = `${LEVONIS_URL}/custom-request?${params.toString()}`;
      
      // Try to communicate with existing Levonis tab, or open new one
      window.open(targetUrl, 'levonis_app');

      button.classList.remove('loading');
      button.classList.add('success');
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>تم الإرسال!</span>
      `;

      setTimeout(() => {
        button.classList.remove('success');
        button.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"/>
          </svg>
          <span>إرسال إلى Levonis</span>
        `;
      }, 2000);

    } catch (error) {
      console.error('Levonis Extension Error:', error);
      button.classList.remove('loading');
      button.classList.add('error');
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>فشل الإرسال</span>
      `;

      setTimeout(() => {
        button.classList.remove('error');
        button.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"/>
          </svg>
          <span>إرسال إلى Levonis</span>
        `;
      }, 2000);
    }
  }

  // Initialize
  function init() {
    injectButton();
    
    // Re-inject on navigation (SPA support)
    const observer = new MutationObserver(() => {
      if (isProductPage() && !document.getElementById(BUTTON_ID)) {
        injectButton();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
