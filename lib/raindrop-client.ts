const BASE_URL = "https://api.raindrop.io/rest/v1";
const PER_PAGE = 50;
const MAX_PAGES = 500;
const MAX_RETRIES = 3;

export type RaindropCollection = {
  _id: number;
  title: string;
};

export type RaindropItem = {
  _id: number;
  title: string;
  link: string;
  excerpt: string;
  domain: string;
  cover: string;
  type: string;
  tags: string[];
  collection: { $id: number };
  created: string;
  lastUpdate: string;
};

async function fetchWithRetry(url: string, token: string): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) return res;

    const shouldRetry = (res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES;
    if (!shouldRetry) {
      throw new Error(`Raindrop API request failed: ${res.status} ${res.statusText}`);
    }

    attempt += 1;
    const backoffMs = 500 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }
}

export async function fetchCollections(token: string): Promise<RaindropCollection[]> {
  const [rootRes, childRes] = await Promise.all([
    fetchWithRetry(`${BASE_URL}/collections`, token),
    fetchWithRetry(`${BASE_URL}/collections/childrens`, token),
  ]);

  const [root, children] = await Promise.all([rootRes.json(), childRes.json()]);
  const combined: RaindropCollection[] = [...(root.items ?? []), ...(children.items ?? [])];

  // The root and childrens endpoints can both list the same collection; ON CONFLICT
  // DO UPDATE can't affect the same row twice within one INSERT, so dedupe by id.
  const byId = new Map(combined.map((c) => [c._id, c]));
  return [...byId.values()];
}

export async function fetchAllRaindrops(token: string): Promise<RaindropItem[]> {
  const items: RaindropItem[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${BASE_URL}/raindrops/0?page=${page}&perpage=${PER_PAGE}&sort=-created`;
    const res = await fetchWithRetry(url, token);
    const data = await res.json();
    const pageItems: RaindropItem[] = data.items ?? [];

    items.push(...pageItems);

    if (pageItems.length < PER_PAGE) break;
  }

  return items;
}
