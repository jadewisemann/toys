import React, { useState } from 'react';

const CustomColorPicker = () => {
  const [red, setRed] = useState(0);
  const [green, setGreen] = useState(0);
  const [blue, setBlue] = useState(0);
  const [hex, setHex] = useState('#000000');

  // RGB to HEX 변환
  const rgbToHex = (r, g, b) => {
    const toHex = (n) => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // HEX to RGB 변환
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // RGB 슬라이더 변경 핸들러
  const handleRgbChange = (color, value) => {
    const numValue = parseInt(value);
    switch(color) {
      case 'red':
        setRed(numValue);
        break;
      case 'green':
        setGreen(numValue);
        break;
      case 'blue':
        setBlue(numValue);
        break;
      default:
        break;
    }
    setHex(rgbToHex(
      color === 'red' ? numValue : red,
      color === 'green' ? numValue : green,
      color === 'blue' ? numValue : blue
    ));
  };

  // HEX 입력 핸들러
  const handleHexChange = (value) => {
    if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
      setHex(value);
      const rgb = hexToRgb(value);
      if (rgb) {
        setRed(rgb.r);
        setGreen(rgb.g);
        setBlue(rgb.b);
      }
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md">
      <div className="space-y-4">
        <div className="w-full h-24 rounded-lg" style={{ backgroundColor: hex }}></div>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Red</label>
            <input
              type="range"
              min="0"
              max="255"
              value={red}
              onChange={(e) => handleRgbChange('red', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-600">{red}</span>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Green</label>
            <input
              type="range"
              min="0"
              max="255"
              value={green}
              onChange={(e) => handleRgbChange('green', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-600">{green}</span>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Blue</label>
            <input
              type="range"
              min="0"
              max="255"
              value={blue}
              onChange={(e) => handleRgbChange('blue', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-600">{blue}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">HEX</label>
          <input
            type="text"
            value={hex}
            onChange={(e) => handleHexChange(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};

export default CustomColorPicker;