let wasmModulePromise = null;

export function getSpireDocModule() {
  if (wasmModulePromise) return wasmModulePromise;
  wasmModulePromise = new Promise((resolve, reject) => {
    // If already loaded and ready
    if (window.spiredoc && window.spiredoc.Document) {
      return resolve(window.spiredoc);
    }
    const script = document.createElement('script');
    script.src = '/Spire.Doc.Base.js';
    script.onload = () => {
      const { Module, spiredoc } = window;
      if (Module) {
        if (spiredoc && spiredoc.Document) {
          resolve(spiredoc);
        } else {
          Module.onRuntimeInitialized = () => {
            resolve(window.spiredoc);
          };
        }
      } else {
        reject(new Error("Module not found after Spire.Doc.Base.js loaded."));
      }
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return wasmModulePromise;
}

export async function convertWordToPdf(file) {
  const wasmModule = await getSpireDocModule();

  if (!window._spireFontLoaded) {
    try {
      const res = await window.fetch('/OpenSans-Regular.ttf');
      if (res.ok) {
        const fontBuf = await res.arrayBuffer();
        wasmModule.FS.writeFile('OpenSans-Regular.ttf', new Uint8Array(fontBuf));
        window._spireFontLoaded = true;
      }
    } catch (err) {
      console.warn("Spire.Doc: Failed to load font to VFS", err);
    }
  }

  const uniqueId = Math.random().toString(36).substring(2, 9);
  const inputFileName = `input_${uniqueId}.docx`;
  const outputFileName = `output_${uniqueId}.pdf`;

  const arrayBuffer = await file.arrayBuffer();
  wasmModule.FS.writeFile(inputFileName, new Uint8Array(arrayBuffer));

  let doc;
  let modifiedFileArray;
  try {
    doc = wasmModule.Document.Create();
    doc.LoadFromFile(inputFileName);

    let parameters = wasmModule.ToPdfParameterList.Create();
    parameters.IsEmbeddedAllFonts = true;

    // Use fileFormat to be absolutely sure Spire knows it's a PDF
    doc.SaveToFile({ fileName: outputFileName, fileFormat: wasmModule.FileFormat.PDF, paramList: parameters });

    modifiedFileArray = wasmModule.FS.readFile(outputFileName);
  } catch (err) {
    throw new Error("Spire.Doc failed to convert: " + err.message);
  } finally {
    if (doc) doc.Dispose();
    try { wasmModule.FS.unlink(inputFileName); } catch(e){}
    try { wasmModule.FS.unlink(outputFileName); } catch(e){}
  }

  if (!modifiedFileArray) {
    throw new Error("Failed to read converted PDF from Virtual File System.");
  }

  const rawBytes = new Uint8Array(modifiedFileArray);
  const pdfBytes = rawBytes.slice().buffer;
  
  return pdfBytes;
}
