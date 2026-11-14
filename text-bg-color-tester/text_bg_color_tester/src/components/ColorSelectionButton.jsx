function ColorSelectionButton({ textColor, bgColor, changeColor  }) {
  return (
    <button
      onClick={() => changeColor(textColor, bgColor)}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: '10px 20px',
        border: 'none',
        borderRadius: '8px',
        margin: '5px',
        cursor: 'pointer',
      }}
    >
      {textColor} + {bgColor}
    </button>
  );
}

export default ColorSelectionButton;