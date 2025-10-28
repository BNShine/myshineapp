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
    hasMinRoyaltyFee: false, // Novo
    minRoyaltyFeeValue: 0, // Novo
    softwareFeeValue: 350.00,
    callCenterFeeValue: 1200.00,
    callCenterExtraFeeValue: 600.00,
    extraVehicles: 0,
    customFeesConfig: [],
    hasLoan: false,
    loanCurrentInstallment: 0,
    loanTotalInstallments: 0,
    loanValue: 0
};

export default async function handler(request, response) {
    const logPrefix = `[API ${request.method} ${new Date().toISOString()}]`;
    console.log(`${logPrefix} Received request for /api/manage-franchise-config.`);

    const document = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        await document.loadInfo();
        if (!document.title) { throw new Error('Failed to load spreadsheet information.'); }
        console.log(`${logPrefix} Spreadsheet loaded: "${document.title}".`);

        let sheet = document.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];
        const expectedHeaders = [
            'FranchiseName', ...Object.values(feeItemToColumnMap),
            'RoyaltyRate', 'MarketingRate',
            'HasMinRoyaltyFee', 'MinRoyaltyFeeValue', // Novos campos Royalty Mínimo
            'SoftwareFeeValue', 'CallCenterFeeValue', 'CallCenterExtraFeeValue', 'ExtraVehicles',
            'HasLoan', 'LoanCurrentInstallment', 'LoanTotalInstallments', 'LoanValue',
            'CustomFeesConfig', 'ServiceValueRules'
        ];

        if (!sheet) {
            if (request.method === 'GET') { return response.status(200).json([]); }
             try {
                 sheet = await document.addSheet({ title: SHEET_NAME_FRANCHISE_CONFIG, headerValues: expectedHeaders });
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

        if (request.method === 'GET') {
            await sheet.loadHeaderRow();
            const rows = await sheet.getRows();
            const configurations = rows.map(row => {
                const configData = {
                    franchiseName: row.get('FranchiseName'),
                    royaltyRate: parseNumber(row.get('RoyaltyRate'), defaultRatesAndFees.royaltyRate),
                    marketingRate: parseNumber(row.get('MarketingRate'), defaultRatesAndFees.marketingRate),
                    hasMinRoyaltyFee: parseBoolean(row.get('HasMinRoyaltyFee')), // Lê Min Royalty
                    minRoyaltyFeeValue: parseNumber(row.get('MinRoyaltyFeeValue'), defaultRatesAndFees.minRoyaltyFeeValue), // Lê Min Royalty Value
                    softwareFeeValue: parseNumber(row.get('SoftwareFeeValue'), defaultRatesAndFees.softwareFeeValue),
                    callCenterFeeValue: parseNumber(row.get('CallCenterFeeValue'), defaultRatesAndFees.callCenterFeeValue),
                    callCenterExtraFeeValue: parseNumber(row.get('CallCenterExtraFeeValue'), defaultRatesAndFees.callCenterExtraFeeValue),
                    extraVehicles: parseIntStrict(row.get('ExtraVehicles'), defaultRatesAndFees.extraVehicles),
                    hasLoan: parseBoolean(row.get('HasLoan')),
                    loanCurrentInstallment: parseIntStrict(row.get('LoanCurrentInstallment'), defaultRatesAndFees.loanCurrentInstallment),
                    loanTotalInstallments: parseIntStrict(row.get('LoanTotalInstallments'), defaultRatesAndFees.loanTotalInstallments),
                    loanValue: parseNumber(row.get('LoanValue'), defaultRatesAndFees.loanValue)
                };
                Object.values(feeItemToColumnMap).forEach(colName => { configData[colName] = parseBoolean(row.get(colName)); });

                let rules = getDefaultServiceRules();
                const rulesJsonString = row.get('ServiceValueRules');
                if (rulesJsonString) { try { const parsed = JSON.parse(rulesJsonString); if (Array.isArray(parsed)) rules = parsed; } catch (e) { /* Usa padrão */ } }
                configData.serviceValueRules = rules;

                let customFees = [];
                const customFeesJsonString = row.get('CustomFeesConfig');
                if (customFeesJsonString) { try { const parsed = JSON.parse(customFeesJsonString); if (Array.isArray(parsed)) customFees = parsed; } catch (e) { /* Usa padrão */ } }
                configData.customFeesConfig = customFees;

                return configData.franchiseName ? configData : null;
            }).filter(Boolean);
            return response.status(200).json(configurations);
        }

        if (request.method === 'POST') {
            const { franchiseName, includedFees, serviceValueRules, royaltyRate, marketingRate,
                    hasMinRoyaltyFee, minRoyaltyFeeValue, // Novos campos Royalty Min
                    softwareFeeValue, callCenterFeeValue, callCenterExtraFeeValue, extraVehicles,
                    hasLoan, loanCurrentInstallment, loanTotalInstallments, loanValue,
                    customFeesConfig } = request.body;

            if (!franchiseName || !includedFees || !Array.isArray(serviceValueRules) || !Array.isArray(customFeesConfig)) {
                 return response.status(400).json({ success: false, message: 'Bad Request: Missing fields.' });
            }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const existing = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (existing) { return response.status(409).json({ success: false, message: `Conflict: Franchise exists.` }); }

            const newRowData = {
                FranchiseName: franchiseName.trim(),
                RoyaltyRate: parseNumber(royaltyRate, defaultRatesAndFees.royaltyRate),
                MarketingRate: parseNumber(marketingRate, defaultRatesAndFees.marketingRate),
                HasMinRoyaltyFee: formatBoolean(hasMinRoyaltyFee), // Salva Min Royalty
                MinRoyaltyFeeValue: parseNumber(minRoyaltyFeeValue, defaultRatesAndFees.minRoyaltyFeeValue), // Salva Min Royalty Value
                SoftwareFeeValue: parseNumber(softwareFeeValue, defaultRatesAndFees.softwareFeeValue),
                CallCenterFeeValue: parseNumber(callCenterFeeValue, defaultRatesAndFees.callCenterFeeValue),
                CallCenterExtraFeeValue: parseNumber(callCenterExtraFeeValue, defaultRatesAndFees.callCenterExtraFeeValue),
                ExtraVehicles: parseIntStrict(extraVehicles, defaultRatesAndFees.extraVehicles),
                HasLoan: formatBoolean(hasLoan),
                LoanCurrentInstallment: parseIntStrict(loanCurrentInstallment, defaultRatesAndFees.loanCurrentInstallment),
                LoanTotalInstallments: parseIntStrict(loanTotalInstallments, defaultRatesAndFees.loanTotalInstallments),
                LoanValue: parseNumber(loanValue, defaultRatesAndFees.loanValue)
            };
            Object.keys(feeItemToColumnMap).forEach(item => { newRowData[feeItemToColumnMap[item]] = formatBoolean(includedFees[item]); });
            try {
                newRowData['ServiceValueRules'] = JSON.stringify(serviceValueRules);
                newRowData['CustomFeesConfig'] = JSON.stringify(customFeesConfig);
            } catch (e) { return response.status(500).json({ success: false, message: 'Internal Error: Could not process config data.' }); }

            const addedRowGSheet = await sheet.addRow(newRowData);
            await sheet.loadHeaderRow();
            const addedConfigData = {
                 franchiseName: addedRowGSheet.get('FranchiseName'),
                 royaltyRate: parseNumber(addedRowGSheet.get('RoyaltyRate')),
                 marketingRate: parseNumber(addedRowGSheet.get('MarketingRate')),
                 hasMinRoyaltyFee: parseBoolean(addedRowGSheet.get('HasMinRoyaltyFee')), // Retorna Min Royalty
                 minRoyaltyFeeValue: parseNumber(addedRowGSheet.get('MinRoyaltyFeeValue')), // Retorna Min Royalty Value
                 softwareFeeValue: parseNumber(addedRowGSheet.get('SoftwareFeeValue')),
                 callCenterFeeValue: parseNumber(addedRowGSheet.get('CallCenterFeeValue')),
                 callCenterExtraFeeValue: parseNumber(addedRowGSheet.get('CallCenterExtraFeeValue')),
                 extraVehicles: parseIntStrict(addedRowGSheet.get('ExtraVehicles')),
                 hasLoan: parseBoolean(addedRowGSheet.get('HasLoan')),
                 loanCurrentInstallment: parseIntStrict(addedRowGSheet.get('LoanCurrentInstallment')),
                 loanTotalInstallments: parseIntStrict(addedRowGSheet.get('LoanTotalInstallments')),
                 loanValue: parseNumber(addedRowGSheet.get('LoanValue')),
                 serviceValueRules: serviceValueRules,
                 customFeesConfig: customFeesConfig
            };
            Object.values(feeItemToColumnMap).forEach(col => { addedConfigData[col] = parseBoolean(addedRowGSheet.get(col)); });

            return response.status(201).json({ success: true, message: 'Franchise added.', config: addedConfigData });
        }

        if (request.method === 'PUT') {
            const { originalFranchiseName, newFranchiseName, includedFees, serviceValueRules,
                    royaltyRate, marketingRate, hasMinRoyaltyFee, minRoyaltyFeeValue, // Novos campos Royalty Min
                    softwareFeeValue, callCenterFeeValue, callCenterExtraFeeValue, extraVehicles,
                    hasLoan, loanCurrentInstallment, loanTotalInstallments, loanValue,
                    customFeesConfig } = request.body;
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
            rowToUpdate.set('HasMinRoyaltyFee', formatBoolean(hasMinRoyaltyFee)); // Salva Min Royalty
            rowToUpdate.set('MinRoyaltyFeeValue', parseNumber(minRoyaltyFeeValue, defaultRatesAndFees.minRoyaltyFeeValue)); // Salva Min Royalty Value
            rowToUpdate.set('SoftwareFeeValue', parseNumber(softwareFeeValue, defaultRatesAndFees.softwareFeeValue));
            rowToUpdate.set('CallCenterFeeValue', parseNumber(callCenterFeeValue, defaultRatesAndFees.callCenterFeeValue));
            rowToUpdate.set('CallCenterExtraFeeValue', parseNumber(callCenterExtraFeeValue, defaultRatesAndFees.callCenterExtraFeeValue));
            rowToUpdate.set('ExtraVehicles', parseIntStrict(extraVehicles, defaultRatesAndFees.extraVehicles));
            rowToUpdate.set('HasLoan', formatBoolean(hasLoan));
            rowToUpdate.set('LoanCurrentInstallment', parseIntStrict(loanCurrentInstallment, defaultRatesAndFees.loanCurrentInstallment));
            rowToUpdate.set('LoanTotalInstallments', parseIntStrict(loanTotalInstallments, defaultRatesAndFees.loanTotalInstallments));
            rowToUpdate.set('LoanValue', parseNumber(loanValue, defaultRatesAndFees.loanValue));
            Object.keys(feeItemToColumnMap).forEach(item => { rowToUpdate.set(feeItemToColumnMap[item], formatBoolean(includedFees[item])); });
            try {
                rowToUpdate.set('ServiceValueRules', JSON.stringify(serviceValueRules));
                rowToUpdate.set('CustomFeesConfig', JSON.stringify(customFeesConfig));
             } catch (e) { return response.status(500).json({ success: false, message: 'Internal Error: Could not process config data for update.' }); }

            await rowToUpdate.save();
            await sheet.loadHeaderRow();
            const updatedConfigData = {
                 franchiseName: rowToUpdate.get('FranchiseName'),
                 royaltyRate: parseNumber(rowToUpdate.get('RoyaltyRate')),
                 marketingRate: parseNumber(rowToUpdate.get('MarketingRate')),
                 hasMinRoyaltyFee: parseBoolean(rowToUpdate.get('HasMinRoyaltyFee')), // Retorna Min Royalty
                 minRoyaltyFeeValue: parseNumber(rowToUpdate.get('MinRoyaltyFeeValue')), // Retorna Min Royalty Value
                 softwareFeeValue: parseNumber(rowToUpdate.get('SoftwareFeeValue')),
                 callCenterFeeValue: parseNumber(rowToUpdate.get('CallCenterFeeValue')),
                 callCenterExtraFeeValue: parseNumber(rowToUpdate.get('CallCenterExtraFeeValue')),
                 extraVehicles: parseIntStrict(rowToUpdate.get('ExtraVehicles')),
                 hasLoan: parseBoolean(rowToUpdate.get('HasLoan')),
                 loanCurrentInstallment: parseIntStrict(rowToUpdate.get('LoanCurrentInstallment')),
                 loanTotalInstallments: parseIntStrict(rowToUpdate.get('LoanTotalInstallments')),
                 loanValue: parseNumber(rowToUpdate.get('LoanValue')),
                 serviceValueRules: serviceValueRules,
                 customFeesConfig: customFeesConfig
            };
            Object.values(feeItemToColumnMap).forEach(col => { updatedConfigData[col] = parseBoolean(rowToUpdate.get(col)); });

            return response.status(200).json({ success: true, message: 'Franchise updated.', config: updatedConfigData });
        }

        if (request.method === 'DELETE') {
            const { franchiseName } = request.body;
            if (!franchiseName) { return response.status(400).json({ success: false, message: 'Bad Request: Name required.' }); }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const rowToDelete = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (!rowToDelete) { return response.status(404).json({ success: false, message: `Not Found: Franchise "${franchiseName}".` }); }
            await rowToDelete.delete();
            return response.status(200).json({ success: true, message: `Franchise deleted.` });
        }

        response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);

    } catch (error) {
        console.error(`${logPrefix} CRITICAL ERROR:`, error);
        let clientErrorMessage = 'An internal server error occurred.';
        if (error.message) { /* ... tratamento de erro ... */ }
        return response.status(500).json({ success: false, message: clientErrorMessage });
    }
}
