import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "../../lib/utils";
import { isIosDevice } from "@/lib/platform";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const ios = isIosDevice();
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      orientation={orientation}
      className={cn(
        "relative flex w-full touch-none select-none group data-[disabled]:opacity-50",
        ios
          ? "items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col"
          : "data-[orientation=horizontal]:h-4 data-[orientation=horizontal]:items-center data-[orientation=horizontal]:[--radix-slider-thumb-transform:translate(-50%,-50%)] data-[orientation=horizontal]:[&>span:has([data-slot=slider-thumb])]:top-1/2 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-center",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-zinc-500/20 relative grow rounded-full data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1",
          ios
            ? "overflow-hidden"
            : "overflow-visible data-[orientation=horizontal]:after:absolute data-[orientation=horizontal]:after:-top-3 data-[orientation=horizontal]:after:-bottom-3 data-[orientation=horizontal]:after:left-0 data-[orientation=horizontal]:after:right-0 data-[orientation=horizontal]:after:content-[''] data-[orientation=vertical]:after:absolute data-[orientation=vertical]:after:-left-3 data-[orientation=vertical]:after:-right-3 data-[orientation=vertical]:after:top-0 data-[orientation=vertical]:after:bottom-0 data-[orientation=vertical]:after:content-['']",
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "bg-white absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            ios
              ? "block size-2.5 shrink-0 rounded-full bg-white shadow-sm ring-ring/50 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
              : "relative block size-2.5 shrink-0 rounded-full bg-white shadow-sm ring-ring/50 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity after:absolute after:-inset-3 after:content-['']",
            !ios && orientation === "horizontal" && "-translate-y-1",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
