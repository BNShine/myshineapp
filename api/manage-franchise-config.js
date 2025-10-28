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
const parseIntStrict = (value, defaultValue = 0) => {
    const num = parseInt(value, 10); // Base 10
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
    extraVehicles: 0, // Novo padrão
    customFeeConfig: { name: "", type: "percentage", value: 0, enabled: false }
};

export default async function handler(req, res) {
    const logPrefix = `[API ${req.method} ${new Date().toISOString()}]`;
    console.log(`${logPrefix} Received request for /api/manage-franchise-config.`);

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        await doc.loadInfo();
        if (!doc.title) {
             throw new Error('Failed to load spreadsheet information.');
        }
        const sheetTitles = doc.sheetTitles || [];
        console.log(`${logPrefix} Spreadsheet loaded: "${doc.title}". Sheets: ${sheetTitles.join(', ')}`);

        let sheet = doc.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];
        const expectedHeaders = [
            'FranchiseName', ...Object.values(feeItemToColumnMap),
            'RoyaltyRate', 'MarketingRate', 'SoftwareFeeValue', 'CallCenterFeeValue',
            'CallCenterExtraFeeValue', 'ExtraVehicles', 'CustomFeeConfig', 'ServiceValueRules' // ExtraVehicles adicionado
        ];

        if (!sheet) {
            if (req.method === 'GET') { return res.status(200).json([]); }
             try {
                 sheet = await doc.addSheet({ title: SHEET_NAME_FRANCHISE_CONFIG, headerValues: expectedHeaders });
                 console.log(`${logPrefix} Sheet created.`);
             } catch (creationError) { throw new Error(`Failed to create sheet: ${creationError.message}`); }
        } else {
            await sheet.loadHeaderRow();
            const currentHeaders = sheet.headerValues || [];
            let headersOk = expectedHeaders.every(header => currentHeaders.includes(header));
             if (!headersOk || currentHeaders.length < expectedHeaders.length) {
                 const missingHeaders = expectedHeaders.filter(header => !currentHeaders.includes(header));
                 if (missingHeaders.length > 0) {
                     try {
                         await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
                         await sheet.loadHeaderRow();
                         console.log(`${logPrefix} Added missing headers: ${missingHeaders.join(', ')}.`);
                     } catch (headerError) { console.error(`${logPrefix} FAILED to add missing headers:`, headerError); }
                 }
             } else { console.log(`${logPrefix} Headers OK.`); }
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
                    callCenterExtraFeeValue: parseNumber(row.get('CallCenterExtraFeeValue'), defaultRatesAndFees.callCenterExtraFeeValue),
                    extraVehicles: parseIntStrict(row.get('ExtraVehicles'), defaultRatesAndFees.extraVehicles) // Lê ExtraVehicles
                };
                Object.values(feeItemToColumnMap).forEach(colName => { config[colName] = parseBoolean(row.get(colName)); });

                let rules = getDefaultServiceRules();
                const rulesJsonString = row.get('ServiceValueRules');
                if (rulesJsonString) { try { const parsed = JSON.parse(rulesJsonString); if (Array.isArray(parsed)) rules = parsed; } catch (e) { console.warn(`Invalid Service Rules JSON for ${config.franchiseName}`); } }
                config.serviceValueRules = rules;

                let customFee = { ...defaultRatesAndFees.customFeeConfig };
                const customFeeJsonString = row.get('CustomFeeConfig');
                if (customFeeJsonString) { try { const parsed = JSON.parse(customFeeJsonString); if (parsed && typeof parsed === 'object') customFee = parsed; } catch (e) { console.warn(`Invalid Custom Fee JSON for ${config.franchiseName}`); } }
                config.customFeeConfig = customFee;

                return config.franchiseName ? config : null;
            }).filter(Boolean);
            return res.status(200).json(configs);
        }

        if (req.method === 'POST') {
            const { franchiseName, includedFees, serviceValueRules, royaltyRate, marketingRate,
                    softwareFeeValue, callCenterFeeValue, callCenterExtraFeeValue,
                    extraVehicles, customFeeConfig } = req.body;

            if (!franchiseName || !includedFees || !Array.isArray(serviceValueRules) || customFeeConfig === undefined) {
                 return res.status(400).json({ success: false, message: 'Bad Request: Missing fields.' });
            }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const existing = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (existing) { return res.status(409).json({ success: false, message: `Conflict: Franchise exists.` }); }

            const newRowData = {
                FranchiseName: franchiseName.trim(),
                RoyaltyRate: parseNumber(royaltyRate, defaultRatesAndFees.royaltyRate),
                MarketingRate: parseNumber(marketingRate, defaultRatesAndFees.marketingRate),
                SoftwareFeeValue: parseNumber(softwareFeeValue, defaultRatesAndFees.softwareFeeValue),
                CallCenterFeeValue: parseNumber(callCenterFeeValue, defaultRatesAndFees.callCenterFeeValue),
                CallCenterExtraFeeValue: parseNumber(callCenterExtraFeeValue, defaultRatesAndFees.callCenterExtraFeeValue),
                ExtraVehicles: parseIntStrict(extraVehicles, defaultRatesAndFees.extraVehicles) // Salva ExtraVehicles
            };
            Object.keys(feeItemToColumnMap).forEach(item => { newRowData[feeItemToColumnMap[item]] = formatBoolean(includedFees[item]); });
            try {
                newRowData['ServiceValueRules'] = JSON.stringify(serviceValueRules);
                newRowData['CustomFeeConfig'] = JSON.stringify(customFeeConfig);
            } catch (e) { return res.status(500).json({ success: false, message: 'Internal Error: Could not process config data.' }); }

            const addedRowGSheet = await sheet.addRow(newRowData);
            await sheet.loadHeaderRow();
            const addedConfig = {
                 franchiseName: addedRowGSheet.get('FranchiseName'),
                 royaltyRate: parseNumber(addedRowGSheet.get('RoyaltyRate')),
                 marketingRate: parseNumber(addedRowGSheet.get('MarketingRate')),
                 softwareFeeValue: parseNumber(addedRowGSheet.get('SoftwareFeeValue')),
                 callCenterFeeValue: parseNumber(addedRowGSheet.get('CallCenterFeeValue')),
                 callCenterExtraFeeValue: parseNumber(addedRowGSheet.get('CallCenterExtraFeeValue')),
                 extraVehicles: parseIntStrict(addedRowGSheet.get('ExtraVehicles')), // Retorna ExtraVehicles
                 serviceValueRules: serviceValueRules,
                 customFeeConfig: customFeeConfig
            };
            Object.values(feeItemToColumnMap).forEach(col => { addedConfig[col] = parseBoolean(addedRowGSheet.get(col)); });

            return res.status(201).json({ success: true, message: 'Franchise added.', config: addedConfig });
        }

        if (req.method === 'PUT') {
            const { originalFranchiseName, newFranchiseName, includedFees, serviceValueRules,
                    royaltyRate, marketingRate, softwareFeeValue, callCenterFeeValue,
                    callCenterExtraFeeValue, extraVehicles, customFeeConfig } = req.body;
             if (!originalFranchiseName || !newFranchiseName || !includedFees || !Array.isArray(serviceValueRules) || customFeeConfig === undefined) {
                 return res.status(400).json({ success: false, message: 'Bad Request: Missing fields for update.' });
             }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const rowToUpdate = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === originalFranchiseName.trim().toLowerCase());
            if (!rowToUpdate) { return res.status(404).json({ success: false, message: `Not Found: Franchise "${originalFranchiseName}".` }); }
            const normalizedNewName = newFranchiseName.trim().toLowerCase();
            if (originalFranchiseName.trim().toLowerCase() !== normalizedNewName) {
                 const conflict = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === normalizedNewName && row.rowNumber !== rowToUpdate.rowNumber);
                 if (conflict) { return res.status(409).json({ success: false, message: `Conflict: Name "${newFranchiseName}" exists.` }); }
            }

            rowToUpdate.set('FranchiseName', newFranchiseName.trim());
            rowToUpdate.set('RoyaltyRate', parseNumber(royaltyRate, defaultRatesAndFees.royaltyRate));
            rowToUpdate.set('MarketingRate', parseNumber(marketingRate, defaultRatesAndFees.marketingRate));
            rowToUpdate.set('SoftwareFeeValue', parseNumber(softwareFeeValue, defaultRatesAndFees.softwareFeeValue));
            rowToUpdate.set('CallCenterFeeValue', parseNumber(callCenterFeeValue, defaultRatesAndFees.callCenterFeeValue));
            rowToUpdate.set('CallCenterExtraFeeValue', parseNumber(callCenterExtraFeeValue, defaultRatesAndFees.callCenterExtraFeeValue));
            rowToUpdate.set('ExtraVehicles', parseIntStrict(extraVehicles, defaultRatesAndFees.extraVehicles)); // Atualiza ExtraVehicles
            Object.keys(feeItemToColumnMap).forEach(item => { rowToUpdate.set(feeItemToColumnMap[item], formatBoolean(includedFees[item])); });
            try {
                rowToUpdate.set('ServiceValueRules', JSON.stringify(serviceValueRules));
                rowToUpdate.set('CustomFeeConfig', JSON.stringify(customFeeConfig));
             } catch (e) { return res.status(500).json({ success: false, message: 'Internal Error: Could not process config data for update.' }); }

            await rowToUpdate.save();
            await sheet.loadHeaderRow();
            const updatedConfig = {
                 franchiseName: rowToUpdate.get('FranchiseName'),
                 royaltyRate: parseNumber(rowToUpdate.get('RoyaltyRate')),
                 marketingRate: parseNumber(rowToUpdate.get('MarketingRate')),
                 softwareFeeValue: parseNumber(rowToUpdate.get('SoftwareFeeValue')),
                 callCenterFeeValue: parseNumber(rowToUpdate.get('CallCenterFeeValue')),
                 callCenterExtraFeeValue: parseNumber(rowToUpdate.get('CallCenterExtraFeeValue')),
                 extraVehicles: parseIntStrict(rowToUpdate.get('ExtraVehicles')), // Retorna ExtraVehicles
                 serviceValueRules: serviceValueRules,
                 customFeeConfig: customFeeConfig
            };
            Object.values(feeItemToColumnMap).forEach(col => { updatedConfig[col] = parseBoolean(rowToUpdate.get(col)); });

            return res.status(200).json({ success: true, message: 'Franchise updated.', config: updatedConfig });
        }

        if (req.method === 'DELETE') {
            const { franchiseName } = req.body;
            if (!franchiseName) { return res.status(400).json({ success: false, message: 'Bad Request: Name required.' }); }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const rowToDelete = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (!rowToDelete) { return res.status(404).json({ success: false, message: `Not Found: Franchise "${franchiseName}".` }); }
            await rowToDelete.delete();
            return res.status(200).json({ success: true, message: `Franchise deleted.` });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error(`${logPrefix} CRITICAL ERROR:`, error);
        let clientErrorMessage = 'An internal server error occurred.';
        if (error.message) {
            if (error.message.includes('permission denied')) { clientErrorMessage = 'Permission Denied accessing Google Sheet.'; }
            else if (error.message.includes('Failed to load')) { clientErrorMessage = error.message; }
            else if (error.message.includes('Not Found')) { clientErrorMessage = `Spreadsheet/Tab Not Found.`; }
            else { clientErrorMessage = error.message; }
        }
        return res.status(500).json({ success: false, message: clientErrorMessage });
    }
}
