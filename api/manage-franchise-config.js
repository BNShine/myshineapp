// api/manage-franchise-config.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_FRANCHISE_CONFIG } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SPREADSHEET_ID = process.env.SHEET_ID;
const parseBoolean = (value) => { return (value === true || String(value).toUpperCase() === 'TRUE' || value === 1 || value === '1'); };
const formatBoolean = (value) => parseBoolean(value) ? 'TRUE' : 'FALSE';
const feeItemToColumnMap = { "Royalty Fee": "IncludeRoyalty", "Marketing Fee": "IncludeMarketing", "Software Fee": "IncludeSoftware", "Call Center Fee": "IncludeCallCenter", "Call Center Fee Extra": "IncludeCallCenterExtra" };
const columnToFeeItemMap = Object.fromEntries(Object.entries(feeItemToColumnMap).map(([key, value]) => [value, key]));

export default async function handler(req, res) {
    const logPrefix = `[API ${req.method} ${new Date().toISOString()}]`;
    console.log(`${logPrefix} Received request.`);

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        console.log(`${logPrefix} Attempting doc.loadInfo() for ID: ${SPREADSHEET_ID}...`);
        await doc.loadInfo();
        console.log(`${logPrefix} doc.loadInfo() completed.`);

        // *** CRITICAL CHECK ***
        if (!doc.title) {
             console.error(`${logPrefix} CRITICAL: doc.loadInfo() seems to have failed silently - doc.title is missing. Check credentials and sheet access.`);
             // Throw an error that clearly indicates the loadInfo failure
             throw new Error('Failed to load spreadsheet information. Check credentials/permissions.');
        }
        // Check if sheetTitles is available before logging
        const sheetTitles = doc.sheetTitles || []; // Use empty array as fallback
        console.log(`${logPrefix} Spreadsheet loaded: "${doc.title}". Available sheets: ${sheetTitles.join(', ')}`);


        let sheet = doc.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];
        const expectedHeaders = ['FranchiseName', ...Object.values(feeItemToColumnMap)];

        if (!sheet) {
            if (req.method === 'GET') {
                console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Returning [] for GET.`);
                return res.status(200).json([]);
            }
            console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Attempting creation...`);
             try {
                 sheet = await doc.addSheet({ title: SHEET_NAME_FRANCHISE_CONFIG, headerValues: expectedHeaders });
                 console.log(`${logPrefix} Sheet created successfully.`);
             } catch (creationError) {
                  console.error(`${logPrefix} FAILED to create sheet:`, creationError);
                  // Give a specific error related to sheet creation
                  throw new Error(`Failed to create required sheet '${SHEET_NAME_FRANCHISE_CONFIG}': ${creationError.message}`);
             }
        } else {
            console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" found. Loading headers...`);
            await sheet.loadHeaderRow();
            const currentHeaders = sheet.headerValues || []; // Fallback
            console.log(`${logPrefix} Existing headers: ${currentHeaders.join(', ')}`);
             if (JSON.stringify(currentHeaders) !== JSON.stringify(expectedHeaders)) {
                 console.warn(`${logPrefix} Headers mismatch! Correcting...`);
                 try {
                     await sheet.clear(); await sheet.setHeaderRow(expectedHeaders);
                     await sheet.resize({ rowCount: 1, columnCount: expectedHeaders.length });
                     await sheet.loadHeaderRow(); // Reload
                     console.log(`${logPrefix} Headers corrected.`);
                 } catch (headerError) {
                      console.error(`${logPrefix} FAILED to correct headers:`, headerError);
                      throw new Error(`Failed to correct sheet headers: ${headerError.message}`);
                 }
             } else {
                 console.log(`${logPrefix} Headers OK.`);
             }
        }

        // --- GET ---
        if (req.method === 'GET') {
            console.log(`${logPrefix} Processing GET... Loading header row again (safe)...`);
            await sheet.loadHeaderRow(); // Ensure headers loaded
            console.log(`${logPrefix} Fetching rows...`);
            const rows = await sheet.getRows();
            console.log(`${logPrefix} Fetched ${rows.length} rows.`);
            const configs = rows.map(row => { /* ... mapping ... */
                 const config = { franchiseName: row.get('FranchiseName') };
                 Object.values(feeItemToColumnMap).forEach(colName => {
                     config[colName] = parseBoolean(row.get(colName));
                 });
                 return config.franchiseName ? config : null;
            }).filter(Boolean);
            console.log(`${logPrefix} Parsed ${configs.length} configs. Sending response.`);
            return res.status(200).json(configs);
        }

        // --- POST / PUT / DELETE (Add logs similarly if needed) ---
         if (req.method === 'POST') {
             console.log(`${logPrefix} Processing POST... Body:`, req.body);
             // ... (rest of POST logic) ...
             await sheet.loadHeaderRow(); const rows = await sheet.getRows(); /*...*/
             console.log(`${logPrefix} POST successful. Sending response.`);
             return res.status(201).json({ success: true, message: 'Franchise configuration added successfully.', config: addedConfig });
         }
         if (req.method === 'PUT') {
              console.log(`${logPrefix} Processing PUT... Body:`, req.body);
              // ... (rest of PUT logic) ...
              await sheet.loadHeaderRow(); const rows = await sheet.getRows(); /*...*/
              console.log(`${logPrefix} PUT successful. Sending response.`);
              return res.status(200).json({ success: true, message: 'Franchise configuration updated successfully.', config: updatedConfig });
         }
          if (req.method === 'DELETE') {
               console.log(`${logPrefix} Processing DELETE... Body:`, req.body);
               // ... (rest of DELETE logic) ...
               await sheet.loadHeaderRow(); const rows = await sheet.getRows(); /*...*/
               console.log(`${logPrefix} DELETE successful. Sending response.`);
               return res.status(200).json({ success: true, message: `Franchise "${franchiseName}" configuration deleted successfully.` });
          }


        console.log(`${logPrefix} Method ${req.method} not allowed.`);
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error(`${logPrefix} CRITICAL ERROR:`, error); // Log the full error server-side

        // Determine client-friendly message
        let clientErrorMessage = 'An internal server error occurred while managing franchise configurations.';
        if (error.message) {
            if (error.message.includes('permission denied') || error.message.includes('403')) {
                clientErrorMessage = 'Permission denied accessing Google Sheet. Check service account permissions and sheet sharing settings.';
            } else if (error.message.includes('Failed to load spreadsheet information')) {
                clientErrorMessage = error.message; // Use the specific error thrown after loadInfo check
            } else if (error.message.includes('Requested entity was not found') || error.message.includes('404')) {
                clientErrorMessage = `Spreadsheet not found (ID: ${SPREADSHEET_ID}). Verify SHEET_ID variable.`;
            } else if (error.message.includes('sheet headers') || error.message.includes('sheet creation')) {
                clientErrorMessage = `Error processing sheet structure: ${error.message}`; // More specific structure errors
            }
             // Keep the generic message for other unexpected errors
        }

        return res.status(500).json({ success: false, message: clientErrorMessage });
    }
}
