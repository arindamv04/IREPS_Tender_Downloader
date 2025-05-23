// Listen for messages from popup.js
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "findDocuments") {
    console.log('Extension activated: searching for documents...');
    const documents = extractDocumentsFromDocument(document, window.location.href);
    console.log('Documents found:', documents.length, documents);
    sendResponse({ documents: documents });
  }
  return true;
});

function findDownloadableDocuments() {
  const documentsList = [];
  console.log('Starting document search on page:', document.title);
  console.log('Page URL:', window.location.href);
  
  // Check if we're on an IREPS page
  const isIrepsPage = window.location.hostname.includes('ireps.gov.in') || 
                      window.location.hostname.includes('ireps') || 
                      document.documentElement.innerHTML.includes('ireps');
  console.log('Is IREPS page:', isIrepsPage);
  
  // 1. First find "Download Tender Doc. (Pdf)" buttons
  console.log('Searching for tender doc buttons...');
  const tenderDocButtons = document.querySelectorAll('div.styled-button-8[onclick*="downloadtenderDoc"]');
  console.log('Found styled-button-8 tender buttons:', tenderDocButtons.length);
  
  tenderDocButtons.forEach(button => {
    console.log('Processing tender doc button:', button.outerHTML);
    // Try to extract URL from downloadtenderDoc function
    let documentUrl = '';
    
    try {
      // Look for url in script tags
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent.includes('downloadtenderDoc')) {
          console.log('Found script with downloadtenderDoc function');
          const urlMatch = script.textContent.match(/downloadtenderDoc[^{]*?{[^}]*?url\s*=\s*['"](.*?)['"]/is);
          if (urlMatch && urlMatch[1]) {
            documentUrl = urlMatch[1];
            if (documentUrl.startsWith('/')) {
              documentUrl = window.location.origin + documentUrl;
            }
            console.log('Extracted URL from downloadtenderDoc function:', documentUrl);
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error extracting URL:', e);
    }
    
    // If we couldn't extract URL, use the current page URL as fallback
    if (!documentUrl) {
      // Try to find tender ID
      const tenderIdInput = document.querySelector('input[name="tenderID"]');
      if (tenderIdInput && tenderIdInput.value) {
        documentUrl = `${window.location.origin}/ireps/etender/document/tenderDocument.do?etID=${tenderIdInput.value}`;
        console.log('Created URL from tender ID:', documentUrl);
      } else {
        documentUrl = window.location.href;
        console.log('Using current page as fallback URL');
      }
    }
    
    documentsList.push({
      url: documentUrl,
      filename: `Tender_Document_${Date.now()}.pdf`,
      text: button.textContent.trim() || 'Download Tender Doc. (Pdf)'
    });
  });
  
  // 2. Find railway document links with window.open
  console.log('Searching for railway document links...');
  const railwayDocLinks = document.querySelectorAll('a[href="#"][onclick*="window.open"][onclick*=".pdf"]');
  console.log('Found railway document links:', railwayDocLinks.length);
  
  railwayDocLinks.forEach(link => {
    const onclickAttr = link.getAttribute('onclick');
    console.log('Processing railway doc link with onclick:', onclickAttr);
    
    // Extract the PDF URL
    const urlMatches = onclickAttr.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)['"].*?\)/i);
    if (urlMatches && urlMatches[1]) {
      let pdfUrl = urlMatches[1];
      if (pdfUrl.startsWith('/')) {
        pdfUrl = window.location.origin + pdfUrl;
      }
      
      // Get filename from font element or URL
      let filename = '';
      const fontElement = link.querySelector('font');
      if (fontElement && fontElement.textContent && fontElement.textContent.trim().endsWith('.pdf')) {
        filename = fontElement.textContent.trim();
      } else {
        // Extract from URL
        const parts = pdfUrl.split('/');
        filename = parts[parts.length-1];
      }
      
      console.log(`Found railway PDF document: ${filename}, URL: ${pdfUrl}`);
      
      documentsList.push({
        url: pdfUrl,
        filename: filename,
        text: link.textContent.trim() || filename
      });
    }
  });
  
  // 3. Also check for style="color:#0033FF" title="Railway document" elements
  console.log('Searching for railway document font elements...');
  const railwayFontLinks = document.querySelectorAll('font[color="#0033FF"][title="Railway document"], font[title="Railway document"]');
  console.log('Found railway font elements:', railwayFontLinks.length);
  
  railwayFontLinks.forEach(fontElement => {
    console.log('Processing railway font element:', fontElement.outerHTML);
    
    // Check if parent is a link with window.open onclick
    const parentLink = fontElement.closest('a[onclick*="window.open"]');
    if (parentLink) {
      const onclickAttr = parentLink.getAttribute('onclick');
      const urlMatches = onclickAttr.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)['"].*?\)/i);
      if (urlMatches && urlMatches[1]) {
        let pdfUrl = urlMatches[1];
        if (pdfUrl.startsWith('/')) {
          pdfUrl = window.location.origin + pdfUrl;
        }
        
        // Use font text as filename
        const filename = fontElement.textContent.trim();
        
        console.log(`Found railway font PDF document: ${filename}, URL: ${pdfUrl}`);
        
        documentsList.push({
          url: pdfUrl,
          filename: filename,
          text: fontElement.textContent.trim()
        });
      }
    }
  });
  
  // 4. Last resort: look for any elements with window.open and PDF
  console.log('Looking for any window.open PDF elements...');
  const allElements = document.querySelectorAll('[onclick*="window.open"][onclick*=".pdf"]');
  for (const element of allElements) {
    // Skip elements we've already processed
    if (element.matches('a[href="#"]') || element.querySelector('font[color="#0033FF"]')) {
      continue;
    }
    
    console.log('Processing generic window.open element:', element.outerHTML);
    
    const onclickAttr = element.getAttribute('onclick');
    const urlMatches = onclickAttr.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)['"].*?\)/i);
    if (urlMatches && urlMatches[1]) {
      let pdfUrl = urlMatches[1];
      if (pdfUrl.startsWith('/')) {
        pdfUrl = window.location.origin + pdfUrl;
      }
      
      // Generate generic filename
      const parts = pdfUrl.split('/');
      const filename = parts[parts.length-1];
      
      console.log(`Found generic PDF document: ${filename}, URL: ${pdfUrl}`);
      
      documentsList.push({
        url: pdfUrl,
        filename: filename,
        text: element.textContent.trim() || filename
      });
    }
  }
  
  // Remove duplicates by URL
  const uniqueDocuments = [];
  const seenUrls = new Set();
  
  documentsList.forEach(doc => {
    if (!seenUrls.has(doc.url)) {
      seenUrls.add(doc.url);
      uniqueDocuments.push(doc);
    }
  });
  
  console.log('Final document list:', uniqueDocuments);
  return uniqueDocuments;
}

// inject download buttons into search results page, retry on dynamic changes
const isSearchResultsPage = window.location.pathname.includes('anonymSearch.do');
if (isSearchResultsPage) {
  console.log('Detected search results page, initializing download buttons...');
  
  const style = document.createElement('style');
  style.textContent = `
    .td-download-btn { 
      margin-left: 5px; 
      padding: 2px 6px; 
      font-size: 0.9em; 
      border: 1px solid #ccc;
      border-radius: 3px;
      background: #f0f0f0;
      cursor: pointer;
    }
    .td-download-btn:hover {
      background: #e0e0e0;
    }
    .td-download-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
  
  // Initial injection
  injectSearchResultsButtons();
  
  // Set up observer with throttling to avoid excessive calls
  let observerTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(() => {
      console.log('DOM mutation detected, re-injecting buttons...');
      injectSearchResultsButtons();
    }, 500); // Wait 500ms after last mutation
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: false // Don't watch attribute changes to reduce noise
  });
  
  console.log('Download button system initialized for search results page');
}

function injectSearchResultsButtons() {
  try {
    console.log('injectSearchResultsButtons: Starting button injection...');
    
    const imgSelectors = [
      'img[title="View Tender Details"]',
      'img[alt="View Tender Details"]',
      'img[title="View Tender Page"]',
      'img[alt="View Tender Page"]'
    ];
    
    const images = document.querySelectorAll(imgSelectors.join(','));
    console.log('injectSearchResultsButtons: Found', images.length, 'tender detail images');
    
    const anchors = Array.from(images)
      .map(img => img.closest('a'))
      .filter(a => {
        if (!a) return false;
        const onclick = a.getAttribute('onclick');
        if (!onclick) return false;
        const url = extractUrlFromOnclick(onclick);
        return !!url;
      });
    
    console.log('injectSearchResultsButtons: Found', anchors.length, 'valid tender detail links');
    
    let injectedCount = 0;
    anchors.forEach((link, index) => {
      try {
        // Check if button already exists
        const existing = link.parentNode.querySelector('.td-download-btn');
        if (existing) {
          console.log('injectSearchResultsButtons: Button already exists for link', index + 1);
          return;
        }
        
        const onclick = link.getAttribute('onclick') || '';
        const url = extractUrlFromOnclick(onclick);
        
        if (!url) {
          console.warn('injectSearchResultsButtons: Could not extract URL from onclick for link', index + 1);
          return;
        }
        
        console.log('injectSearchResultsButtons: Creating button for URL:', url);
        
        const btn = document.createElement('button');
        btn.textContent = 'Download Docs';
        btn.className = 'td-download-btn';
        btn.style.marginLeft = '5px';
        btn.style.padding = '2px 6px';
        btn.style.fontSize = '0.9em';
        btn.style.cursor = 'pointer';
        btn.title = `Download documents from: ${url}`;
        
        // Insert button after the link
        link.insertAdjacentElement('afterend', btn);
        
        // Add click handler
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Download button clicked for URL:', url);
          handleRowDownload(url, btn);
        });
        
        injectedCount++;
        console.log('injectSearchResultsButtons: Successfully injected button', injectedCount, 'for link', index + 1);
        
      } catch (err) {
        console.error('injectSearchResultsButtons: Error processing link', index + 1, err);
      }
    });
    
    console.log('injectSearchResultsButtons: Completed. Injected', injectedCount, 'buttons out of', anchors.length, 'possible locations');
    
  } catch (err) {
    console.error('injectSearchResultsButtons: Fatal error', err);
  }
}

async function handleRowDownload(tenderUrl, buttonEl, retryCount = 0) {
  const orig = buttonEl.textContent;
  const MAX_RETRIES = 2;
  const FETCH_TIMEOUT = 15000; // 15 seconds
  
  console.log(`handleRowDownload: Starting download for ${tenderUrl} (attempt ${retryCount + 1})`);
  
  buttonEl.disabled = true;
  buttonEl.textContent = retryCount > 0 ? `Retry ${retryCount}...` : 'Loading...';
  
  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('handleRowDownload: Fetch timeout after', FETCH_TIMEOUT, 'ms');
    }, FETCH_TIMEOUT);
    
    // Fetch with timeout and proper headers
    const res = await fetch(tenderUrl, { 
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; TenderDownloader)'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    
    console.log('handleRowDownload: Successfully fetched page, parsing...');
    buttonEl.textContent = 'Parsing...';
    
    const html = await res.text();
    
    if (!html || html.length < 100) {
      throw new Error('Received empty or invalid response');
    }
    
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc || !doc.body) {
      throw new Error('Failed to parse HTML document');
    }
    
    console.log('handleRowDownload: HTML parsed, extracting documents...');
    buttonEl.textContent = 'Extracting...';
    
    const documents = extractDocumentsFromDocument(doc, tenderUrl);
    
    console.log('handleRowDownload: Extraction complete, found', documents.length, 'documents');
    
    if (!documents.length) {
      console.warn('handleRowDownload: No documents found on page');
      buttonEl.textContent = 'No docs';
      buttonEl.style.backgroundColor = '#ffa500';
      setTimeout(() => { 
        buttonEl.textContent = orig; 
        buttonEl.style.backgroundColor = '';
      }, 4000);
      return;
    }
    
    buttonEl.textContent = 'Starting DL...';
    
    // Send to background script for download
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'downloadDocuments', documents, pageTitle: doc.title },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
    
    if (response && response.success) {
      console.log('handleRowDownload: Download initiated successfully');
      buttonEl.textContent = `Downloaded ${response.count}`;
      buttonEl.style.backgroundColor = '#4CAF50';
      setTimeout(() => { 
        buttonEl.textContent = orig; 
        buttonEl.style.backgroundColor = '';
      }, 3000);
    } else {
      throw new Error(response?.error || 'Download failed');
    }
    
  } catch (err) {
    console.error('handleRowDownload error:', err.message, err);
    
    // Retry logic for specific errors
    if (retryCount < MAX_RETRIES && 
        (err.name === 'AbortError' || 
         err.message.includes('fetch') || 
         err.message.includes('network') ||
         err.message.includes('HTTP 5'))) {
      
      console.log(`handleRowDownload: Retrying in 2 seconds (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      buttonEl.textContent = 'Retrying...';
      
      setTimeout(() => {
        handleRowDownload(tenderUrl, buttonEl, retryCount + 1);
      }, 2000);
      return;
    }
    
    // Final error state
    const errorMsg = err.name === 'AbortError' ? 'Timeout' : 'Error';
    buttonEl.textContent = errorMsg;
    buttonEl.style.backgroundColor = '#f44336';
    
    setTimeout(() => { 
      buttonEl.textContent = orig; 
      buttonEl.style.backgroundColor = '';
      buttonEl.disabled = false;
    }, 4000);
    return;
    
  } finally {
    if (buttonEl.textContent !== orig) {
      // Only re-enable if we're not in a retry state
      setTimeout(() => {
        buttonEl.disabled = false;
      }, 1000);
    }
  }
}

function extractUrlFromOnclick(onclick) {
  if (!onclick) {
    console.warn('extractUrlFromOnclick: No onclick attribute provided');
    return '';
  }
  
  console.log('extractUrlFromOnclick: Processing onclick:', onclick.substring(0, 100) + '...');
  
  // Try multiple patterns to extract URL
  const patterns = [
    /postRequestNewWindow\(\s*['"]([^'"]+)/i,
    /window\.open\(['"]([^'"]+)/i,
    /location\.href\s*=\s*['"]([^'"]+)/i,
    /href\s*=\s*['"]([^'"]+)/i,
    /['"]([^'"]*\.do[^'"]*)['"]/ // Generic .do URL pattern
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const match = onclick.match(patterns[i]);
    if (match && match[1]) {
      let url = match[1];
      
      // Make URL absolute if it's relative
      if (url.startsWith('/')) {
        url = window.location.origin + url;
      } else if (!url.startsWith('http')) {
        // Handle relative URLs without leading slash
        url = window.location.origin + '/' + url;
      }
      
      console.log('extractUrlFromOnclick: Extracted URL using pattern', i + 1, ':', url);
      return url;
    }
  }
  
  console.warn('extractUrlFromOnclick: Could not extract URL from onclick');
  return '';
}

function extractDocumentsFromDocument(doc, baseUrl) {
  const documentsList = [];
  const baseOrigin = (() => { try { return new URL(baseUrl).origin; } catch { return ''; } })();
  const baseHostname = (() => { try { return new URL(baseUrl).hostname; } catch { return ''; } })();
  
  console.log('extractDocumentsFromDocument: Starting extraction for', baseUrl);
  
  // Add timeout protection for large pages
  const startTime = Date.now();
  const MAX_EXTRACTION_TIME = 10000; // 10 seconds max
  
  function checkTimeout() {
    if (Date.now() - startTime > MAX_EXTRACTION_TIME) {
      console.warn('extractDocumentsFromDocument: Extraction taking too long, aborting');
      return true;
    }
    return false;
  }

  const tenderDocButtons = doc.querySelectorAll('div.styled-button-8[onclick*="downloadtenderDoc"]');
  console.log('extractDocumentsFromDocument: Found', tenderDocButtons.length, 'tender doc buttons');
  
  tenderDocButtons.forEach((button, index) => {
    if (checkTimeout()) return;
    console.log('Processing tender doc button', index + 1, 'of', tenderDocButtons.length);
    let documentUrl = '';
    try {
      const scripts = doc.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent.includes('downloadtenderDoc')) {
          const urlMatch = script.textContent.match(/downloadtenderDoc[^{]*?{[^}]*?url\s*=\s*['"]([^'"]+)/is);
          if (urlMatch?.[1]) {
            documentUrl = urlMatch[1];
            if (documentUrl.startsWith('/')) documentUrl = baseOrigin + documentUrl;
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Error extracting URL from tender doc button:', e);
    }
    if (!documentUrl) {
      const idInput = doc.querySelector('input[name="tenderID"]');
      if (idInput?.value) {
        documentUrl = `${baseOrigin}/ireps/etender/document/tenderDocument.do?etID=${idInput.value}`;
        console.log('Created tender doc URL from ID:', documentUrl);
      } else {
        documentUrl = baseUrl;
        console.log('Using base URL as fallback for tender doc');
      }
    }
    documentsList.push({ url: documentUrl, filename: `Tender_Document_${Date.now()}_${index}.pdf`, text: button.textContent.trim() });
    console.log('Added tender document:', documentUrl);
  });

  if (checkTimeout()) {
    console.warn('Skipping railway links due to timeout');
    return unique;
  }
  
  const railwayLinks = doc.querySelectorAll('a[href="#"][onclick*="window.open"][onclick*=".pdf"]');
  console.log('extractDocumentsFromDocument: Found', railwayLinks.length, 'railway links');
  
  railwayLinks.forEach((link, index) => {
    if (checkTimeout()) return;
    console.log('Processing railway link', index + 1, 'of', railwayLinks.length);
    const onclick = link.getAttribute('onclick');
    const match = onclick.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)/i);
    if (match?.[1]) {
      let pdfUrl = match[1];
      if (pdfUrl.startsWith('/')) pdfUrl = baseOrigin + pdfUrl;
      const fontEl = link.querySelector('font');
      const filename = fontEl?.textContent.trim().endsWith('.pdf') ? fontEl.textContent.trim() : pdfUrl.split('/').pop();
      documentsList.push({ url: pdfUrl, filename, text: link.textContent.trim() || filename });
      console.log('Added railway document:', pdfUrl, 'filename:', filename);
    }
  });

  if (checkTimeout()) {
    console.warn('Skipping railway fonts due to timeout');
    return unique;
  }
  
  const railwayFonts = doc.querySelectorAll('font[color="#0033FF"][title="Railway document"], font[title="Railway document"]');
  console.log('extractDocumentsFromDocument: Found', railwayFonts.length, 'railway font elements');
  
  railwayFonts.forEach((fontEl, index) => {
    if (checkTimeout()) return;
    console.log('Processing railway font', index + 1, 'of', railwayFonts.length);
    const parent = fontEl.closest('a[onclick*="window.open"]');
    if (parent) {
      const onclick = parent.getAttribute('onclick');
      const match = onclick.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)/i);
      if (match?.[1]) {
        let pdfUrl = match[1];
        if (pdfUrl.startsWith('/')) pdfUrl = baseOrigin + pdfUrl;
        const filename = fontEl.textContent.trim();
        documentsList.push({ url: pdfUrl, filename, text: filename });
        console.log('Added railway font document:', pdfUrl, 'filename:', filename);
      }
    }
  });

  if (checkTimeout()) {
    console.warn('Skipping generic elements due to timeout');
    return unique;
  }
  
  const generic = doc.querySelectorAll('[onclick*="window.open"][onclick*=".pdf"]');
  console.log('extractDocumentsFromDocument: Found', generic.length, 'generic PDF elements');
  
  generic.forEach((el, index) => {
    if (checkTimeout()) return;
    if (el.matches('a[href="#"]') || el.querySelector('font[color="#0033FF"]')) {
      console.log('Skipping already processed element', index + 1);
      return;
    }
    console.log('Processing generic element', index + 1, 'of', generic.length);
    const onclick = el.getAttribute('onclick');
    const match = onclick.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)/i);
    if (match?.[1]) {
      let pdfUrl = match[1];
      if (pdfUrl.startsWith('/')) pdfUrl = baseOrigin + pdfUrl;
      const filename = pdfUrl.split('/').pop();
      documentsList.push({ url: pdfUrl, filename, text: el.textContent.trim() || filename });
      console.log('Added generic document:', pdfUrl, 'filename:', filename);
    }
  });

  const unique = [];
  const seen = new Set();
  let duplicateCount = 0;
  
  documentsList.forEach(d => {
    if (!seen.has(d.url)) {
      seen.add(d.url);
      unique.push(d);
    } else {
      duplicateCount++;
    }
  });
  
  const extractionTime = Date.now() - startTime;
  console.log('extractDocumentsFromDocument: Completed in', extractionTime, 'ms');
  console.log('Total documents found:', documentsList.length, 'Unique:', unique.length, 'Duplicates removed:', duplicateCount);
  
  if (unique.length === 0) {
    console.warn('extractDocumentsFromDocument: No documents found, this might indicate an extraction issue');
  }
  
  return unique;
}