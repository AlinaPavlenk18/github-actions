function isPalindrome(str) {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned === cleaned.split('').join('');
}

function countWords(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function reverseWords(str) {
  return str.trim().split(/\s+/).reverse().join(' ');
}

module.exports = { isPalindrome, countWords, reverseWords };