export function normalizeBarcode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function getMatchLabel(matchType) {
  if (matchType === "SKU_EXACT") return "SKU exacto";
  if (matchType === "BARCODE_EXACT") return "Código de barras EAN/UPC";
  if (matchType === "GTIN_EXACT") return "GTIN / barcode exacto";
  if (matchType === "OEM_EXACT") return "Código OEM / Parte";
  return "Referencia SIM-TON equivalente";
}

export function validateLocalBarcode(products, rawCode) {
  const scannedCode = normalizeBarcode(rawCode);
  const catalog = Array.isArray(products) ? products : [];

  if (scannedCode.length < 2) {
    return {
      found: false,
      ambiguous: false,
      reason: "INVALID_CODE",
      scannedCode,
      catalogSize: catalog.length,
      matches: []
    };
  }

  // Strip/Pad permutations for UPC/EAN leading zeros
  const scannedStripped = scannedCode.replace(/^0+/, "");
  const scannedPad12 = scannedStripped.padStart(12, "0");
  const scannedPad13 = scannedStripped.padStart(13, "0");
  const scannedReference = scannedCode.replace(/^SIM-TON-/, "").replace(/^COLCAN-/, "").replace(/^N-/, "");
  const canonicalSimTonSku = `SIM-TON-${scannedReference}`;

  const matches = [];

  for (const product of catalog) {
    const sku = normalizeBarcode(product?.sku);
    const gtin = normalizeBarcode(product?.gtin);
    const barcode = normalizeBarcode(product?.barcode);
    const oem = normalizeBarcode(product?.oemCode);

    const bStripped = barcode.replace(/^0+/, "");
    const gStripped = gtin.replace(/^0+/, "");

    let matchType = null;

    // 1. Direct SKU
    if (sku === scannedCode || sku === canonicalSimTonSku) {
      matchType = "SKU_EXACT";
    }
    // 2. Direct Barcode or Zero-padded/Stripped Barcode
    else if (
      (barcode && (barcode === scannedCode || bStripped === scannedStripped || barcode === scannedPad12 || barcode === scannedPad13)) ||
      (gtin && (gtin === scannedCode || gStripped === scannedStripped || gtin === scannedPad12 || gtin === scannedPad13))
    ) {
      matchType = "BARCODE_EXACT";
    }
    // 3. OEM Code
    else if (oem && (oem === scannedCode || oem.includes(scannedReference) || scannedCode.includes(oem))) {
      matchType = "OEM_EXACT";
    }
    // 4. SIM-TON Reference stripped match
    else if (
      scannedReference &&
      (sku.replace(/^SIM-TON-/, "") === scannedReference || sku.replace(/^SIM-TON-/, "").replace(/-/g, "") === scannedReference.replace(/-/g, ""))
    ) {
      matchType = "SIM_TON_REFERENCE";
    }

    if (matchType) {
      matches.push({
        product,
        matchType,
        matchLabel: getMatchLabel(matchType),
        localSku: sku,
        localGtin: barcode || gtin || "SIN GTIN"
      });
    }
  }

  const uniqueMatches = matches.filter((match, index) =>
    matches.findIndex(candidate => candidate.localSku === match.localSku) === index
  );

  if (uniqueMatches.length === 1) {
    return {
      found: true,
      ambiguous: false,
      reason: "OK",
      scannedCode,
      catalogSize: catalog.length,
      product: uniqueMatches[0].product,
      matchType: uniqueMatches[0].matchType,
      matchLabel: uniqueMatches[0].matchLabel,
      localSku: uniqueMatches[0].localSku,
      localGtin: uniqueMatches[0].localGtin,
      matches: uniqueMatches
    };
  }

  if (uniqueMatches.length > 1) {
    return {
      found: false,
      ambiguous: true,
      reason: "AMBIGUOUS_MATCH",
      scannedCode,
      catalogSize: catalog.length,
      matches: uniqueMatches
    };
  }

  return {
    found: false,
    ambiguous: false,
    reason: "NOT_FOUND",
    scannedCode,
    catalogSize: catalog.length,
    matches: []
  };
}
