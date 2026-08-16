const pdfmake = require('pdfmake');
const path = require('path');
const fs = require('fs');

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};
pdfmake.setFonts(fonts);

async function testPdf() {
  try {
    const uploadDir = path.join(__dirname, 'uploads', 'preventivi');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const docDefinition = {
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 12,
        lineHeight: 1.5,
        color: '#333333'
      },
      content: [
        {
          image: path.join(__dirname, 'public', 'images', 'logo-m2i.png'),
          width: 150,
          alignment: 'center',
          margin: [0, 0, 0, 40]
        },
        { text: 'TEST' }
      ]
    };

    console.log("Creating PDF...");
    const pdfDoc = pdfmake.createPdf(docDefinition);
    console.log("Getting buffer...");
    const buffer = await pdfDoc.getBuffer();
    console.log("Got buffer.");
    
    const filePath = path.join(uploadDir, 'test.pdf');
    fs.writeFileSync(filePath, buffer);
    console.log('PDF GENERATED SUCCESSFULLY');

  } catch (err) {
    console.error("CATCH ERROR:", err);
  }
}

testPdf();
