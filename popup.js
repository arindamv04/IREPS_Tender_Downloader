document.addEventListener('DOMContentLoaded', function() {
  const downloadBtn = document.getElementById('downloadBtn');
  const status = document.getElementById('status');
  const loading = document.getElementById('loading');
  const documentList = document.createElement('div');
  documentList.id = 'documentList';
  status.parentNode.insertBefore(documentList, status);

  downloadBtn.addEventListener('click', async function() {
    // Show loading indicator
    loading.style.display = 'block';
    status.textContent = '';
    documentList.innerHTML = '';
    downloadBtn.disabled = true;

    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Handle PDF pages directly
      if (tab.url.toLowerCase().includes('.pdf')) {
        handlePdfPage(tab);
        return;
      }
      
      // First, check if this is a PDF page that Chrome can't inject scripts into
      if (tab.url.toLowerCase().includes('.pdf') || 
          tab.url.toLowerCase().includes('viewnitpdf') ||
          tab.url.toLowerCase().includes('viewdocument') ||
          tab.url.toLowerCase().match(/\d+\.pdf/i)) {
        console.log('Direct PDF document detected');
        handlePdfPage(tab);
        return;
      }
      
      console.log('Attempting to find documents on page:', tab.url);
      
      // Execute content script to find all downloadable links
      chrome.tabs.sendMessage(tab.id, { action: "findDocuments" }, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Error communicating with page:', chrome.runtime.lastError);
          
          // Try to inject the content script first, then retry
          console.log('Attempting to inject content script...');
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            console.log('Content script injected, retrying...');
            // Retry sending the message
            chrome.tabs.sendMessage(tab.id, { action: "findDocuments" }, handleDocumentsResponse);
          }).catch((err) => {
            console.error('Failed to inject content script:', err);
            // If script injection fails, display error
            status.textContent = "Error: Could not communicate with page. Please make sure you're on a web page and refresh.";
            loading.style.display = 'none';
            downloadBtn.disabled = false;
          });
          return;
        }

        handleDocumentsResponse(response);
      });
    } catch (error) {
      loading.style.display = 'none';
      downloadBtn.disabled = false;
      status.textContent = "An error occurred: " + error.message;
    }
  });
  
  // Handler for PDF pages or direct document URLs
  function handlePdfPage(tab) {
    const pdfUrl = tab.url;
    const filename = extractFilenameFromUrl(pdfUrl);
    
    const documents = [{
      url: pdfUrl,
      filename: filename,
      text: "Current document"
    }];
    
    // Show found documents before downloading
    status.textContent = `Found current PDF document. Starting download...`;
    
    // Display document
    documentList.innerHTML = '<h3>Documents found:</h3><ul style="max-height: 200px; overflow-y: auto; text-align: left; font-size: 12px;">' + 
      `<li><strong>${filename}</strong><br>
       <small>${pdfUrl.substring(0, 50)}${pdfUrl.length > 50 ? '...' : ''}</small></li>` + '</ul>';
    
    // Send to background script for downloading
    chrome.runtime.sendMessage({
      action: "downloadDocuments",
      documents: documents,
      pageTitle: tab.title
    }, function(downloadResponse) {
      loading.style.display = 'none';
      downloadBtn.disabled = false;
      
      if (downloadResponse && downloadResponse.success) {
        status.textContent = `Downloaded PDF document to folder: ${downloadResponse.folderName}`;
      } else {
        status.textContent = "Failed to download document. Please try again.";
      }
    });
  }
  
  // Extract filename from URL
  function extractFilenameFromUrl(url) {
    try {
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
      
      // Make sure PDF files have .pdf extension
      if (!filename.toLowerCase().endsWith('.pdf') && 
          (url.toLowerCase().includes('pdf') || url.toLowerCase().includes('viewnitpdf'))) {
        filename += '.pdf';
      }
      
      return filename;
    } catch (e) {
      return `tender_document_${Date.now()}.pdf`;
    }
  }
  
  // Handle the response from finding documents
  function handleDocumentsResponse(response) {
    if (!response || !response.documents || response.documents.length === 0) {
      status.textContent = "No downloadable documents found on this page.";
      loading.style.display = 'none';
      downloadBtn.disabled = false;
      return;
    }

    // Show found documents before downloading
    status.textContent = `Found ${response.documents.length} documents. Starting download...`;
    
    // Display document list for debugging
    documentList.innerHTML = '<h3>Documents found:</h3><ul style="max-height: 200px; overflow-y: auto; text-align: left; font-size: 12px;">' + 
      response.documents.map(doc => 
        `<li><strong>${doc.filename || 'Unnamed document'}</strong><br>
         <small>${doc.url.substring(0, 50)}${doc.url.length > 50 ? '...' : ''}</small></li>`
      ).join('') + '</ul>';

    // Send documents to background script for downloading
    chrome.runtime.sendMessage({
      action: "downloadDocuments",
      documents: response.documents,
      pageTitle: document.title
    }, function(downloadResponse) {
      loading.style.display = 'none';
      downloadBtn.disabled = false;
      
      if (downloadResponse && downloadResponse.success) {
        status.textContent = `Downloaded ${downloadResponse.count} documents to folder: ${downloadResponse.folderName}`;
      } else {
        status.textContent = "Failed to download documents. Please try again.";
      }
    });
  }
});
