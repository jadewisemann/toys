const FontSelector = ({ fonts=[], onFontChange, selectedFont }) => {

  const handleChange = (event) => {
    onFontChange(event.target.value);
  };

  return (
    <select onChange={handleChange} value={selectedFont}>
      {fonts.map((font) => (
        <option key={font.family} value={font.family}>
          {font.name}
        </option>
      ))}
    </select>
  );
};

export default FontSelector;