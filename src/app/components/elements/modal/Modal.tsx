import { createSignal, createEffect, onCleanup, splitProps } from "solid-js";
import { Portal } from "solid-js/web";
import { modalPanelVariants, modalOverlayVariants } from "./Modal.styles";
import type { ModalProps } from "./Modal.types";
import { cn } from "@/utils";

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Modal(props: ModalProps) {
  const [local, rest] = splitProps(props, [
    "children",
    "open",
    "onOpenChange",
    "onClose",
    "overlayOpacity",
    "overlayBlur",
    "withOverlay",
    "overlayClassName",
    "overlayProps",
  ]);
  const isControlled = () => local.open !== undefined;
  const [internalOpen, setInternalOpen] = createSignal(false);

  const isOpen = () => (isControlled() ? local.open! : internalOpen());

  let dialogRef: HTMLDialogElement | undefined;
  let lastFocused: HTMLElement | null = null;

  const triggerClose = async () => {
    if (rest.onBeforeClose) {
      const allowed = await Promise.resolve(rest.onBeforeClose());
      if (!allowed) return;
    }

    if (!isControlled()) setInternalOpen(false);
    local.onOpenChange?.(false);
    local.onClose?.();
  };

  createEffect(() => {
    if (isOpen()) {
      lastFocused = document.activeElement as HTMLElement;
    }
  });

  createEffect(() => {
    if (!isOpen()) {
      const target = rest.finalFocusRef ?? lastFocused;
      target?.focus();
      return;
    }

    queueMicrotask(() => {
      if (rest.initialFocusRef) {
        rest.initialFocusRef.focus();
      } else {
        dialogRef?.focus();
      }
    });
  });

  createEffect(() => {
    if (!isOpen() || rest.closeOnEsc === false) return;
    const handleNativeCancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        triggerClose();
      }
    };
    window.addEventListener("keydown", handleNativeCancel);
    onCleanup(() => window.removeEventListener("keydown", handleNativeCancel));
  });

  createEffect(() => {
    if (!isOpen() || rest.lockScroll === false) return;

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    if (rest.preserveScrollBarGap && scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";

    onCleanup(() => {
      document.body.style.overflow = "";
      if (rest.preserveScrollBarGap) {
        document.body.style.paddingRight = "";
      }
    });
  });

  createEffect(() => {
    if (!isOpen() || rest.trapFocus === false) return;
    if (!dialogRef) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter((el) => !el.closest("[inert]"));

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || active === dialogRef) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    dialogRef.addEventListener("keydown", handler);
    onCleanup(() => dialogRef?.removeEventListener("keydown", handler));
  });

  const overlayStyle = () => {
    const opacity = local.overlayOpacity ?? 0.63;
    const blur = local.overlayBlur;

    return {
      "background-color":
        local.withOverlay !== false
          ? `rgba(0, 0, 0, ${opacity})`
          : "transparent",
      "backdrop-filter": blur ? `blur(${blur})` : "none",
      "-webkit-backdrop-filter": blur ? `blur(${blur})` : "none", // For Safari support
      ...((local.overlayProps?.style as object) || {}),
    };
  };

  return (
    <>
      {isOpen() && (
        <Portal mount={document.body}>
          <dialog
            ref={(el) => (dialogRef = el)}
            open
            role={rest.role ?? "dialog"}
            aria-modal="true"
            tabIndex={-1}
            class="fixed inset-0 z-50 m-0 h-full w-full border-none bg-transparent p-0 [max-height:none] [max-width:none]"
            onCancel={() => {
              if (rest.closeOnEsc) triggerClose();
            }}
            {...rest}
          >
            <div
              {...local.overlayProps}
              class={cn(
                modalOverlayVariants({
                  placement: rest.placement,
                }),
                rest.scrollBehavior === "outside" && "overflow-y-auto",
                local.overlayClassName,
              )}
              onClick={
                rest.closeOnOverlayClick !== false ? triggerClose : undefined
              }
              style={overlayStyle()}
            >
              <div
                class={cn(
                  modalPanelVariants({
                    size: rest.size,
                    placement: rest.placement,
                  }),
                  rest.scrollBehavior === "inside" &&
                    "max-h-[80vh] overflow-y-auto",
                  rest.class,
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {local.children}
              </div>
            </div>
          </dialog>
        </Portal>
      )}
    </>
  );
}
