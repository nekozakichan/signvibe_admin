// Philippine mobile numbers are stored as 09XXXXXXXXX (see StudentsList.jsx
// and backend/src/controllers/studentController.js).

// 09171234567 -> 0917 123 4567, for reading at a glance.
export function formatPhMobile(num) {
  return /^09\d{9}$/.test(num || '') ? `${num.slice(0, 4)} ${num.slice(4, 7)} ${num.slice(7)}` : num;
}
