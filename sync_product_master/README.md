# Product Sync Controller Documentation

## Overview
The `product.controller.js` file handles the synchronization of product master data from an external SAP system into the local MongoDB database. It fetches data from a configured SAP endpoint, transforms it, and updates the local product records.

## Key Logic Flow

### 1. Initialization & Logging
- The sync process is triggered via the `syncProductMaster` function.
- It initializes a specific `eventCode` (defaults to `"sync_products"`).
- Creates an entry in the `SyncLog` collection to track the status of the execution.
- Creates an entry in the `SapLogger` collection to record the API interaction with SAP.

### 2. Data Fetching
- Connects to the SAP API using basic authentication credentials from environment variables (`SAP_API_URL`, `SAP_USERNAME`, `SAP_PASSWORD`).
- Endpoint: `/ZAWS_JKCONNECT_SRV/SKUMstSet`

### 3. Data Processing Loop
The system iterates through every record received from SAP:

#### a. Pattern Master Lookup
- For each product, it attempts to find a matching 'Pattern Master' record (`ZAWS_JC_SRV_PAT_MST`) using `CatCode` and `PatCode`.
- If not found, a warning is logged, but processing continues.

#### b. Product Transformation Rules
The SAP data is mapped to the local schema with specific business logic:

- **Product Type (`productType`)**: Determined by the first character of the Material Number (`Matnr`).
    - `1` or `R` → `tyre`
    - `P` or `2` → `tube`
    - `Q` or `3` → `flap`
    - Default → `tyre`
- **Construction Type (`Const`)**:
    - `1` → `BIAS`
    - `2` → `RADIAL`
- **Product Name Search**: A sanitized version of the `ProdTitle` with non-alphanumeric characters removed.
- **Tyre Pattern**: Derived from the linked `PatternMaster` record (`Ydesc`).

#### c. Database Update (Upsert)
- The system performs a `updateMany` (effectively used as a single upsert here since it matches by `materialNo`) operation on the `product` collection.
- **Upsert**: If the product exists, it updates; otherwise, it creates a new record.
- **Search Key**: `materialNo` (mapped from `Matnr`).

### 4. Error Handling
- **Record-Level**: If an error occurs while processing a specific product (e.g., validation fail), it is caught, logged with `logError`, and the loop continues to the next item.
- **Job-Level**: If the overall API call or critical setup fails, the entire process is caught. The `SyncLog` entry is updated with status `"failed"` and the error message.

### 5. Completion
- On successful completion of all records, the `SyncLog` status is updated to `"successful"`.

## Dependencies
- **Models**: `product.model.js`, `sap_logger.model.js`, `sync_log.model.js`, `ZAWS_JC_SRV_PAT_MST.js`
- **Utils**: `logger.js` (for structured logging).
- **External**: `axios` for HTTP requests.
