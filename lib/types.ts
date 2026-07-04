export type GraphTag = {
  id: number;
  name: string;
  count: number;
};

export type GraphCollection = {
  id: number;
  title: string;
};

export type GraphRaindrop = {
  id: number;
  title: string;
  link: string;
  domain: string | null;
  cover: string | null;
  excerpt: string | null;
  createdAt: string;
  collectionId: number | null;
  tagIds: number[];
};

export type GraphData = {
  tags: GraphTag[];
  collections: GraphCollection[];
  raindrops: GraphRaindrop[];
};

export type PositionedTag = GraphTag & { x: number; y: number; radius: number };
export type PositionedRaindrop = GraphRaindrop & { x: number; y: number };
