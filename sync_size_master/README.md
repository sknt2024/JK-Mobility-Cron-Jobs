# Size Master Sync Controller Documentation

## Overview
The `size_master.controller.js` file handles the synchronization of size master data from SAP into the local MongoDB database. It performs a dual update: syncing size master records and updating product tyre sizes based on the size mappings.

## Key Logic Flow

### 1. SAP Data Fetching
- Endpoint: `/ZAWS_JKCONNECT_SRV/SizeMstSet`
- Fetches all size master records from SAP
- Each record contains size code, description, and category mapping

### 2. Parallel Update Operations

For each size record from SAP, the system performs two operations in parallel:

#### a. Size Master Collection Update
- Updates the `ZAWS_JC_SRV_SIZE_MST` collection
- Uses `findOneAndUpdate` with `upsert: true`
- Search key: `ZsizeCd` (size code)
- Updated fields:
  - `ZsizeCd`: Size code (`ZsizeCd`)
  - `Ydesc`: Size description (`Desc1`)
  - `CatCode`: Category code (`CatCode`)

#### b. Product Collection Update
- Updates all products matching the size code and category
- Uses `updateMany` to update multiple products at once
- Filter criteria:
  - `prodSize` matches `ZsizeCd`
  - `Catcode` matches `CatCode`
- Updated field:
  - `tyreSize`: Trimmed size description (`Desc1.trim()`)

### 3. Batch Processing
- All update operations are queued as promises
- Uses `Promise.all()` to execute all operations in parallel
- Provides significant performance improvement for large datasets

### 4. Result Tracking
- Counts the number of products updated
- Extracts `modifiedCount` from product update results
- Logs detailed statistics about the sync operation

### 5. Error Handling
- **Job-Level**: If a critical error occurs, the `SyncLog` is updated with status `"failed"` and the error message
- Uses retry logic with exponential backoff for SAP API calls

### 6. Completion
- Updates `SyncLog` with status `"successful"` and metadata including:
  - Total sizes processed
  - Number of products updated
- Logs summary of the sync operation

## Business Logic

### Size-Product Relationship
- Products are linked to sizes via `prodSize` code
- Size descriptions are stored in both:
  - Size master collection (reference data)
  - Product collection (denormalized for performance)
- Category code ensures correct size mapping for different product types

### Data Synchronization
- Size master acts as the source of truth
- Product `tyreSize` fields are updated to match current size descriptions
- Ensures consistency across the system

## Dependencies
- **Models**: `sync_log.model.js`, `size_master.model.js`, `product.model.js`
- **External**: `axios` for HTTP requests, `http` and `https` for connection pooling

## Environment Variables
- `SAP_API_URL`: Base URL for SAP API
- `SAP_USERNAME`: SAP authentication username
- `SAP_PASSWORD`: SAP authentication password
- `SAP_REQUEST_TIMEOUT_MS`: Request timeout in milliseconds (default: 45000)
- `SAP_RETRIES`: Number of retry attempts (default: 3)
- `SAP_BACKOFF_INITIAL_MS`: Initial backoff delay in milliseconds (default: 1000)
