import React from "react";

const SmartShuffle = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="m18 2 4 4-4 4" />
      <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />

      <path d="m18 14 4 4-4 4" />
      <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />

      <path
        d="M 5.815 1.335 C 5.892 0.928 6.38 0.756 6.695 1.025 C 6.788 1.105 6.851 1.214 6.874 1.335 L 7.439 4.326 C 7.522 4.762 7.862 5.102 8.297 5.184 L 11.288 5.75 C 11.696 5.826 11.868 6.314 11.598 6.629 C 11.519 6.722 11.409 6.785 11.288 6.808 L 8.297 7.373 C 7.862 7.456 7.522 7.796 7.439 8.231 L 6.874 11.223 C 6.798 11.63 6.309 11.802 5.995 11.533 C 5.902 11.453 5.838 11.344 5.815 11.223 L 5.25 8.231 C 5.168 7.796 4.827 7.456 4.392 7.373 L 1.401 6.808 C 0.994 6.732 0.822 6.243 1.091 5.929 C 1.171 5.835 1.28 5.772 1.401 5.75 L 4.392 5.184 C 4.827 5.102 5.168 4.762 5.25 4.326 L 5.815 1.335 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
};

export default SmartShuffle;
