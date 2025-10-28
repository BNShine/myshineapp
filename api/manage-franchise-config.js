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

const parseBoolean = (value) => (value === true || String(value).toUpperCase() === 'TRUE' || value === 1 || value === '1');
const formatBoolean = (value) => parseBoolean(value) ? 'TRUE' : 'FALSE';
const parseNumber = (value, defaultValue = 0) => {
    const num = parseFloat(value);
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

// Valores padrão para as novas configurações
const defaultRatesAndFees = {
    royaltyRate: 6.0,
    marketingRate: 1.0,
    softwareFeeValue: 350.00,
    callCenterFeeValue: 1200.00,
    callCenterExtraFeeValue: 600.00,
    customFeeConfig: { name: "", type: "percentage", value: 0, enabled: false }
};

export default async function handler(req, res) {
    const logPrefix = `[API ${req.method} ${new Date().toISOString()}]`;
    console.log(`${logPrefix} Received request for /api/manage-franchise-config.`);

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        await doc.loadInfo();
        if (!doc.title) {
             throw new Error('Failed to load spreadsheet information. Verify Service Account credentials and Sheet permissions.');
        }
        const sheetTitles = doc.sheetTitles || [];
        console.log(`${logPrefix} Spreadsheet loaded: "${doc.title}". Available sheets: ${sheetTitles.join(', ')}`);

        let sheet = doc.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];
        const expectedHeaders = [
            'FranchiseName',
            ...Object.values(feeItemToColumnMap),
            'RoyaltyRate', // Novo
            'MarketingRate', // Novo
            'SoftwareFeeValue', // Novo
            'CallCenterFeeValue', // Novo
            'CallCenterExtraFeeValue', // Novo
            'CustomFeeConfig', // Novo (JSON)
            'ServiceValueRules' // Mantido
        ];

        if (!sheet) {
            if (req.method === 'GET') {
                return res.status(200).json([]);
            }
             try {
                 sheet = await doc.addSheet({ title: SHEET_NAME_FRANCHISE_CONFIG, headerValues: expectedHeaders });
                 console.log(`${logPrefix} Sheet created successfully.`);
             } catch (creationError) {
                  throw new Error(`Failed to create necessary sheet '${SHEET_NAME_FRANCHISE_CONFIG}': ${creationError.message}`);
             }
        } else {
            await sheet.loadHeaderRow();
            const currentHeaders = sheet.headerValues || [];
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

        if (req.method === 'GET') {
            await sheet.loadHeaderRow();
            const rows = await sheet.getRows();
            const configs = rows.map(row => {
                const config = {
                    franchiseName: row.get('FranchiseName'),
                    royaltyRate: parseNumber(row.get('RoyaltyRate'), defaultRatesAndFees.royaltyRate),
                    marketingRate: parseNumber(row.get('MarketingRate'), defaultRatesAndFees.marketingRate),
                    softwareFeeValue: parseNumber(row.get('SoftwareFeeValue'), defaultRatesAndFees.softwareFeeValue),
                    callCenterFeeValue: parseNumber(row.get('CallCenterFeeValue'), defaultRatesAndFees.callCenterFeeValue),
                    callCenterExtraFeeValue: parseNumber(row.get('CallCenterExtraFeeValue'), defaultRatesAndFees.callCenterExtraFeeValue)
                };
                Object.values(feeItemToColumnMap).forEach(colName => {
                    config[colName] = parseBoolean(row.get(colName));
                });

                let rules = getDefaultServiceRules();
                const rulesJsonString = row.get('ServiceValueRules');
                if (rulesJsonString) {
                    try {
                        const parsedRules = JSON.parse(rulesJsonString);
                        if (Array.isArray(parsedRules)) { rules = parsedRules; }
                        else { console.warn(`Invalid JSON structure in ServiceValueRules for ${config.franchiseName}. Using default.`); }
                    } catch (parseError) { console.warn(`Failed to parse ServiceValueRules JSON for ${config.franchiseName}. Using default. Error: ${parseError.message}`); }
                }
                config.serviceValueRules = rules;

                let customFee = { ...defaultRatesAndFees.customFeeConfig }; // Start with default
                const customFeeJsonString = row.get('CustomFeeConfig');
                if (customFeeJsonString) {
                    try {
                        const parsedCustomFee = JSON.parse(customFeeJsonString);
                        // Basic validation: check for expected properties
                        if (parsedCustomFee && typeof parsedCustomFee.name === 'string' && typeof parsedCustomFee.type === 'string' && typeof parsedCustomFee.value === 'number' && typeof parsedCustomFee.enabled === 'boolean') {
                            customFee = parsedCustomFee;
                        } else { console.warn(`Invalid JSON structure in CustomFeeConfig for ${config.franchiseName}. Using default.`); }
                    } catch (parseError) { console.warn(`Failed to parse CustomFeeConfig JSON for ${config.franchiseName}. Using default. Error: ${parseError.message}`); }
                }
                config.customFeeConfig = customFee;

                return config.franchiseName ? config : null;
            }).filter(Boolean);
            return res.status(200).json(configs);
        }

        if (req.method === 'POST') {
            const {
                franchiseName, includedFees, serviceValueRules,
                royaltyRate, marketingRate, softwareFeeValue, callCenterFeeValue,
                callCenterExtraFeeValue, customFeeConfig
            } = req.body;

            if (!franchiseName || !includedFees || typeof includedFees !== 'object' || !Array.isArray(serviceValueRules) || customFeeConfig === undefined) {
                 return res.status(400).json({ success: false, message: 'Bad Request: Missing required fields or invalid format.' });
            }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const existing = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (existing) {
                 return res.status(409).json({ success: false, message: `Conflict: Franchise "${franchiseName}" already exists.` });
            }
            const newRowData = {
                FranchiseName: franchiseName.trim(),
                RoyaltyRate: parseNumber(royaltyRate, defaultRatesAndFees.royaltyRate),
                MarketingRate: parseNumber(marketingRate, defaultRatesAndFees.marketingRate),
                SoftwareFeeValue: parseNumber(softwareFeeValue, defaultRatesAndFees.softwareFeeValue),
                CallCenterFeeValue: parseNumber(callCenterFeeValue, defaultRatesAndFees.callCenterFeeValue),
                CallCenterExtraFeeValue: parseNumber(callCenterExtraFeeValue, defaultRatesAndFees.callCenterExtraFeeValue)
            };
            Object.keys(feeItemToColumnMap).forEach(feeItem => {
                 newRowData[feeItemToColumnMap[feeItem]] = formatBoolean(includedFees[feeItem]);
            });
            try {
                newRowData['ServiceValueRules'] = JSON.stringify(serviceValueRules);
                newRowData['CustomFeeConfig'] = JSON.stringify(customFeeConfig); // Salva config da taxa custom
            } catch (stringifyError) {
                 console.error(`${logPrefix} Failed to stringify JSON data:`, stringifyError);
                 return res.status(500).json({ success: false, message: 'Internal Error: Could not process configuration data.' });
            }

            const addedRowGSheet = await sheet.addRow(newRowData);
            await sheet.loadHeaderRow();
            const addedConfig = { // Monta o objeto de retorno
                 franchiseName: addedRowGSheet.get('FranchiseName'),
                 royaltyRate: parseNumber(addedRowGSheet.get('RoyaltyRate')),
                 marketingRate: parseNumber(addedRowGSheet.get('MarketingRate')),
                 softwareFeeValue: parseNumber(addedRowGSheet.get('SoftwareFeeValue')),
                 callCenterFeeValue: parseNumber(addedRowGSheet.get('CallCenterFeeValue')),
                 callCenterExtraFeeValue: parseNumber(addedRowGSheet.get('CallCenterExtraFeeValue')),
                 serviceValueRules: serviceValueRules, // Retorna o objeto original
                 customFeeConfig: customFeeConfig // Retorna o objeto original
            };
            Object.values(feeItemToColumnMap).forEach(colName => { addedConfig[colName] = parseBoolean(addedRowGSheet.get(colName)); });

            return res.status(201).json({ success: true, message: 'Franchise configuration added successfully.', config: addedConfig });
        }

        if (req.method === 'PUT') {
            const {
                originalFranchiseName, newFranchiseName, includedFees, serviceValueRules,
                royaltyRate, marketingRate, softwareFeeValue, callCenterFeeValue,
                callCenterExtraFeeValue, customFeeConfig
            } = req.body;
             if (!originalFranchiseName || !newFranchiseName || !includedFees || typeof includedFees !== 'object' || !Array.isArray(serviceValueRules) || customFeeConfig === undefined) {
                 return res.status(400).json({ success: false, message: 'Bad Request: Missing required fields or invalid format for update.' });
             }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const rowToUpdate = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === originalFranchiseName.trim().toLowerCase());
            if (!rowToUpdate) {
                return res.status(404).json({ success: false, message: `Not Found: Franchise "${originalFranchiseName}" not found for update.` });
            }
            const normalizedNewName = newFranchiseName.trim().toLowerCase();
            if (originalFranchiseName.trim().toLowerCase() !== normalizedNewName) {
                 const nameConflict = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === normalizedNewName && row.rowNumber !== rowToUpdate.rowNumber);
                 if (nameConflict) { return res.status(409).json({ success: false, message: `Conflict: Cannot rename to "${newFranchiseName}", name already exists.` }); }
            }

            rowToUpdate.set('FranchiseName', newFranchiseName.trim());
            rowToUpdate.set('RoyaltyRate', parseNumber(royaltyRate, defaultRatesAndFees.royaltyRate));
            rowToUpdate.set('MarketingRate', parseNumber(marketingRate, defaultRatesAndFees.marketingRate));
            rowToUpdate.set('SoftwareFeeValue', parseNumber(softwareFeeValue, defaultRatesAndFees.softwareFeeValue));
            rowToUpdate.set('CallCenterFeeValue', parseNumber(callCenterFeeValue, defaultRatesAndFees.callCenterFeeValue));
            rowToUpdate.set('CallCenterExtraFeeValue', parseNumber(callCenterExtraFeeValue, defaultRatesAndFees.callCenterExtraFeeValue));
            Object.keys(feeItemToColumnMap).forEach(feeItem => {
                 const columnName = feeItemToColumnMap[feeItem];
                 const newValue = includedFees.hasOwnProperty(feeItem) ? formatBoolean(includedFees[feeItem]) : 'FALSE';
                 rowToUpdate.set(columnName, newValue);
            });
            try {
                rowToUpdate.set('ServiceValueRules', JSON.stringify(serviceValueRules));
                rowToUpdate.set('CustomFeeConfig', JSON.stringify(customFeeConfig));
             } catch (stringifyError) {
                  console.error(`${logPrefix} Failed to stringify JSON data for update:`, stringifyError);
                  return res.status(500).json({ success: false, message: 'Internal Error: Could not process configuration data for update.' });
             }

            await rowToUpdate.save();
            await sheet.loadHeaderRow();
            const updatedConfig = { // Monta objeto de retorno
                 franchiseName: rowToUpdate.get('FranchiseName'),
                 royaltyRate: parseNumber(rowToUpdate.get('RoyaltyRate')),
                 marketingRate: parseNumber(rowToUpdate.get('MarketingRate')),
                 softwareFeeValue: parseNumber(rowToUpdate.get('SoftwareFeeValue')),
                 callCenterFeeValue: parseNumber(rowToUpdate.get('CallCenterFeeValue')),
                 callCenterExtraFeeValue: parseNumber(rowToUpdate.get('CallCenterExtraFeeValue')),
                 serviceValueRules: serviceValueRules,
                 customFeeConfig: customFeeConfig
            };
            Object.values(feeItemToColumnMap).forEach(colName => { updatedConfig[colName] = parseBoolean(rowToUpdate.get(colName)); });

            return res.status(200).json({ success: true, message: 'Franchise configuration updated successfully.', config: updatedConfig });
        }

        if (req.method === 'DELETE') {
            const { franchiseName } = req.body;
            if (!franchiseName) { return res.status(400).json({ success: false, message: 'Bad Request: Franchise name is required.' }); }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const rowToDelete = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (!rowToDelete) { return res.status(404).json({ success: false, message: `Not Found: Franchise "${franchiseName}" not found for deletion.` }); }
            await rowToDelete.delete();
            return res.status(200).json({ success: true, message: `Franchise "${franchiseName}" configuration deleted successfully.` });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error(`${logPrefix} CRITICAL ERROR:`, error);
        let clientErrorMessage = 'An internal server error occurred while managing franchise configurations.';
        if (error.message) {
            if (error.message.includes('permission denied')) { clientErrorMessage = 'Permission Denied accessing Google Sheet.'; }
            else if (error.message.includes('Failed to load spreadsheet information')) { clientErrorMessage = error.message; }
            else if (error.message.includes('Requested entity was not found')) { clientErrorMessage = `Spreadsheet not found (ID: ${SPREADSHEET_ID}). Verify SHEET_ID.`; }
            else { clientErrorMessage = error.message; }
        }
        return res.status(500).json({ success: false, message: clientErrorMessage });
    }
}
