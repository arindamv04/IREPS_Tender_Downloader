// Listen for messages from popup.js
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "findDocuments") {
    console.log('Extension activated: searching for documents...');
    const documents = findDownloadableDocuments();
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