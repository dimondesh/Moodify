import * as React from "react";
const CheckedIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="black"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-circle-check-icon lucide-circle-check"
    {...props}
  >
    <circle cx={12} cy={12} r={10} fill="#805ad5" stroke="#805ad5" />
    <path d="m9 12 2 2 4-4 fill-black" />
  </svg>
);
export default CheckedIcon;
