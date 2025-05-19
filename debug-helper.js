// Diagnostic script to help identify document links
function diagnoseTenderDocuments() {
  console.clear();
  console.log('======= IREPS DOCUMENT FINDER DIAGNOSTIC TOOL =======');
  console.log('Page:', document.title);
  console.log('URL:', window.location.href);
  
  // Part 1: Check for Download Tender Doc buttons
  const tenderDocButtons = document.querySelectorAll('div.styled-button-8[onclick*="downloadtenderDoc"], div[class*="styled-button"][onclick*="downloadtenderDoc"]');
  console.log(`Found ${tenderDocButtons.length} tender doc buttons`);
  tenderDocButtons.forEach((btn, i) => {
    console.log(`Tender button #${i+1}:`, btn.outerHTML);
  });
  
  // Part 2: Check for railway document links with window.open
  const railwayLinks = document.querySelectorAll('a[href="#"][onclick*="window.open"][onclick*=".pdf"]');
  console.log(`Found ${railwayLinks.length} railway document links`);
  railwayLinks.forEach((link, i) => {
    console.log(`Railway link #${i+1}:`, link.outerHTML);
    
    // Try to extract the URL
    const onclickAttr = link.getAttribute('onclick');
    const urlMatches = onclickAttr.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)['"].*?\)/i);
    if (urlMatches && urlMatches[1]) {
      const pdfUrl = urlMatches[1].startsWith('/') ? 
        window.location.origin + urlMatches[1] : urlMatches[1];
      console.log(`  URL: ${pdfUrl}`);
    }
  });
  
  // Part 3: Check for font elements with Railway document title
  const fontElements = document.querySelectorAll('font[color="#0033FF"][title="Railway document"], font[title="Railway document"], font[color="#0033FF"]');
  console.log(`Found ${fontElements.length} railway font elements`);
  fontElements.forEach((font, i) => {
    console.log(`Font element #${i+1}: ${font.textContent.trim()}`, font.outerHTML);
    
    // Check if inside a link with window.open
    const parentLink = font.closest('a[onclick*="window.open"]');
    if (parentLink) {
      console.log(`  Inside link:`, parentLink.outerHTML);
    }
  });
  
  // Part 4: DOM Structure - check for unique identifiers
  console.log('=== Document identifiers in page structure ===');
  // Check if there are any unique patterns in the DOM
  const docPatterns = [
    'document',
    'pdf',
    'tender',
    'download',
    'railway',
    'window.open',
    'styled-button'
  ];
  
  docPatterns.forEach(pattern => {
    const matchingElems = document.querySelectorAll(`*[id*="${pattern}"], *[class*="${pattern}"], *[onclick*="${pattern}"]`);
    console.log(`Elements matching "${pattern}": ${matchingElems.length}`);
  });
  
  // Part 5: Simulate what the extension would do
  const foundDocs = window.findDownloadableDocuments ? findDownloadableDocuments() : []; 
  console.log(`Extension would find ${foundDocs.length} documents`);
  console.table(foundDocs);
  
  return { 
    tenderDocButtons, 
    railwayLinks, 
    fontElements, 
    foundDocs 
  };
}

// Run the diagnostic
diagnoseTenderDocuments();