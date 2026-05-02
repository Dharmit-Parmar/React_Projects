import { Document, Packer, Paragraph, TextRun } from "docx";
import * as fs from "fs";

const doc = new Document({
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                children: [new TextRun("Hello World. This is a test document.")],
            }),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("test.docx", buffer);
});
