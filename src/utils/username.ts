const adjectives = [
  'Swift', 'Brave', 'Clever', 'Bold', 'Wise', 'Quick', 'Sharp', 'Bright',
  'Strong', 'Fast', 'Smart', 'Cool', 'Epic', 'Wild', 'Free', 'Pure',
  'Dark', 'Light', 'Fire', 'Ice', 'Storm', 'Wind', 'Star', 'Moon',
  'Sun', 'Sky', 'Ocean', 'River', 'Mountain', 'Forest', 'Desert', 'Valley'
]

const nouns = [
  'Tiger', 'Eagle', 'Wolf', 'Lion', 'Bear', 'Fox', 'Hawk', 'Shark',
  'Dragon', 'Phoenix', 'Falcon', 'Panther', 'Viper', 'Raven', 'Lynx', 'Cobra',
  'Hunter', 'Warrior', 'Knight', 'Ranger', 'Scout', 'Guardian', 'Champion', 'Hero',
  'Ninja', 'Samurai', 'Wizard', 'Mage', 'Archer', 'Rider', 'Pilot', 'Captain'
]

export const generateUsername = (): string => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const number = Math.floor(Math.random() * 9999) + 1
  
  return `${adjective}${noun}${number}`
}