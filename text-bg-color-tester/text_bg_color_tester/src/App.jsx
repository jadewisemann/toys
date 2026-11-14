// react hooks
import { useState, useEffect } from 'react'
// utils
import {
  fetchFromJson, isValidColor, removeDuplicates,
  generateRandomColor, isDuplicateColor,
  // loadFontWithAPI
} from './utils'
// components
// import LoremIpsum from './components/LoremIpsum'
import ColorSelectionButton from './components/ColorSelectionButton'
import FontSelector from './components/FontSelector'
import PopoverPicker from './components/PopoverPicker'

// css
import './App.css'
// css  fonts
import './style/fonts/ibm-plex-sans.css'
import './style/fonts/noto-sans-kr.css'

// external function
const localStorageColors = JSON.parse(localStorage.getItem('colors')) || [ ]

// todo
// 동적 폰트 셀렉터
// 상태 및 변수가 너무 중구 난방, 정리할 필요 있어 보임
// json에 저장하는 기능 만들기
// vercel에 올리기

// font loading api 적용

// 배경은 텍스트만 바꾸지 말고 전체 배경
// 폰트도 모든 폰트 색상 변경
// 배경색 변경시 부드러운 색상 전환



function App() {  
  
  const [colors, setColors] = useState(localStorageColors);
  const [externalColors, setExternalColors] = useState([])

  const [textColor, setTextColor] = useState('black');
  const [bgColor, setBgColor] = useState('white');

  const [newTextColor, setNewTextColor] =useState('')
  const [newBgColor, setNewBgColor] = useState('')
  
  const [fonts, setFonts] = useState([])
  const [selectedFont, setSelectedFont] = useState( 'ibm-plex-sans' ) 
  
  const [color, setColor] = useState("#aabbcc");


  useEffect(() => {

    const loadColors = async () => {
      const loadedJsonColors = await fetchFromJson('/color-combination.json');
      setExternalColors(loadedJsonColors)
      setColors(removeDuplicates([...loadedJsonColors, ...localStorageColors]))
    };

    const loadFontFamilies = async () => {
      const loadedJsonFonts = await fetchFromJson('/fonts.json');
      setFonts(loadedJsonFonts)
    };

    // const handelMouseEnter = (fontFamily, fontUrl) => () => {
    //   loadFontWithAPI(fontFamily, fontUrl);
    // };

    loadColors();
    loadFontFamilies();

    // fonts.forEach(({ id, fontFamily, fontUrl }) => {
    //   const element = document.getElementById(id);
    //   if (element) {
    //     element.addEventListener('mouseenter', handelMouseEnter(fontFamily, fontUrl))
    //   }
    // })
  }, []);

  const handleFontChange = (font) => {
    setSelectedFont(font);
  };


  const resetLocalStorage = (defaultColors) => {
    localStorage.removeItem('colors');
    localStorage.setItem('colors', JSON.stringify(defaultColors))
  };
  
  const setToDefault = (defaultColors) => {
    setColors(defaultColors);
    setTextColor('black')
    setBgColor('white')
  }
  
  const resetButtonHandler = () => {
    resetLocalStorage(externalColors)
    setToDefault(externalColors)
  }

  const handleColorChange = (paramTextColor, paramBgColor) => {
    if (isValidColor(paramTextColor) && isValidColor(paramBgColor)) {
      setTextColor(paramTextColor);
      setNewTextColor(paramTextColor)
      setBgColor(paramBgColor)
      setNewBgColor(paramBgColor)
    }
  };
  
  const addColor = () => {
    if (!isValidColor(newTextColor) || !isValidColor(newBgColor)){
      return alert("hex error")
    } 
    if (isDuplicateColor(colors, newTextColor, newBgColor)) { 
      return alert("duplicate colors")
    }
    
    const updatedColors = [...colors, { textColor: newTextColor, bgColor: newBgColor }];
    setColors(updatedColors); 
    localStorage.setItem('colors', JSON.stringify(updatedColors));
    setNewTextColor('');
    setNewBgColor('');
  }

  const removeColor = (colors, paramTextColor, paramBgColor) => {
    const updatedColors = colors.filter(color => {
      return !(color.textColor === paramTextColor && color.bgColor === paramBgColor)
    });

    setColors(updatedColors)
  }
  
  const removeColorHandler = () => {
    if (newTextColor === textColor && newBgColor === bgColor) {
      removeColor(colors, newTextColor, newBgColor)
      setNewBgColor('')
      setNewTextColor('')
    }
  }

  
  const randomButtonHandler = () => {
    const randomBgColor = generateRandomColor()
    const randomTextColor = generateRandomColor()
    handleColorChange(randomTextColor, randomBgColor);
    setNewTextColor(randomTextColor);
    setNewBgColor(randomBgColor);
  }


  

  return (
    <>
      <div className='primary-container'>
        
        <div className='item-1'>
          <div className='title'>title</div>
          <div className='contact-container'>연락처</div>
        </div>

        <div className='divider'/>
        
        <div className='item-2'>
          <div className='selected-font'>{selectedFont}</div>
          <FontSelector fonts={fonts} onFontChange={handleFontChange} selectedFont={selectedFont}/>        
        </div>
        <div  className='item-3'>
          <div>type your text</div>
          <div>text size selector</div>
        </div>

        <div className='divider' />
        
        <div className='item-4'>
          <div className={selectedFont} style={{ background: bgColor, color: textColor}}>
            <div className='test-text' style={{ }}>
              Aa Bb Cc Dd 가나다라마바사 ABC 12345!@#$% <br/>
              QUICK BROWN FOX JUMPS OVER THE LAZY DOG <br/>
              quick brown fox jumps over the lazy dog <br/>
              키스의 고유조건은 입술끼리 만나야 하고 기술은 필요치 않다.<br/>
              1234567890!@#$%^&*()
              
            </div>
          </div>
        </div>
        
        <div className='divider' />

        <div className='item-5'>
          <div className='button-container'>
            {colors.map((color, index) => (
              <ColorSelectionButton
              key={index}
              textColor={color.textColor}
              bgColor={color.bgColor}
              changeColor={handleColorChange}
              />
            ))}
          </div>
          <div className='vertical-divider'/>
          <div className='input-container'>
            <div className="manual-input">
              <div className='input-wrapper'>
                <PopoverPicker color={color} onChange={setColor} />
                <PopoverPicker color={color} onChange={setColor} />
              </div>
              <div className='input-wrapper'>
              </div>
            </div>
            
            <div className='buttons'>
              <button onClick={addColor}>Add Color</button>
              <button onClick={randomButtonHandler}> random</button>
            </div>
            <div className='divider'></div>
            <div  className='history'>
              <div className='buttons'>
                <button onClick={removeColorHandler}> remove Color</button>
                <button onClick={resetButtonHandler} style={{ marginTop: '20px' }}>
                  Reset Colors
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
