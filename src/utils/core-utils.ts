const alpha = 'abcdefghijklmnopqrstuvwxyz';
const numeric = '1234567890';

const allowedChars = `${alpha}${alpha.toUpperCase()}${numeric}`;

export const getRandomString = (size: number) => {
  const arr = [];

  for (let i = 0; i < size; i++) {
    arr.push(allowedChars.charAt(Math.floor(Math.random() * allowedChars.length)));
  }

  return arr.join('');
}

// bit index starting at 1
export const nthBit = (bitIndex: number) => {
  if (bitIndex <= 0) throw new Error('Invalid bit index');
  else if (bitIndex === 1) return 1;
  else return Math.pow(2, bitIndex - 1);
}
export const hasBits = (target: number, test: number) => {
  // zero is special :-)
  if (test === 0)
    return target === test;
  else
    // this expression will always return true if test=0 that's why we need the if
    return (target & test) === test
}