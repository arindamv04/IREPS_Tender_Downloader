# Tender Documents Downloader

A Chrome extension specifically optimized for government tender portals to efficiently download and organize tender documents.

## Overview

The Tender Documents Downloader is designed to streamline the procurement process by automatically downloading all tender documents with a single click and organizing them into timestamped folders. The extension is particularly optimized for the Indian Railway Electronic Procurement System (IREPS) but works with many other tender portals.

## Problem Solved

Government procurement portals present several unique challenges:

- **Time-Critical Access**: User sessions on government portals typically expire after short periods of inactivity (often 15-30 minutes)
- **Login Restrictions**: Many portals limit users to one login per hour, adding pressure to maximize productivity during each session
- **Document Volume**: Each tender contains between 2-20 supporting documents that must be downloaded individually
- **Manual Organization**: Traditional download methods require tedious individual file management and folder creation

## Key Features

- **One-Click Download**: Captures all tender documents on a page with a single button press
- **Automatic Organization**: Creates a timestamped folder named after the tender for proper document management
- **IREPS Optimization**: Special handling for IREPS document structure and various document access patterns
- **Robust Link Detection**: Identifies downloadable documents through multiple detection methods:
  - Direct download links
  - "Download Tender Doc" buttons 
  - Railway document links with window.open handlers
  - PDF links with specific styling patterns
- **Relative URL Handling**: Automatically resolves relative URLs to their full paths

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the extension directory

## Usage

1. Navigate to a tender page containing downloadable documents
2. Click on the extension icon in your toolbar
3. Press the "Download All Documents" button
4. All documents will be downloaded to a timestamped folder in your Downloads directory
5. Move to the next tender page and repeat the process

## Supported Document Types

The extension detects and downloads:
- PDF files
- Word documents (.doc, .docx)
- Excel spreadsheets (.xls, .xlsx)
- Various other document formats commonly used in tenders

## Benefits

- **Time Efficiency**: Reduces document collection from several minutes to seconds per tender
- **Session Maximization**: Process more tenders within limited login windows
- **Automatic Organization**: Eliminates manual folder creation and file sorting
- **Consistency**: Ensures all documents are captured without missing files

## Troubleshooting

If documents aren't being detected:
1. Make sure you're on a tender page with downloadable documents
2. Try refreshing the page before clicking the extension button
3. For IREPS-specific issues, check if you're logged in properly

## License

MIT License - Feel free to modify and use for your procurement needs
