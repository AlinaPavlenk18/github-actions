const { isPalindrome, countWords, reverseWords } = require('../src/textUtils.js');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAILED: ${label} — expected "${expected}", got "${actual}"`);
    process.exit(1);
  }
  console.log(`PASSED: ${label}`);
}

assertEqual(isPalindrome('A man a plan a canal Panama'), true, 'isPalindrome true case');
assertEqual(isPalindrome('Hello'), false, 'isPalindrome false case');
assertEqual(countWords('  hello   world  foo '), 3, 'countWords');
assertEqual(reverseWords('one two three'), 'three two one', 'reverseWords');

console.log('All tests passed!');