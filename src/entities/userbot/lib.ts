import axios from 'axios';

interface LinkStatus {
  downloadable: boolean;
  size: number | null;
}

const CONTENT_LENGTH = 'content-length';

export const calcLinkSize = async (url: string) => {
  const res = await axios.head(url);
  if (
    !(
      CONTENT_LENGTH in res.headers ||
      !Number.isNaN(Number(res.headers[CONTENT_LENGTH]))
    )
  )
    return null;
  return bytesToMegaBytes(Number(res.headers[CONTENT_LENGTH]));
};

export async function linkStatus(link: string) {
  const status: LinkStatus = { downloadable: false, size: null };
  try {
    const x = await axios.head(link);

    if (x.status >= 200 && x.status < 300) {
      status.downloadable = true;
    }
    if (
      CONTENT_LENGTH in x.headers &&
      !Number.isNaN(Number(x.headers[CONTENT_LENGTH]))
    ) {
      status.size = bytesToMegaBytes(Number(x.headers[CONTENT_LENGTH]));
    }
    return status;
  } catch (error) {
    return status;
  }
}

export async function downloadLink(link: string) {
  console.log('downloading link data');

  try {
    const { downloadable, size } = await linkStatus(link);
    console.log({ downloadable, size });

    if (downloadable && size !== null && size < 50) {
      const response = await axios.get(link, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      return buffer;
    }
    return link;
  } catch (error) {
    console.error('Error while downloading link data:', error);
    return link;
  }
}

export function getTextInsideQuotes(str: string) {
  // Match text inside single quotes or double quotes
  const regex = /(['"])(.*?)\1/g;

  // Extract text inside quotes using match and map
  const matches = str.match(regex) || [];
  const textInsideQuotes = matches.map((match) => match.slice(1, -1));

  return textInsideQuotes.join('');
}

function bytesToMegaBytes(bytes: number) {
  return Number((bytes / (1024 * 1024)).toFixed(0));
}
