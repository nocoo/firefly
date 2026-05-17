// ---------------------------------------------------------------------------
// Unfurl shared types + UnfurlError
// ---------------------------------------------------------------------------

export interface UnfurlRawResult {
  url: string;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  pageTitle: string | null;
  bodyText: string;
  readmeImage: string | null;
}

export class UnfurlError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "UnfurlError";
  }
}
