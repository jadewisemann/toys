async function fetchWords(file) {
  const response = await fetch(`/${file}`);
  return response.json();
}

function getRandomWord(words) {
  const index = Math.floor(Math.random() * words.length);
  return words[index];
}

export async function generateSentence() {
  const [adjectives, nouns, verbs] = await Promise.all([
    fetchWords('adjectives.json'),
    fetchWords('nouns.json'),
    fetchWords('verbs.json')
  ]);

  const adjective = getRandomWord(adjectives);
  const noun1 = getRandomWord(nouns);
  const verb = getRandomWord(verbs);
  const noun2 = getRandomWord(nouns);

  return `${adjective} ${noun1}가 ${noun2}를 ${verb}.`;
}

export async function generateParagraph(sentenceCount = 5) {
  const sentences = [];
  for (let i = 0; i < sentenceCount; i++) {
    const sentence = await generateSentence();
    sentences.push(sentence);
  }
  return sentences.join(' ');
}