import { createEffect } from 'effector';
import { timeout } from 'lib';
import { UserInfo } from 'services/stories-service';
import { Api } from 'telegram';

import { sendActiveStories } from './send-active-stories';
import { sendPaginatedStories } from './send-paginated-stories';
import { sendParticularStory } from './send-particular-story';
import { sendPinnedStories } from './send-pinned-stories';

export const sendStoriesFx = createEffect(
  async ({
    activeStories = [],
    pinnedStories = [],
    paginatedStories,
    particularStory,
    task,
  }: {
    activeStories: Api.TypeStoryItem[];
    pinnedStories: Api.TypeStoryItem[];
    particularStory?: Api.TypeStoryItem;
    paginatedStories?: Api.TypeStoryItem[];
    task: UserInfo;
  }) => {
    if (paginatedStories && paginatedStories.length > 0) {
      await sendPaginatedStories({ stories: paginatedStories, task });
      return;
    }

    if (activeStories.length > 0) {
      await sendActiveStories({ stories: activeStories, task });
      await timeout(2000);
    }

    if (pinnedStories.length > 0) {
      await sendPinnedStories({ stories: pinnedStories, task });
    }

    if (particularStory) {
      await sendParticularStory({ story: particularStory, task });
    }
  }
);
