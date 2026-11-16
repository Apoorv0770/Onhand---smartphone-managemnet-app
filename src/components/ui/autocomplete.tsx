"use client";

import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { controlClasses } from "./input";

interface AutocompleteProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "role" | "children"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Suggestions. Typing anything else is always allowed. */
  options: string[];
  /** Optional decoration rendered before each suggestion (a colour swatch, say). */
  renderOption?: (option: string) => React.ReactNode;
  maxVisible?: number;
}

/**
 * A text input with a suggestion list. It never restricts the value: retailers
 * can pick a suggestion or type a model or colour we have never heard of.
 */
export function Autocomplete({
  value,
  onValueChange,
  options,
  renderOption,
  maxVisible = 7,
  className,
  onBlur,
  onFocus,
  onKeyDown,
  ...props
}: AutocompleteProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    const unique = Array.from(new Set(options));
    if (!query) return unique.slice(0, maxVisible);
    const exact = unique.filter((option) => option.toLowerCase() === query);
    const starts = unique.filter(
      (option) => option.toLowerCase().startsWith(query) && option.toLowerCase() !== query,
    );
    const contains = unique.filter(
      (option) => !option.toLowerCase().startsWith(query) && option.toLowerCase().includes(query),
    );
    const ranked = [...exact, ...starts, ...contains];
    // Nothing useful to suggest once the value is exactly the only match.
    if (ranked.length === 1 && ranked[0].toLowerCase() === query) return [];
    return ranked.slice(0, maxVisible);
  }, [options, value, maxVisible]);

  const showList = open && matches.length > 0;

  function choose(option: string) {
    onValueChange(option);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={value}
        className={cn(controlClasses, "h-11 px-3 md:h-10", className)}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={(event) => {
          setOpen(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setOpen(false);
          setActive(-1);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) setOpen(true);
            setActive((index) => (matches.length ? (index + 1) % matches.length : -1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (matches.length ? (index <= 0 ? matches.length - 1 : index - 1) : -1));
          } else if (event.key === "Enter" && showList && active >= 0) {
            event.preventDefault();
            choose(matches[active]);
          } else if (event.key === "Escape" && showList) {
            event.preventDefault();
            setOpen(false);
          }
        }}
        {...props}
      />
      <ul
        id={listId}
        role="listbox"
        hidden={!showList}
        className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-64 overflow-y-auto rounded-lg bg-surface p-1 shadow-pop animate-in fade-in-0 slide-in-from-top-1 duration-150"
      >
        {matches.map((option, index) => (
          <li
            key={option}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // Keep focus in the input so blur does not close the list first.
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
            onMouseEnter={() => setActive(index)}
            className={cn(
              "flex cursor-pointer select-none items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm",
              index === active && "bg-surface-3",
            )}
          >
            {renderOption?.(option)}
            <span className="truncate">{option}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
