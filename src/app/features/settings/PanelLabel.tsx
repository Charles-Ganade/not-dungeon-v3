import { Text } from "@/app/components";

export function PanelLabel(props: { children: string }) {
  return (
    <div class="w-full p-4 border-b border-base-300 shadow">
      <Text variant={"h4"} class="leading-none font-bold">
        {props.children}
      </Text>
    </div>
  );
}
