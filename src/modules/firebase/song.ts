import {CustomCss, ELLIPSIS, RefreshResultItem} from '../interface';
import {FirebaseBaseModule} from './base';

interface Song {
  title?: string;
  artist?: string;
  timestampMin?: number;
}

const CSS: CustomCss[] = [
  {
    className: 'default',
    color: 'lightgreen',
  },
];

const HELP = `
The module is song that is currently playing.

It is using firebase database to communicate between the different profiles (otherwise the music player would have to be started in the same profile as the status).
The song in the realtime database must be stored under '{databaseToken}/songs/current' key (where databaseToken is a configurable parameter). The object should contain two properties: 'title' and 'artist'. When title is not set, the module will be hidden.

This module is only displaying data that has to be added by a separate tool. There is the corresponding chrome extension (https://chromewebstore.google.com/detail/status-bar-helper/cnknpnfckdkninhmcgohnkdjiihidfhc) that supports some common web players and sets the data in the format readable by this module. Note that the databaseUrl and databaseToken must be separately set in the extension (right click on the extension icon).
`;

/** Song module */
export class SongModule extends FirebaseBaseModule {
  /** constuctor */
  constructor() {
    super('/songs/current', CSS, HELP);
  }

  protected override _onValue(data: unknown): RefreshResultItem[] {
    const song = data as Song;

    // Timestamp is not used for now (The extension is using timestamp on its side but it should take care of updating database).
    // I need to create a better fix with some kind of longer auto expire.
    // const nowTimestampMin = Math.floor(Date.now() / 60000);

    const showSong = !!data?.title;
    
    if (showSong) {
      const titleSplit = song.title.split(' ').filter((i) => i);
      // Let's display at most 5 words from the title.
      const split = titleSplit.length > 6;
      return [
        {
          value: `${song.artist} - ${titleSplit.slice(0, split ? 5 : undefined).join(' ')}${split ? ELLIPSIS : ''}`,
          extendedValue: split ? ` ${titleSplit.slice(5).join(' ')}` : '',
          classNames: ['default'],
        },
      ];
    } else {
      console.log('SongModule onValue - expired or empty song', song);
      return [];
    }
  }
}
