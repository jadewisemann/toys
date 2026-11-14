import { useEffect, useState } from "react";
import { generateParagraph } from '../lib/loremIpsumGenerator';

const LoremIpsum = ({ sentenceCount = 5, className, style }) => {
  const [text, setText] = useState('');

  useEffect(() => {
    generateParagraph(sentenceCount).then(setText);
  }, [sentenceCount]);

  return (
    <div>
      <p className={className} style={style}>{text}</p>
    </div>
  );
};

export default LoremIpsum;
