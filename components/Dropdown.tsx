"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  id?: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function Dropdown({
  id,
  options,
  value,
  onChange,
  placeholder = "Select\u2026",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    const item = listRef.current?.children[focusedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex, open]);

  function handleToggle() {
    if (open) {
      close();
    } else {
      setOpen(true);
      const idx = options.findIndex((o) => o.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          handleSelect(options[focusedIndex].value);
        }
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(options.length - 1);
        break;
    }
  }

  return (
    <div ref={containerRef} className="dropdown-root" style={{ position: "relative" }}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id ? `${id}-listbox` : undefined}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="dropdown-trigger"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "14px 18px",
          borderRadius: 12,
          fontSize: 15,
          fontFamily: "var(--font-body), system-ui, sans-serif",
          letterSpacing: "-0.01em",
          color: selectedOption ? "var(--text-primary)" : "var(--text-tertiary)",
          background: "var(--surface)",
          border: open ? "1px solid var(--accent)" : "1px solid var(--border)",
          boxShadow: open ? "0 0 0 3px var(--accent-muted)" : "none",
          outline: "none",
          cursor: "pointer",
          minHeight: 48,
          textAlign: "left",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedOption?.label ?? placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms cubic-bezier(0.23, 1, 0.32, 1)",
            color: "var(--text-tertiary)",
          }}
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          aria-activedescendant={
            focusedIndex >= 0 && id
              ? `${id}-option-${focusedIndex}`
              : undefined
          }
          className="dropdown-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 100,
            margin: 0,
            padding: "4px",
            listStyle: "none",
            borderRadius: 14,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)",
            maxHeight: 240,
            overflowY: "auto",
            animation: "dropdown-enter 150ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isFocused = index === focusedIndex;

            return (
              <li
                key={option.value}
                id={id ? `${id}-option-${index}` : undefined}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                onPointerEnter={() => setFocusedIndex(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontFamily: "var(--font-body), system-ui, sans-serif",
                  letterSpacing: "-0.01em",
                  color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                  background: isFocused ? "var(--bg-subtle)" : "transparent",
                  cursor: "pointer",
                  minHeight: 44,
                  transition: "background-color 80ms ease",
                  userSelect: "none",
                }}
              >
                <span
                  style={{
                    width: 16,
                    flexShrink: 0,
                    textAlign: "center",
                    fontSize: 12,
                    color: isSelected ? "var(--accent)" : "transparent",
                  }}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <span>{option.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
