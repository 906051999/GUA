"use client";

import { ActionIcon, Box, Group, Text } from "@mantine/core";

export function ConfigBar(props: {
  onOpenAiConfig: () => void;
  onOpenDivinationHistory: () => void;
  onOpenDecodeHistory: () => void;
  onOpenSettings: () => void;
  onOpenShareCard: () => void;
}) {
  return (
    <Box className="gua-configbar">
      <Group gap={6} wrap="nowrap">
        <ActionIcon variant="subtle" color="gray" radius="xl" aria-label="AI 配置" onClick={props.onOpenAiConfig}>
          <Text fw={700} fz="xs">
            AI
          </Text>
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          radius="xl"
          aria-label="推演历史"
          onClick={props.onOpenDivinationHistory}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 8v4.6l3 1.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" radius="xl" aria-label="解码历史" onClick={props.onOpenDecodeHistory}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M8.2 8.6 5.4 12l2.8 3.4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15.8 8.6 18.6 12l-2.8 3.4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10.6 18.2 13.4 5.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" radius="xl" aria-label="设置" onClick={props.onOpenSettings}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19.4 13.6c.1-.5.1-1 .1-1.6s0-1.1-.1-1.6l2-1.5-2-3.4-2.4 1a8.6 8.6 0 0 0-2.7-1.6L14 2h-4l-.3 2.3c-1 .3-2 .9-2.7 1.6l-2.4-1-2 3.4 2 1.5c-.1.5-.1 1-.1 1.6s0 1.1.1 1.6l-2 1.5 2 3.4 2.4-1c.7.7 1.7 1.2 2.7 1.6L10 22h4l.3-2.3c1-.3 2-.9 2.7-1.6l2.4 1 2-3.4-2-1.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" radius="xl" aria-label="分享卡片" onClick={props.onOpenShareCard}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3v10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 6.5 12 3l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6.6 13.2v6.2c0 .6.5 1.1 1.1 1.1h8.6c.6 0 1.1-.5 1.1-1.1v-6.2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </ActionIcon>
      </Group>
    </Box>
  );
}

