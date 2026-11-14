import { useState, useRef, useEffect } from 'react';

const MiniColorPicker = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [isDragging, setIsDragging] = useState(false);
  const [rgb, setRgb] = useState({ r: 0, g: 0, b: 0 });
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const canvasRef = useRef(null);

  const rgbToHex = (r, g, b) => {
    const toHex = (n) => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const updatePopoverPosition = () => {
    if (triggerRef.current && popoverRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let top = triggerRect.bottom + window.scrollY + 8;
      let left = triggerRect.left + window.scrollX;

      if (top + popoverRect.height > viewportHeight) {
        top = triggerRect.top + window.scrollY - popoverRect.height - 8;
      }

      if (left + popoverRect.width > viewportWidth) {
        left = viewportWidth - popoverRect.width - 8;
      }

      setPopoverPosition({ top, left });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePopoverPosition();
      window.addEventListener('scroll', updatePopoverPosition);
      window.addEventListener('resize', updatePopoverPosition);

      return () => {
        window.removeEventListener('scroll', updatePopoverPosition);
        window.removeEventListener('resize', updatePopoverPosition);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const gradientH = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradientH.addColorStop(0, '#ff0000');
      gradientH.addColorStop(0.17, '#ff00ff');
      gradientH.addColorStop(0.33, '#0000ff');
      gradientH.addColorStop(0.5, '#00ffff');
      gradientH.addColorStop(0.67, '#00ff00');
      gradientH.addColorStop(0.83, '#ffff00');
      gradientH.addColorStop(1, '#ff0000');
      
      ctx.fillStyle = gradientH;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradientV = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradientV.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradientV.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      gradientV.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      gradientV.addColorStop(1, 'rgba(0, 0, 0, 1)');
      
      ctx.fillStyle = gradientV;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target) &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(x, y, 1, 1).data;
    const newRgb = { r: imageData[0], g: imageData[1], b: imageData[2] };
    setRgb(newRgb);
    setSelectedColor(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleCanvasClick(e);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleCanvasClick(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleHexInput = (e) => {
    const value = e.target.value;
    if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
      setSelectedColor(value);
      const newRgb = hexToRgb(value);
      if (newRgb) {
        setRgb(newRgb);
      }
    }
  };

  const handleRgbChange = (component, value) => {
    const newValue = Math.max(0, Math.min(255, parseInt(value) || 0));
    const newRgb = { ...rgb, [component]: newValue };
    setRgb(newRgb);
    setSelectedColor(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  };

  const RgbSlider = ({ label, value, onChange }) => (
    <div className="flex flex-col items-center space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type="range"
        min="0"
        max="255"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
      <span className="text-xs text-gray-500">{value}</span>
    </div>
  );

  return (
    <div className="inline-block" ref={triggerRef}>
      {/* Color preview circle and hex input */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-6 h-6 rounded-full shadow-sm transition-transform hover:scale-105 focus:outline-none"
          style={{ backgroundColor: selectedColor }}
        />
        <input
          type="text"
          value={selectedColor}
          onChange={handleHexInput}
          className="w-20 pb-0.5 text-sm border-b border-gray-200 focus:border-gray-400 focus:outline-none"
          placeholder="#000000"
        />
      </div>

      {/* Floating color picker popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="fixed bg-white rounded-lg shadow-lg z-50 space-y-4 p-4"
          style={{
            top: popoverPosition.top,
            left: popoverPosition.left
          }}
        >
          <canvas
            ref={canvasRef}
            width="200"
            height="200"
            className="rounded-lg cursor-crosshair"
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          
          {/* RGB Controls */}
          <div className="flex justify-between items-center space-x-4 px-2">
            <RgbSlider label="R" value={rgb.r} onChange={(v) => handleRgbChange('r', v)} />
            <RgbSlider label="G" value={rgb.g} onChange={(v) => handleRgbChange('g', v)} />
            <RgbSlider label="B" value={rgb.b} onChange={(v) => handleRgbChange('b', v)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MiniColorPicker;