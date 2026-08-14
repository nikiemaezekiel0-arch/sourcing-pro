const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const { parse } = require('csv-parse/sync');

const baseUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQjIjBAUE8259RZev0U_pLAM2bKF3idLGLl8x5ZhAY1WKlGczrpN2OkivBggyFow1Z6E1KvdpZrX8mQ/pub?single=true&output=csv&gid=";

const tabs = [
    { name: "INSTRUCTIONS", gid: "2118791292" },
    { name: "Fournisseurs des Videos 📱", gid: "0" },
    { name: "Agents TRANSITAIRES 🚛", gid: "551886024" },
    { name: "CHINE 🇨🇳", gid: "2131743156" },
    { name: "Vêtements 👕", gid: "1322854479" },
    { name: "Accessoires 🎒", gid: "1245713717" },
    { name: "Électronique 💻", gid: "519291818" },
    { name: "Sport et Loisirs ⚽", gid: "347368679" },
    { name: "Enfants et jouets 🧸", gid: "505378949" },
    { name: "Animaux 🐱", gid: "568284232" },
    { name: "Fournitures Bureaux 📚", gid: "1541740342" },
    { name: "Bricolage 🛠️", gid: "1980717742" },
    { name: "Automobile 🚗", gid: "490439298" },
    { name: "Manutention 👷", gid: "415380877" },
    { name: "Electromenager 🔌", gid: "1762571195" },
    { name: "Hygiene et cosmetique 🧼", gid: "1150329625" },
    { name: "Mobilier 🛋️", gid: "1764570161" },
    { name: "Emballage et packaging 🛍", gid: "442759326" },
    { name: "Construction 🏗", gid: "1655115674" },
    { name: "Répliques 1-1 ⚠️", gid: "747077165" },
    { name: "RESTE DU MONDE 🗺️", gid: "55831792" },
    { name: "👕 ASIE DU SUD-EST", gid: "2098183734" },
    { name: "👕 INDE PAKISTAN..", gid: "1328320253" },
    { name: "👕 AFRIQUE", gid: "1159640990" },
    { name: "👕 EUROPE", gid: "1870126535" }
];

function extractPhoneNumber(text) {
    if (!text || typeof text !== 'string') return null;
    const phoneRegex = /(?:\+|00)\s*([0-9]{1,3})[\s\-]*([0-9]{1,4})[\s\-]*([0-9]{1,4})[\s\-]*([0-9]{1,4})[\s\-]*([0-9]{0,4})/g;
    const matches = [...text.matchAll(phoneRegex)];
    if (matches.length > 0) {
        let num = matches[0][0].replace(/[\s\-]/g, '');
        num = num.replace(/^\+/, '');
        num = num.replace(/^00/, '');
        return num;
    }
    const basicPhoneRegex = /tel\s*:\s*([0-9]{8,15})/i;
    const basicMatch = text.match(basicPhoneRegex);
    if(basicMatch) return basicMatch[1];
    return null;
}

async function main() {
    const workbook = new ExcelJS.Workbook();

    for (const tab of tabs) {
        console.log(`Processing tab: ${tab.name}...`);
        try {
            const response = await fetch(baseUrl + tab.gid);
            const csvData = await response.text();
            
            // Clean sheet name for Excel (max 31 chars, no invalid chars like : / \ ? * [ ])
            let safeName = tab.name.replace(/[:\/\\?\*\[\]]/g, '').substring(0, 31).trim();
            const worksheet = workbook.addWorksheet(safeName);
            
            const records = parse(csvData, { skip_empty_lines: true });
            
            if (records.length === 0) {
                console.log(`Skipping empty tab: ${tab.name}`);
                continue;
            }

            // Find header row (first row with at least 2 non-empty cells, or just use the first row if none found)
            let headerIndex = 0;
            for (let i = 0; i < records.length; i++) {
                const nonEmptyCount = records[i].filter(cell => cell.trim() !== "").length;
                if (nonEmptyCount >= 2) {
                    headerIndex = i;
                    break;
                }
            }

            // Set up columns based on header
            const headerRow = records[headerIndex];
            const columns = [];
            for (let i = 0; i < headerRow.length; i++) {
                columns.push({
                    header: headerRow[i] || `Colonne ${i+1}`,
                    key: `col${i}`,
                    width: 35
                });
            }
            
            // Add QR Code column at the end
            const qrColIndex = columns.length;
            columns.push({
                header: '📱 QR Code WhatsApp',
                key: 'qr',
                width: 20
            });
            worksheet.columns = columns;

            // Style the header
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).height = 30;
            worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            let currentRow = 2;

            // Add data rows
            for (let i = headerIndex + 1; i < records.length; i++) {
                const row = records[i];
                // Check if row has any data
                const hasData = row.some(cell => cell && cell.trim() !== "");
                if (!hasData) continue;

                const rowData = {};
                let phoneNumber = null;

                for (let j = 0; j < row.length; j++) {
                    const cellValue = row[j];
                    rowData[`col${j}`] = cellValue;
                    
                    // Look for phone number in any cell
                    if (!phoneNumber) {
                        phoneNumber = extractPhoneNumber(cellValue);
                    }
                }

                worksheet.addRow(rowData);
                const excelRow = worksheet.getRow(currentRow);
                
                if (phoneNumber) {
                    excelRow.height = 80;
                    excelRow.alignment = { vertical: 'middle', wrapText: true };
                    
                    const waLink = `https://wa.me/${phoneNumber}`;
                    
                    try {
                        const qrDataUrl = await QRCode.toDataURL(waLink, {
                            errorCorrectionLevel: 'L',
                            margin: 1,
                            width: 150
                        });
                        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
                        const imageBuffer = Buffer.from(base64Data, 'base64');
                        const imageId = workbook.addImage({
                            buffer: imageBuffer,
                            extension: 'png',
                        });
                        
                        // Add image to worksheet at the QR column
                        // Note: tl (top-left) uses 0-based col index, 0-based row index. 
                        // Our row in excel is currentRow. 0-based row index is currentRow-1.
                        // Our col in excel is qrColIndex + 1. 0-based col index is qrColIndex.
                        worksheet.addImage(imageId, {
                            tl: { col: qrColIndex + 0.1, row: currentRow - 1 + 0.1 },
                            ext: { width: 70, height: 70 }
                        });
                    } catch (e) {
                        console.error("Error generating QR:", e);
                    }
                } else {
                    excelRow.height = 30; // default height for rows without QR
                    excelRow.alignment = { vertical: 'middle', wrapText: true };
                }

                currentRow++;
            }
        } catch (err) {
            console.error(`Error processing tab ${tab.name}:`, err.message);
        }
    }

    const filename = "VERSO_SUPPLY_List_with_QR.xlsx";
    await workbook.xlsx.writeFile(filename);
    console.log(`Successfully generated ${filename}`);
}

main().catch(console.error);
