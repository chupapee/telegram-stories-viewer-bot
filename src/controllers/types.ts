import { UserInfo } from 'services/stories-service';
import { Api } from 'telegram';

export interface SendStoriesArgs {
  stories: Api.TypeStoryItem[];
  task: UserInfo;
}
