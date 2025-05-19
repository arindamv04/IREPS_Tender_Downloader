// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "downloadDocuments") {
    downloadAllDocuments(request.documents, request.pageTitle, sendResponse);
    return true; // Indicates we want to send a response asynchronously
  }
});

async function downloadAllDocuments(documents, pageTitle, sendResponse) {
  try {
    // Create timestamped folder name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedTitle = (pageTitle || "Tender").replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const folderName = `${sanitizedTitle}_${timestamp}`;
    
    // Keep track of download progress
    let successCount = 0;
    let failCount = 0;
    
    // Process each document for download
    for (const doc of documents) {
      try {
        // Extract filename from URL or use a default one
        let filename = doc.filename || getFilenameFromUrl(doc.url);
        
        // Make sure filename is safe and not too long
        filename = sanitizeFilename(filename);
        
        // Make sure the URL is properly formed
        let downloadUrl = doc.url;
        
        // Fix URLs that might be relative or missing the origin
        if (downloadUrl.startsWith('/')) {
          // Extract origin from the tab URL if available
          if (sender && sender.tab && sender.tab.url) {
            const tabUrl = new URL(sender.tab.url);
            downloadUrl = tabUrl.origin + downloadUrl;
          }
        }
        
        // For window.open URLs in onclick handlers that might need the origin
        if (!downloadUrl.startsWith('http') && !downloadUrl.startsWith('https') && 
            !downloadUrl.startsWith('data:') && !downloadUrl.startsWith('blob:')) {
          if (sender && sender.tab && sender.tab.url) {
            const tabUrl = new URL(sender.tab.url);
            downloadUrl = tabUrl.origin + (downloadUrl.startsWith('/') ? '' : '/') + downloadUrl;
          }
        }
        
        console.log("Downloading from URL:", downloadUrl);
        
        // Download the file using Chrome's download API
        await chrome.downloads.download({
          url: downloadUrl,
          filename: `${folderName}/${filename}`,
          saveAs: false,
          conflictAction: 'uniquify'
        });
        
        successCount++;
      } catch (err) {
        console.error(`Failed to download ${doc.url}:`, err);
        failCount++;
      }
    }
    
    // Send response back to popup
    sendResponse({
      success: true,
      count: successCount,
      failed: failCount,
      folderName: folderName
    });
  } catch (error) {
    console.error("Error in downloadAllDocuments:", error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

function getFilenameFromUrl(url) {
  try {
    // Try to extract filename from URL
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/');
    let filename = pathSegments[pathSegments.length - 1];
    
    // If no filename found or it's empty, use a default name
    if (!filename || filename === '') {
      filename = `document_${Date.now()}.pdf`;
    }
    
    // If there's a query string, remove it unless it contains relevant file info
    if (filename.includes('?')) {
      // Keep query string for dynamic documents where it might contain the actual document ID
      if (!filename.includes('.pdf') && !filename.includes('.doc') && !filename.includes('.xls')) {
        filename = `${filename.split('?')[0]}.pdf`;
      }
    }
    
    return filename;
  } catch (e) {
    // Default filename if parsing fails
    return `tender_document_${Date.now()}.pdf`;
  }
}

function sanitizeFilename(filename) {
  // Replace illegal characters
  let sanitized = filename.replace(/[/\\?%*:|"<>]/g, '_');
  
  // Ensure filename isn't too long (Windows has 260 char path limit)
  if (sanitized.length > 100) {
    const extension = sanitized.includes('.') ? 
      sanitized.substring(sanitized.lastIndexOf('.')) : '';
    sanitized = sanitized.substring(0, 100 - extension.length) + extension;
  }
  
  return sanitized;
}
