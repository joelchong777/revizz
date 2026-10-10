import React from 'react';

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

const START_B = 104;
const STOP = 106;

export function encodeCode128B(text: string): number[] {
  const codes: number[] = [START_B];
  let checksum = START_B;
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    let value = charCode - 32;
    if (value < 0 || value > 95) {
      value = 0; // fallback for non-ASCII
    }
    codes.push(value);
    checksum += value * (i + 1);
  }
  
  codes.push(checksum % 103);
  codes.push(STOP);
  
  return codes;
}

export function generateCode128Bars(text: string): { width: number; pattern: string } {
  const codes = encodeCode128B(text);
  let pattern = "";
  for (const code of codes) {
    pattern += CODE128_PATTERNS[code];
  }
  
  let totalWidth = 0;
  for (let i = 0; i < pattern.length; i++) {
    totalWidth += parseInt(pattern[i], 10);
  }
  
  return { width: totalWidth, pattern };
}

interface Code128BarcodeProps {
  value: string;
  height?: number;
  width?: number;
  className?: string;
  showText?: boolean;
}

export const Code128Barcode: React.FC<Code128BarcodeProps> = ({ 
  value, 
  height = 50, 
  width = 200, 
  className = "", 
  showText = true 
}) => {
  const { width: totalWidth, pattern } = generateCode128Bars(value);
  
  const rects = [];
  let currentX = 0;
  
  for (let i = 0; i < pattern.length; i++) {
    const barWidth = parseInt(pattern[i], 10);
    // Even indices are bars (black), odd are spaces (white)
    if (i % 2 === 0) {
      rects.push(
        <rect 
          key={i} 
          x={currentX} 
          y={0} 
          width={barWidth} 
          height={height - (showText ? 15 : 0)} 
          fill="black" 
        />
      );
    }
    currentX += barWidth;
  }

  return (
    <svg 
      viewBox={`0 0 ${totalWidth} ${height}`} 
      width={width} 
      height={height} 
      className={className}
      preserveAspectRatio="none"
    >
      <rect width={totalWidth} height={height} fill="white" />
      {rects}
      {showText && (
        <text 
          x={totalWidth / 2} 
          y={height - 2} 
          fontSize="12" 
          fontFamily="monospace"
          textAnchor="middle" 
          fill="black"
        >
          {value}
        </text>
      )}
    </svg>
  );
};
