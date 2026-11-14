import { useCallback, useRef, useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
// import useClickOutside from "./useClickOutside";
import './PopoverPicker.css'

const useClickOutside = (ref, handler) => {
  useEffect(() => {
    let startedInside = false;
    let startedWhenMounted = false;

    const listener = (event) => {
      // Do nothing if `mousedown` or `touchstart` started inside ref element
      if (startedInside || !startedWhenMounted) return;
      // Do nothing if clicking ref's element or descendent elements
      if (!ref.current || ref.current.contains(event.target)) return;

      handler(event);
    };

    const validateEventStart = (event) => {
      startedWhenMounted = ref.current;
      startedInside = ref.current && ref.current.contains(event.target);
    };

    document.addEventListener("mousedown", validateEventStart);
    document.addEventListener("touchstart", validateEventStart);
    document.addEventListener("click", listener);

    return () => {
      document.removeEventListener("mousedown", validateEventStart);
      document.removeEventListener("touchstart", validateEventStart);
      document.removeEventListener("click", listener);
    };
  }, [ref, handler]);
};

const PopoverPicker = ({ color, onChange }) => {
  const popover = useRef();
  const [isOpen, toggle] = useState(false);

  const close = useCallback(() => toggle(false), []);
  useClickOutside(popover, close);
  
  const handleColorChange = (e) => {
    const input = e.target.value.replace('#', '');
    if (/^[0-9A-Fa-f]{0,6}$/.test(input)) {
      onChange(`#${input}`);
    }
  };

  const handleFocus = (e) => {
    const input = e.target;
    setTimeout(() => input.setSelectionRange(1, input.value.length), 0);
  };
  // 그냥 누르면 복사 되도록 
  return (
    <div className="picker">
      <div
        className="swatch"
        style={{ backgroundColor: color }}
        onClick={() => toggle(true)}
      />
      <input
        type="text"
        value={color}
        onChange={handleColorChange}
        onFocus={handleFocus}
        autoFocus
      />
      {isOpen && (
        <div className="popover" ref={popover}>
          <HexColorPicker color={color} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

export default PopoverPicker
