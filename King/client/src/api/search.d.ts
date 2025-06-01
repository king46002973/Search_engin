// client/src/api/search.d.ts
declare interface SearchParams {
  query: string;
  sort?: 'relevance' | 'date' | 'rating';
  page?: number;
  perPage?: number;
  filters?: {
    [key: string]: string | number | string[];
  };
  useCache?: boolean;
}

declare interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  type: 'web' | 'image' | 'video' | 'news';
  metadata?: {
    [key: string]: any;
  };
  score?: number;
  highlight?: {
    [key: string]: string[];
  };
}

declare interface SearchResponse {
  results: SearchResult[];
  total: number;
  suggested_queries?: string[];
  related_searches?: string[];
  filters?: {
    [key: string]: {
      name: string;
      options: {
        value: string;
        count: number;
      }[];
    };
  };
  cacheKey?: string;
  isFallback?: boolean;
}

declare interface SearchSuggestion {
  text: string;
  type: 'query' | 'entity';
  score?: number;
}

declare class SearchError extends Error {
  code: string;
  details?: any;
}