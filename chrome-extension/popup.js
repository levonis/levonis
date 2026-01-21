// Levonis Store Helper - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const pageStatus = document.getElementById('pageStatus');
  const pageText = document.getElementById('pageText');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';
    
    const supportedStores = ['amazon.', 'newegg.', 'bestbuy.'];
    const isSupported = supportedStores.some(store => url.includes(store));
    
    if (isSupported) {
      const isProduct = url.includes('/dp/') || 
                        url.includes('/gp/product/') ||
                        url.includes('/p/') ||
                        url.includes('/Product/') ||
                        (url.includes('/site/') && url.includes('.p?'));
      
      if (isProduct) {
        pageStatus.classList.remove('inactive');
        pageText.textContent = 'صفحة منتج - جاهز للإرسال';
      } else {
        pageStatus.classList.add('inactive');
        pageText.textContent = 'متجر مدعوم - انتقل لصفحة منتج';
      }
    } else {
      pageStatus.classList.add('inactive');
      pageText.textContent = 'صفحة غير مدعومة';
    }
  } catch (error) {
    pageStatus.classList.add('inactive');
    pageText.textContent = 'خطأ في الفحص';
  }
});
