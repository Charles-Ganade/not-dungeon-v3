import { A, useLocation } from "@solidjs/router";
import { Box, Flex, Text } from "../components";
import { FaRegularHome } from "solid-icons/fa";
import { VsSettingsGear } from "solid-icons/vs";
import { createEffect, createSignal } from "solid-js";
import { Settings } from "../features";

export default function Navbar() {
  const [isSettingsModalOpen, setSettingsModalOpen] = createSignal(false);
  const location = useLocation();

  // Close the settings modal whenever the route changes (e.g. navigating into
  // the plugin editor from Settings → Plugins).
  createEffect(() => {
    location.pathname;
    setSettingsModalOpen(false);
  });
  return (
    <Box position={"sticky"} as={"nav"} class="top-0 z-10 bg-base-100">
      <Flex class="border-b px-4 py-3">
        <Flex class="flex-1 gap-4">
          <A href="/" class="btn btn-ghost btn-xs">
            <Text variant={"h5"}>
              <FaRegularHome />
            </Text>
          </A>
          <button
            class="btn btn-ghost btn-xs"
            onClick={() => {
              setSettingsModalOpen((v) => !v);
            }}
          >
            <Text variant={"h5"}>
              <VsSettingsGear />
            </Text>
            <Settings
              open={isSettingsModalOpen}
              onClose={() => setSettingsModalOpen(false)}
            />
          </button>
        </Flex>
      </Flex>
    </Box>
  );
}
