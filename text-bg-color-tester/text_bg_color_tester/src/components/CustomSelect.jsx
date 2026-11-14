import  { useState, useRef, useEffect } from 'react';
import './CustomSelect.css';

const CustomSelect = ({ options, placeholder = "Select an option", onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    setSelected(option);
    setIsOpen(false);
    onChange(option);
  };

  return (
    <div className="custom-select" ref={dropdownRef}>
      <div className="custom-select__trigger" onClick={() => setIsOpen(!isOpen)}>
        <span>{selected ? selected.label : placeholder}</span>
        <div className={`arrow ${isOpen ? 'open' : ''}`}></div>
      </div>
      {isOpen && (
        <div className="custom-select__options">
          {options.map((option) => (
            <div
              key={option.value}
              className="custom-select__option"
              onClick={() => handleSelect(option)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
