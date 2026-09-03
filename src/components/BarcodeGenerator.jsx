import React from "react";

// Official Standard Code 128 (Patterns 0 to 106)
const CODE128_TABLE = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'                                // 100-106
];

const START_B = 104; // Index 104 = '211214'
const STOP = 106;    // Index 106 = '2331112'

/**
 * Standard ISO/IEC 15417 Code 128 (Subset B) Barcode Generator
 * Responsive SVG with strict container containment (zero overflow).
 */
export function BarcodeGenerator({ value, text: customText, height = 46, showText = true, className = "" }) {
  const text = (value || "").trim();
  if (!text) return null;

  // 1. Calculate Checksum Modulo 103
  let checksumSum = START_B;
  const charCodes = [];

  for (let i = 0; i < text.length; i++) {
    const ascii = text.charCodeAt(i);
    const codeVal = (ascii >= 32 && ascii <= 126) ? (ascii - 32) : 0;
    charCodes.push(codeVal);
    checksumSum += (i + 1) * codeVal;
  }

  const checksumVal = checksumSum % 103;

  // 2. Build full sequence: START_B + DATA + CHECKSUM + STOP
  let patternString = CODE128_TABLE[START_B];
  for (let i = 0; i < charCodes.length; i++) {
    patternString += CODE128_TABLE[charCodes[i]] || CODE128_TABLE[0];
  }
  patternString += CODE128_TABLE[checksumVal];
  patternString += CODE128_TABLE[STOP];

  // 3. Convert pattern to black and white bars
  let bars = [];
  let isBar = true;
  let currentX = 10;

  for (let i = 0; i < patternString.length; i++) {
    const barWidth = parseInt(patternString[i], 10);
    if (isBar) {
      bars.push({ x: currentX, w: barWidth });
    }
    currentX += barWidth;
    isBar = !isBar;
  }

  const totalSvgWidth = currentX + 10;
  const displayText = customText || text;

  return (
    <div 
      className={className}
      style={{ 
        width: "100%", 
        maxWidth: "100%", 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center",
        boxSizing: "border-box",
        overflow: "hidden"
      }}
    >
      <svg 
        viewBox={`0 0 ${totalSvgWidth} ${height}`} 
        preserveAspectRatio="xMidYMid meet"
        style={{ 
          width: "100%", 
          maxWidth: "100%", 
          height: `${height}px`, 
          display: "block",
          overflow: "hidden"
        }}
      >
        {bars.map((bar, idx) => (
          <rect key={idx} x={bar.x} y={0} width={bar.w} height={height} fill="#0F172A" />
        ))}
      </svg>
      {showText && (
        <span 
          style={{ 
            fontFamily: "var(--px-font-data, monospace)", 
            fontSize: "0.76rem", 
            fontWeight: "800", 
            letterSpacing: "0.04em", 
            color: "#0F172A", 
            marginTop: "4px",
            maxWidth: "100%",
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {displayText}
        </span>
      )}
    </div>
  );
}
