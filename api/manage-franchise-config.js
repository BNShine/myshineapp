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

const parseBoolean = (value) => (value === true || String(value).toUpperCase() === 'TRUE' || value === 1 || value === '1');
const formatBoolean = (value) => parseBoolean(value) ? 'TRUE' : 'FALSE';
const parseNumber = (value, defaultValue = 0) => {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
};
const parseIntStrict = (value, defaultValue = 0) => {
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
};

const feeItemToColumnMap = {
    "Royalty Fee": "IncludeRoyalty", "Marketing Fee": "IncludeMarketing",
    "Software Fee": "IncludeSoftware", "Call Center Fee": "IncludeCallCenter",
    "Call Center Fee Extra": "IncludeCallCenterExtra"
};
const columnToFeeItemMap = Object.fromEntries(Object.entries(feeItemToColumnMap).map(([key, value]) => [value, key]));

const getDefaultServiceRules = () => ([
    { id: 'dog_small', keyword: 'Dog Cleaning - Small', threshold: 170, adjusted: 180, enabled: true },
    { id: 'dental_small', keyword: 'Dental Under 40 LBS', threshold: 170, adjusted: 180, enabled: true },
    { id: 'dog_medium', keyword: 'Dog Cleaning - Medium', threshold: 200, adjusted: 210, enabled: true },
    { id: 'dog_max', keyword: 'Dog Cleaning - Max', threshold: 230, adjusted: 240, enabled: true },
    { id: 'dog_ultra', keyword: 'Dog Cleaning - Ultra', threshold: 260, adjusted: 270, enabled: true },
    { id: 'cat_cleaning', keyword: 'Cat Cleaning', threshold: 200, adjusted: 210, enabled: true },
    { id: 'nail_clipping', keyword: 'Nail Clipping', threshold: 0, adjusted: 10, enabled: true }
]);

const defaultRatesAndFees = {
    royaltyRate: 6.0,
    marketingRate: 1.0,
    softwareFeeValue: 350.00,
    callCenterFeeValue: 1200.00,
    callCenterExtraFeeValue: 600.00,
    extraVehicles: 0,
    customFeesConfig: [],
    hasLoan: false,
    loanInstallment: 0,
    loanValue: 0
};

export default async function handler(request, response) { // Changed req, res to request, response
    const logPrefix = `[API ${request.method} ${new Date().toISOString()}]`;
    console.log(`${logPrefix} Received request for /api/manage-franchise-config.`);

    const document = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth); // Changed doc to document

    try {
        await document.loadInfo();
        if (!document.title) {
             throw new Error('Failed to load spreadsheet information. Verify Service Account credentials and Sheet permissions.');
        }
        const sheetTitles = document.sheetTitles || [];
        console.log(`${logPrefix} Spreadsheet loaded: "${document.title}". Available sheets: ${sheetTitles.join(', ')}`);

        let sheet = document.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];
        const expectedHeaders = [
            'FranchiseName', ...Object.values(feeItemToColumnMap),
            'RoyaltyRate', 'MarketingRate', 'SoftwareFeeValue', 'CallCenterFeeValue',
            'CallCenterExtraFeeValue', 'ExtraVehicles',
            'HasLoan', 'LoanInstallment', 'LoanValue',
            'CustomFeesConfig',
            'ServiceValueRules'
        ];

        if (!sheet) {
            if (request.method === 'GET') {
                console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Returning [] for GET.`);
                return response.status(200).json([]);
            }
             console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Attempting to create...`);
             try {
                 sheet = await document.addSheet({ title: SHEET_NAME_FRANCHISE_CONFIG, headerValues: expectedHeaders });
                 console.log(`${logPrefix} Sheet created successfully.`);
             } catch (creationError) {
                  console.error(`${logPrefix} FAILED to create sheet:`, creationError);
                  throw new Error(`Failed to create necessary sheet '${SHEET_NAME_FRANCHISE_CONFIG}': ${creationError.message}`);
             }
        } else {
            console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" found. Verifying headers...`);
            await sheet.loadHeaderRow();
            const currentHeaders = sheet.headerValues || [];
            console.log(`${logPrefix} Existing headers: ${currentHeaders.join(', ')}`);
            let headersOk = expectedHeaders.every(header => currentHeaders.includes(header));
             if (!headersOk || currentHeaders.length < expectedHeaders.length) {
                 console.warn(`${logPrefix} Headers mismatch or incomplete! Attempting to add missing headers...`);
                 const missingHeaders = expectedHeaders.filter(header => !currentHeaders.includes(header));
                 if (missingHeaders.length > 0) {
                     try {
                         const updatedHeaders = [...currentHeaders, ...missingHeaders];
                         await sheet.setHeaderRow(updatedHeaders);
                         await sheet.loadHeaderRow();
                         console.log(`${logPrefix} Added missing headers. New headers: ${sheet.headerValues.join(', ')}`);
                     } catch (headerError) {
                          console.error(`${logPrefix} FAILED to add missing headers:`, headerError);
                          console.warn(`${logPrefix} Proceeding with potentially incomplete headers.`);
                     }
                 }
             } else {
                 console.log(`${logPrefix} Headers OK.`);
             }
        }

        if (request.method === 'GET') {
            await sheet.loadHeaderRow();
            const rows = await sheet.getRows();
            const configurations = rows.map(row => { // Changed configs to configurations
                const configData = { // Changed config to configData
                    franchiseName: row.get('FranchiseName'),
                    royaltyRate: parseNumber(row.get('RoyaltyRate'), defaultRatesAndFees.royaltyRate),
                    marketingRate: parseNumber(row.get('MarketingRate'), defaultRatesAndFees.marketingRate),
                    softwareFeeValue: parseNumber(row.get('SoftwareFeeValue'), defaultRatesAndFees.softwareFeeValue),
                    callCenterFeeValue: parseNumber(row.get('CallCenterFeeValue'), defaultRatesAndFees.callCenterFeeValue),
                    callCenterExtraFeeValue: parseNumber(row.get('CallCenterExtraFeeValue'), defaultRatesAndFees.callCenterExtraFeeValue),
                    extraVehicles: parseIntStrict(row.get('ExtraVehicles'), defaultRatesAndFees.extraVehicles),
                    hasLoan: parseBoolean(row.get('HasLoan')),
                    loanInstallment: parseIntStrict(row.get('LoanInstallment'), defaultRatesAndFees.loanInstallment),
                    loanValue: parseNumber(row.get('LoanValue'), defaultRatesAndFees.loanValue)
                };
                Object.values(feeItemToColumnMap).forEach(colName => { configData[colName] = parseBoolean(row.get(colName)); });

                let rules = getDefaultServiceRules();
                const rulesJsonString = row.get('ServiceValueRules');
                if (rulesJsonString) { try { const parsed = JSON.parse(rulesJsonString); if (Array.isArray(parsed)) rules = parsed; } catch (e) { console.warn(`Invalid Service Rules JSON for ${configData.franchiseName}`); } }
                configData.serviceValueRules = rules;

                let customFees = [];
                const customFeesJsonString = row.get('CustomFeesConfig');
                if (customFeesJsonString) { try { const parsed = JSON.parse(customFeesJsonString); if (Array.isArray(parsed)) customFees = parsed; } catch (e) { console.warn(`Invalid Custom Fees JSON for ${configData.franchiseName}`); } }
                configData.customFeesConfig = customFees;

                return configData.franchiseName ? configData : null;
            }).filter(Boolean);
            console.log(`${logPrefix} Sending ${configurations.length} configurations.`);
            return response.status(200).json(configurations);
        }

        if (request.method === 'POST') {
            const { franchiseName, includedFees, serviceValueRules, royaltyRate, marketingRate,
                    softwareFeeValue, callCenterFeeValue, callCenterExtraFeeValue, extraVehicles,
                    hasLoan, loanInstallment, loanValue, customFeesConfig } = request.body;

            if (!franchiseName || !includedFees || !Array.isArray(serviceValueRules) || !Array.isArray(customFeesConfig)) {
                 return response.status(400).json({ success: false, message: 'Bad Request: Missing fields or invalid format.' });
            }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const existing = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (existing) { return response.status(409).json({ success: false, message: `Conflict: Franchise exists.` }); }

            const newRowData = {
                FranchiseName: franchiseName.trim(),
                RoyaltyRate: parseNumber(royaltyRate, defaultRatesAndFees.royaltyRate),
                MarketingRate: parseNumber(marketingRate, defaultRatesAndFees.marketingRate),
                SoftwareFeeValue: parseNumber(softwareFeeValue, defaultRatesAndFees.softwareFeeValue),
                CallCenterFeeValue: parseNumber(callCenterFeeValue, defaultRatesAndFees.callCenterFeeValue),
                CallCenterExtraFeeValue: parseNumber(callCenterExtraFeeValue, defaultRatesAndFees.callCenterExtraFeeValue),
                ExtraVehicles: parseIntStrict(extraVehicles, defaultRatesAndFees.extraVehicles),
                HasLoan: formatBoolean(hasLoan),
                LoanInstallment: parseIntStrict(loanInstallment, defaultRatesAndFees.loanInstallment),
                LoanValue: parseNumber(loanValue, defaultRatesAndFees.loanValue)
            };
            Object.keys(feeItemToColumnMap).forEach(item => { newRowData[feeItemToColumnMap[item]] = formatBoolean(includedFees[item]); });
            try {
                newRowData['ServiceValueRules'] = JSON.stringify(serviceValueRules);
                newRowData['CustomFeesConfig'] = JSON.stringify(customFeesConfig);
            } catch (e) { return response.status(500).json({ success: false, message: 'Internal Error: Could not process config data.' }); }

            const addedRowGSheet = await sheet.addRow(newRowData);
            await sheet.loadHeaderRow();
            const addedConfigData = { // Changed addedConfig to addedConfigData
                 franchiseName: addedRowGSheet.get('FranchiseName'),
                 royaltyRate: parseNumber(addedRowGSheet.get('RoyaltyRate')),
                 marketingRate: parseNumber(addedRowGSheet.get('MarketingRate')),
                 softwareFeeValue: parseNumber(addedRowGSheet.get('SoftwareFeeValue')),
                 callCenterFeeValue: parseNumber(addedRowGSheet.get('CallCenterFeeValue')),
                 callCenterExtraFeeValue: parseNumber(addedRowGSheet.get('CallCenterExtraFeeValue')),
                 extraVehicles: parseIntStrict(addedRowGSheet.get('ExtraVehicles')),
                 hasLoan: parseBoolean(addedRowGSheet.get('HasLoan')),
                 loanInstallment: parseIntStrict(addedRowGSheet.get('LoanInstallment')),
                 loanValue: parseNumber(addedRowGSheet.get('LoanValue')),
                 serviceValueRules: serviceValueRules,
                 customFeesConfig: customFeesConfig
            };
            Object.values(feeItemToColumnMap).forEach(col => { addedConfigData[col] = parseBoolean(addedRowGSheet.get(col)); });
            console.log(`${logPrefix} Franchise added successfully.`);
            return response.status(201).json({ success: true, message: 'Franchise added.', config: addedConfigData });
        }

        if (request.method === 'PUT') {
            const { originalFranchiseName, newFranchiseName, includedFees, serviceValueRules,
                    royaltyRate, marketingRate, softwareFeeValue, callCenterFeeValue,
                    callCenterExtraFeeValue, extraVehicles,
                    hasLoan, loanInstallment, loanValue, customFeesConfig } = request.body;
             if (!originalFranchiseName || !newFranchiseName || !includedFees || !Array.isArray(serviceValueRules) || !Array.isArray(customFeesConfig)) {
                 return response.status(400).json({ success: false, message: 'Bad Request: Missing fields for update.' });
             }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const rowToUpdate = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === originalFranchiseName.trim().toLowerCase());
            if (!rowToUpdate) { return response.status(404).json({ success: false, message: `Not Found: Franchise "${originalFranchiseName}".` }); }
            const normalizedNewName = newFranchiseName.trim().toLowerCase();
            if (originalFranchiseName.trim().toLowerCase() !== normalizedNewName) {
                 const conflict = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === normalizedNewName && row.rowNumber !== rowToUpdate.rowNumber);
                 if (conflict) { return response.status(409).json({ success: false, message: `Conflict: Name "${newFranchiseName}" exists.` }); }
            }

            rowToUpdate.set('FranchiseName', newFranchiseName.trim());
            rowToUpdate.set('RoyaltyRate', parseNumber(royaltyRate, defaultRatesAndFees.royaltyRate));
            rowToUpdate.set('MarketingRate', parseNumber(marketingRate, defaultRatesAndFees.marketingRate));
            rowToUpdate.set('SoftwareFeeValue', parseNumber(softwareFeeValue, defaultRatesAndFees.softwareFeeValue));
            rowToUpdate.set('CallCenterFeeValue', parseNumber(callCenterFeeValue, defaultRatesAndFees.callCenterFeeValue));
            rowToUpdate.set('CallCenterExtraFeeValue', parseNumber(callCenterExtraFeeValue, defaultRatesAndFees.callCenterExtraFeeValue));
            rowToUpdate.set('ExtraVehicles', parseIntStrict(extraVehicles, defaultRatesAndFees.extraVehicles));
            rowToUpdate.set('HasLoan', formatBoolean(hasLoan));
            rowToUpdate.set('LoanInstallment', parseIntStrict(loanInstallment, defaultRatesAndFees.loanInstallment));
            rowToUpdate.set('LoanValue', parseNumber(loanValue, defaultRatesAndFees.loanValue));
            Object.keys(feeItemToColumnMap).forEach(item => { rowToUpdate.set(feeItemToColumnMap[item], formatBoolean(includedFees[item])); });
            try {
                rowToUpdate.set('ServiceValueRules', JSON.stringify(serviceValueRules));
                rowToUpdate.set('CustomFeesConfig', JSON.stringify(customFeesConfig));
             } catch (e) { return response.status(500).json({ success: false, message: 'Internal Error: Could not process config data for update.' }); }

            await rowToUpdate.save();
            await sheet.loadHeaderRow();
            const updatedConfigData = { // Changed updatedConfig to updatedConfigData
                 franchiseName: rowToUpdate.get('FranchiseName'),
                 royaltyRate: parseNumber(rowToUpdate.get('RoyaltyRate')),
                 marketingRate: parseNumber(rowToUpdate.get('MarketingRate')),
                 softwareFeeValue: parseNumber(rowToUpdate.get('SoftwareFeeValue')),
                 callCenterFeeValue: parseNumber(rowToUpdate.get('CallCenterFeeValue')),
                 callCenterExtraFeeValue: parseNumber(rowToUpdate.get('CallCenterExtraFeeValue')),
                 extraVehicles: parseIntStrict(rowToUpdate.get('ExtraVehicles')),
                 hasLoan: parseBoolean(rowToUpdate.get('HasLoan')),
                 loanInstallment: parseIntStrict(rowToUpdate.get('LoanInstallment')),
                 loanValue: parseNumber(rowToUpdate.get('LoanValue')),
                 serviceValueRules: serviceValueRules,
                 customFeesConfig: customFeesConfig
            };
            Object.values(feeItemToColumnMap).forEach(col => { updatedConfigData[col] = parseBoolean(rowToUpdate.get(col)); });
            console.log(`${logPrefix} Franchise updated successfully.`);
            return response.status(200).json({ success: true, message: 'Franchise updated.', config: updatedConfigData });
        }

        if (request.method === 'DELETE') {
            const { franchiseName } = request.body;
            if (!franchiseName) { return response.status(400).json({ success: false, message: 'Bad Request: Name required.' }); }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const rowToDelete = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (!rowToDelete) { return response.status(404).json({ success: false, message: `Not Found: Franchise "${franchiseName}".` }); }
            await rowToDelete.delete();
            console.log(`${logPrefix} Franchise deleted successfully.`);
            return response.status(200).json({ success: true, message: `Franchise deleted.` });
        }

        console.log(`${logPrefix} Method ${request.method} not allowed.`);
        response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);

    } catch (error) {
        console.error(`${logPrefix} CRITICAL ERROR:`, error);
        let clientErrorMessage = 'An internal server error occurred while managing franchise configurations.';
        // Corrected error message logic
        if (error.message) {
            if (error.message.includes('permission denied') || error.response?.status === 403) {
                clientErrorMessage = 'Permission Denied: Check Service Account permissions on the Google Sheet (requires Editor access) and ensure Google Sheets API is enabled.';
            } else if (error.message.includes('Failed to load spreadsheet information')) {
                clientErrorMessage = error.message;
            } else if (error.message.includes('Requested entity was not found') || error.response?.status === 404) {
                 clientErrorMessage = `Google Sheet or Tab "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Verify SHEET_ID and tab name.`;
            } else if (error.message.includes('sheet headers') || error.message.includes('sheet creation')) {
                 clientErrorMessage = `Error processing sheet structure: ${error.message}`;
            } else {
                  clientErrorMessage = error.message; // Use the actual error message if not recognized
            }
        }
        return response.status(500).json({ success: false, message: clientErrorMessage });
    }
}
