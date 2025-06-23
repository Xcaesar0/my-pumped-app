import React from 'react';

const XIcon = ({ className = '' }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.53 2.47a.75.75 0 0 1 1.06 1.06L13.06 9l6.47 6.47a.75.75 0 1 1-1.06 1.06L12 10.06l-6.47 6.47a.75.75 0 1 1-1.06-1.06L10.94 9 4.47 2.53A.75.75 0 1 1 5.53 1.47L12 7.94l6.47-6.47a.75.75 0 0 1 1.06 1.06z" />
  </svg>
);

export default XIcon; 