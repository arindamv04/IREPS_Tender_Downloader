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

// inject download buttons into search results page
const isSearchResultsPage = window.location.pathname.includes('anonymSearch.do');
if (isSearchResultsPage) {
  const style = document.createElement('style');
  style.textContent = '.td-download-btn { margin-left: 5px; padding: 2px 6px; font-size: 0.9em; }';
  document.head.appendChild(style);
  injectSearchResultsButtons();
}

function injectSearchResultsButtons() {
  // Locate the "View Tender Details" icon link and inject a download button next to it
  const anchors = Array.from(
    document.querySelectorAll('img[title="View Tender Details"]')
  )
    .map(img => img.closest('a'))
    .filter(a => a);
  console.log('injectSearchResultsButtons: found', anchors.length, 'tender detail icons');
  anchors.forEach(link => {
    if (link.nextElementSibling && link.nextElementSibling.classList.contains('td-download-btn')) {
      return;
    }
    const btn = document.createElement('button');
    btn.textContent = 'Download Docs';
    btn.className = 'td-download-btn';
    link.parentNode.insertBefore(btn, link.nextSibling);
    btn.addEventListener('click', e => {
      e.preventDefault();
      const onclick = link.getAttribute('onclick') || '';
      const url = extractUrlFromOnclick(onclick);
      handleRowDownload(url, btn);
    });
  });
}

async function handleRowDownload(tenderUrl, buttonEl) {
  const orig = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = 'Loading...';
  try {
    const res = await fetch(tenderUrl, { credentials: 'include' });
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const documents = extractDocumentsFromDocument(doc, tenderUrl);
    chrome.runtime.sendMessage({ action: 'downloadDocuments', documents, pageTitle: doc.title });
  } catch {
    buttonEl.textContent = 'Error';
    setTimeout(() => { buttonEl.textContent = orig; }, 3000);
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = orig;
  }
}

function extractUrlFromOnclick(onclick) {
  if (!onclick) return '';
  const m = onclick.match(/postRequestNewWindow\(\s*['"]([^'"]+)/i) ||
            onclick.match(/window\.open\(['"]([^'"]+)/i) ||
            onclick.match(/location\.href\s*=\s*['"]([^'"]+)/i);
  if (m && m[1]) {
    let u = m[1];
    if (u.startsWith('/')) u = window.location.origin + u;
    return u;
  }
  return '';
}

function extractDocumentsFromDocument(doc, baseUrl) {
  const documentsList = [];
  const baseOrigin = (() => { try { return new URL(baseUrl).origin; } catch { return ''; } })();
  const baseHostname = (() => { try { return new URL(baseUrl).hostname; } catch { return ''; } })();

  const tenderDocButtons = doc.querySelectorAll('div.styled-button-8[onclick*="downloadtenderDoc"]');
  tenderDocButtons.forEach(button => {
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
    } catch {}
    if (!documentUrl) {
      const idInput = doc.querySelector('input[name="tenderID"]');
      if (idInput?.value) {
        documentUrl = `${baseOrigin}/ireps/etender/document/tenderDocument.do?etID=${idInput.value}`;
      } else {
        documentUrl = baseUrl;
      }
    }
    documentsList.push({ url: documentUrl, filename: `Tender_Document_${Date.now()}.pdf`, text: button.textContent.trim() });
  });

  const railwayLinks = doc.querySelectorAll('a[href="#"][onclick*="window.open"][onclick*=".pdf"]');
  railwayLinks.forEach(link => {
    const onclick = link.getAttribute('onclick');
    const match = onclick.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)/i);
    if (match?.[1]) {
      let pdfUrl = match[1];
      if (pdfUrl.startsWith('/')) pdfUrl = baseOrigin + pdfUrl;
      const fontEl = link.querySelector('font');
      const filename = fontEl?.textContent.trim().endsWith('.pdf') ? fontEl.textContent.trim() : pdfUrl.split('/').pop();
      documentsList.push({ url: pdfUrl, filename, text: link.textContent.trim() || filename });
    }
  });

  const railwayFonts = doc.querySelectorAll('font[color="#0033FF"][title="Railway document"], font[title="Railway document"]');
  railwayFonts.forEach(fontEl => {
    const parent = fontEl.closest('a[onclick*="window.open"]');
    if (parent) {
      const onclick = parent.getAttribute('onclick');
      const match = onclick.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)/i);
      if (match?.[1]) {
        let pdfUrl = match[1];
        if (pdfUrl.startsWith('/')) pdfUrl = baseOrigin + pdfUrl;
        const filename = fontEl.textContent.trim();
        documentsList.push({ url: pdfUrl, filename, text: filename });
      }
    }
  });

  const generic = doc.querySelectorAll('[onclick*="window.open"][onclick*=".pdf"]');
  generic.forEach(el => {
    if (el.matches('a[href="#"]') || el.querySelector('font[color="#0033FF"]')) return;
    const onclick = el.getAttribute('onclick');
    const match = onclick.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)/i);
    if (match?.[1]) {
      let pdfUrl = match[1];
      if (pdfUrl.startsWith('/')) pdfUrl = baseOrigin + pdfUrl;
      const filename = pdfUrl.split('/').pop();
      documentsList.push({ url: pdfUrl, filename, text: el.textContent.trim() || filename });
    }
  });

  const unique = [];
  const seen = new Set();
  documentsList.forEach(d => {
    if (!seen.has(d.url)) {
      seen.add(d.url);
      unique.push(d);
    }
  });

  return unique;
}