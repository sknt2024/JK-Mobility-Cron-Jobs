# Tyre Tubbing Mapping Master Sync Controller Documentation

## Overview
The `tyre_tubbing_mapping_master.controller.js` file handles the synchronization of tyre-tube mapping data from SAP into the local MongoDB database. It processes products with Flag 'F' and creates relationships between tyres and their compatible tubes/flaps.

## Key Logic Flow

### 1. Product Fetching
- Queries local database for products with `Flag: "F"`
- Retrieves only necessary fields: `_id`, `materialNo`, `productType`, `Musthave`

### 2. Material Number Transformation
For each product, transforms the material number based on the first character:
- `R` → `1` (e.g., R123456 becomes 1123456)
- `P` → `2` (e.g., P123456 becomes 2123456)
- `Q` → `3` (e.g., Q123456 becomes 3123456)

This transformation is required to match SAP's internal material numbering system.

### 3. SAP Fleet Mapping Lookup

#### a. API Call
- Endpoint: `/ZODATA_FLEET_MAPPING_SRV/ZFLEET_HDRSet?$filter=Matnr eq '{modifiedMaterialNo}'`
- Fetches fleet mapping data for the transformed material number
- Returns compatible tube/flap material numbers

#### b. Related Product Lookup
For each mapping result:
- Searches for the related product using `MatnrTf` (tube/flap material number)
- If found, checks if it's already in the product's `Musthave` array

### 4. Variant Linking

#### a. Duplicate Check
- Checks if the variant is already linked in the `Musthave` array
- Compares ObjectIds to avoid duplicate entries

#### b. Update Operation
If the variant is not already linked:
- Uses `$addToSet` to add the variant to the `Musthave` array
- Ensures no duplicate entries even if the operation runs multiple times
- Links products by their ObjectId references

### 5. Error Handling
- **Product-Level**: If an error occurs while processing a specific product, it logs the error and continues with the next product
- **Job-Level**: If a critical error occurs, the `SyncLog` is updated with status `"failed"` and the error message

### 6. Completion
- Updates `SyncLog` with status `"successful"` and metadata including:
  - Total products processed
  - Number of products updated with new mappings
  - Number of products skipped (no SAP data found)
- Logs summary of the sync operation

## Business Logic

### Material Number Prefixes
- **R/1**: Radial tyres
- **P/2**: Tubes
- **Q/3**: Flaps

### Musthave Array
The `Musthave` array stores compatible variants for each product:
- For a tyre: contains compatible tubes and flaps
- Each entry contains a reference to the related product's ObjectId
- Used for product recommendations and compatibility checks

## Dependencies
- **Models**: `sync_log.model.js`, `product.model.js`
- **External**: `axios` for HTTP requests, `http` and `https` for connection pooling

## Environment Variables
- `SAP_API_URL`: Base URL for SAP API
- `SAP_USERNAME`: SAP authentication username
- `SAP_PASSWORD`: SAP authentication password
- `SAP_REQUEST_TIMEOUT_MS`: Request timeout in milliseconds (default: 45000)
- `SAP_RETRIES`: Number of retry attempts (default: 3)
- `SAP_BACKOFF_INITIAL_MS`: Initial backoff delay in milliseconds (default: 1000)
